const XLSX = require('xlsx');
const fs = require('fs');

/** 10–13 digit phone number (strips spaces, dashes, +) */
function isValidPhone(phone) {
  const d = String(phone || '').trim().replace(/[\s\-\(\)\+\.]/g, '');
  return /^\d{10,13}$/.test(d);
}

/**
 * Parse an uploaded Excel file.
 * If a `.corrected.json` sidecar exists (saved via PATCH /rows), use it.
 */
function parseExcel(filePath) {
  // If the storedPath itself is a JSON file (finalized upload)
  if (filePath.endsWith('.json')) {
    try {
      const rows = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      const normalizedCols = columns.map((c) => c.toLowerCase());
      const startColIndex = normalizedCols.indexOf('gross salary');
      return { rows, columns, startColIndex, error: null };
    } catch (_) { /* fall through to parse original */ }
  }

  const correctedPath = filePath + '.corrected.json';
  if (fs.existsSync(correctedPath)) {
    try {
      const rows = JSON.parse(fs.readFileSync(correctedPath, 'utf8'));
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      const normalizedCols = columns.map((c) => c.toLowerCase());
      const startColIndex = normalizedCols.indexOf('gross salary');
      return { rows, columns, startColIndex, error: null };
    } catch (_) { /* fall through to parse original */ }
  }

  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheet = workbook.Sheets['Sheet1'] || workbook.Sheets[workbook.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json(sheet, { defval: null });

  const rows = rawData.map((row) => {
    const out = {};
    for (const key of Object.keys(row)) {
      out[key.trim().replace(/\n/g, ' ')] = row[key];
    }
    return out;
  });

  if (rows.length === 0) return { rows: [], columns: [], startColIndex: -1, error: 'Excel file is empty' };

  const columns = Object.keys(rows[0]);
  const normalizedCols = columns.map((c) => c.toLowerCase());
  const startColIndex = normalizedCols.indexOf('gross salary');
  if (startColIndex === -1) return { rows, columns, startColIndex: -1, error: "'Gross Salary' column not found" };

  return { rows, columns, startColIndex, error: null };
}

/** Find duplicate Emp IDs and Phone Numbers */
function findDuplicates(rows) {
  const empIdCount = {};
  const phoneCount = {};
  for (const row of rows) {
    const empId = String(row['Emp ID'] ?? '').trim();
    const phone = String(row['Phone Number'] ?? '').trim();
    if (empId) empIdCount[empId] = (empIdCount[empId] || 0) + 1;
    if (phone) phoneCount[phone] = (phoneCount[phone] || 0) + 1;
  }
  const duplicateEmpIds = Object.keys(empIdCount).filter((k) => empIdCount[k] > 1);
  const duplicatePhones = Object.keys(phoneCount).filter((k) => phoneCount[k] > 1);
  const hasDuplicates = duplicateEmpIds.length > 0 || duplicatePhones.length > 0;
  return { duplicateEmpIds, duplicatePhones, hasDuplicates };
}

/** Validate phone numbers — returns indices of missing/invalid rows */
function validatePhones(rows) {
  const missingPhoneRows = [];
  const invalidPhoneRows = [];
  rows.forEach((row, idx) => {
    const phone = String(row['Phone Number'] ?? '').trim();
    if (!phone || phone === 'null') missingPhoneRows.push(idx);
    else if (!isValidPhone(phone)) invalidPhoneRows.push(idx);
  });
  return {
    hasPhoneIssues: missingPhoneRows.length > 0 || invalidPhoneRows.length > 0,
    missingPhoneRows,
    invalidPhoneRows,
  };
}

module.exports = { parseExcel, findDuplicates, validatePhones, isValidPhone };
