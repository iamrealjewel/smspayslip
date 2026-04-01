const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { parseExcel, findDuplicates, validatePhones } = require('../services/excelService');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.resolve(process.env.UPLOAD_DIR || './uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.xlsx', '.xls'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
  },
  limits: { fileSize: 20 * 1024 * 1024 },
});

// POST /api/uploads — upload & validate excel
router.post('/', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { rows, columns, startColIndex, error } = parseExcel(req.file.path);

    // If there's a structural error, we still return the rows so the frontend can show them,
    // but we don't create a database record unless it's at least structurally valid.
    if (error) {
      fs.unlinkSync(req.file.path);
      return res.json({
        error,         // Structural error message (e.g. "Gross Salary column not found")
        rows,
        columns,
        rowCount: rows.length,
        validation: { hasIssues: true, isStructural: true }
      });
    }

    const { duplicateEmpIds, duplicatePhones, hasDuplicates } = findDuplicates(rows);
    const { hasPhoneIssues, missingPhoneRows, invalidPhoneRows } = validatePhones(rows);
    const hasIssues = hasDuplicates || hasPhoneIssues;
    const status = hasIssues ? 'DUPLICATE_FOUND' : 'VALIDATED';

    const uploadRecord = await prisma.upload.create({
      data: {
        filename: req.file.originalname,
        storedPath: req.file.path,
        rowCount: rows.length,
        userId: req.user.id,
        status,
      },
    });

    const preview = rows.slice(0, 10).map((row) => {
      const p = {};
      ['Emp ID', 'Name', 'Phone Number', 'Month', 'Designation', 'Gross Salary'].forEach((k) => {
        if (row[k] !== undefined) p[k] = row[k];
      });
      return p;
    });

    res.json({
      upload: uploadRecord,
      validation: {
        hasIssues,
        hasDuplicates,
        duplicateEmpIds,
        duplicatePhones,
        hasPhoneIssues,
        missingPhoneRows,
        invalidPhoneRows,
      },
      rows,
      preview,
      columns,
      rowCount: rows.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/uploads/:id — remove upload and all associated data
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const uploadRecord = await prisma.upload.findUnique({
      where: { id },
      include: { campaigns: true },
    });

    if (!uploadRecord) return res.status(404).json({ error: 'Upload not found' });

    // 1. Delete associated data in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete SMS Results for all campaigns of this upload
      const campaignIds = uploadRecord.campaigns.map((c) => c.id);
      if (campaignIds.length > 0) {
        await tx.sMSResult.deleteMany({ where: { campaignId: { in: campaignIds } } });
        await tx.campaign.deleteMany({ where: { id: { in: campaignIds } } });
      }
      // Delete the upload itself
      await tx.upload.delete({ where: { id } });
    });

    // 2. Clear files from disk
    if (fs.existsSync(uploadRecord.storedPath)) {
      fs.unlinkSync(uploadRecord.storedPath);
    }
    const correctedPath = uploadRecord.storedPath + '.corrected.json';
    if (fs.existsSync(correctedPath)) {
      fs.unlinkSync(correctedPath);
    }

    res.json({ success: true, message: 'Upload and all associated data removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/uploads/:id/rows — save corrected rows after user review
router.patch('/:id/rows', authenticate, async (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows must be an array' });

    const uploadRecord = await prisma.upload.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!uploadRecord) return res.status(404).json({ error: 'Upload not found' });

    // Write corrected rows as sidecar — parseExcel picks this up automatically
    const correctedPath = uploadRecord.storedPath + '.corrected.json';
    fs.writeFileSync(correctedPath, JSON.stringify(rows, null, 2));

    await prisma.upload.update({
      where: { id: uploadRecord.id },
      data: { rowCount: rows.length, status: 'VALIDATED' },
    });

    res.json({ success: true, rowCount: rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/uploads/finalize — create upload record from validated JSON data
router.post('/finalize', authenticate, async (req, res) => {
  try {
    const { filename, rows } = req.body;
    if (!filename || !Array.isArray(rows)) {
      return res.status(400).json({ error: 'filename and rows (array) required' });
    }

    const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    // Store cleaned data alongside the record
    const storageFilename = `${uuidv4()}.json`;
    const storedPath = path.join(uploadDir, storageFilename);
    fs.writeFileSync(storedPath, JSON.stringify(rows, null, 2));

    const uploadRecord = await prisma.upload.create({
      data: {
        filename,
        storedPath,
        rowCount: rows.length,
        userId: req.user.id,
        status: 'VALIDATED',
      },
    });

    res.json({ upload: uploadRecord, rowCount: rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/uploads — list all uploads
router.get('/', authenticate, async (req, res) => {
  try {
    const uploads = await prisma.upload.findMany({
      orderBy: { uploadedAt: 'desc' },
      include: { user: { select: { username: true, role: true } } },
    });
    res.json(uploads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/uploads/:id — single upload detail
router.get('/:id', authenticate, async (req, res) => {
  try {
    const uploadRecord = await prisma.upload.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { user: { select: { username: true } }, campaigns: true },
    });
    if (!uploadRecord) return res.status(404).json({ error: 'Upload not found' });

    const { rows, columns } = parseExcel(uploadRecord.storedPath);
    const preview = rows.slice(0, 20);

    res.json({ upload: uploadRecord, preview, columns, rowCount: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
