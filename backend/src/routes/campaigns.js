const express = require('express');
const prisma = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { parseExcel } = require('../services/excelService');

const router = express.Router();

// Track active SSE connections per campaign
const activeStreams = new Map();

// POST /api/campaigns — create a new campaign (does NOT send yet)
router.post('/', authenticate, async (req, res) => {
  try {
    const { uploadId } = req.body;
    if (!uploadId) return res.status(400).json({ error: 'uploadId required' });

    const upload = await prisma.upload.findUnique({ where: { id: parseInt(uploadId) } });
    if (!upload) return res.status(404).json({ error: 'Upload not found' });

    const { rows, error } = parseExcel(upload.storedPath);
    if (error) return res.status(400).json({ error });

    const campaign = await prisma.campaign.create({
      data: {
        uploadId: upload.id,
        userId: req.user.id,
        total: rows.length,
        status: 'RUNNING',
      },
    });

    res.json({ campaign });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/campaigns — list all campaigns with optional date filter
router.get('/', authenticate, async (req, res) => {
  try {
    const { from, to } = req.query;
    const where = {};

    if (from || to) {
      where.startedAt = {};
      if (from) where.startedAt.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.startedAt.lte = toDate;
      }
    }

    const campaigns = await prisma.campaign.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      include: {
        user: { select: { username: true } },
        upload: { select: { filename: true } },
      },
    });
    res.json(campaigns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/campaigns/:id — campaign detail with results
router.get('/:id', authenticate, async (req, res) => {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        user: { select: { username: true } },
        upload: { select: { filename: true } },
        results: { orderBy: { sentAt: 'asc' } },
      },
    });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/campaigns/:id/export — export results as JSON (frontend converts to Excel)
router.get('/:id/export', authenticate, async (req, res) => {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { results: true },
    });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json(campaign.results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/campaigns/:id — remove a campaign and its results
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.campaign.delete({ where: { id } });
    res.json({ message: 'Campaign deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete campaign' });
  }
});

module.exports = router;
module.exports.activeStreams = activeStreams;
