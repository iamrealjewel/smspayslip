const https = require('https');
const prisma = require('../config/db');

/**
 * Build SMS text from a row object (mirrors main.py logic exactly)
 */
function formatMonth(val) {
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val ?? '').trim();
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
}

function buildSmsText(row, columns, startColIndex) {
  const formatNum = (v) => {
    const n = parseFloat(v);
    if (isNaN(n)) return '0.0';
    return n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  };

  const monthValue = formatMonth(row['Month']);
  const empId = String(row['Emp ID'] ?? '').trim();
  const payDays = String(row['Pay. Days'] ?? '').trim();
  const grossSalary = row['Gross Salary'] ?? 0;

  const parts = [
    `PaySlip-${monthValue}`,
    `EmpID: ${empId}`,
    `PayDays: ${payDays}`,
    `GROSS-${formatNum(grossSalary)}`,
  ];

  for (let i = startColIndex + 1; i < columns.length; i++) {
    const col = columns[i];
    if (col.toLowerCase() === 'month') continue;
    const val = row[col];
    if (val !== null && val !== undefined && !isNaN(parseFloat(val)) && parseFloat(val) > 0) {
      const label = col.trim().replace(/[\r\n]+/g, ' ');
      parts.push(`${label}-${formatNum(val)}`);
    }
  }

  return parts.join(', ');
}

/**
 * Send a single SMS via SSLWireless API
 */
async function sendSingleSms({ apiToken, sid, endpoint, sms, msisdn, csmsId }) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ api_token: apiToken, sid, sms, msisdn, csms_id: csmsId });
    const url = new URL(endpoint || 'https://smsplus.sslwireless.com/api/v3/send-sms');

    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });

    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Request timed out')); });
    req.write(payload);
    req.end();
  });
}

/**
 * Run a full SMS campaign with SSE streaming support
 * @param {number} campaignId
 * @param {Array} rows - parsed employee rows
 * @param {Array} columns - ordered column names
 * @param {number} startColIndex - index of 'Gross Salary' column
 * @param {Function} onProgress - callback(event) for SSE streaming
 */
async function runCampaign(campaignId, rows, columns, startColIndex, onProgress) {
  // Fetch settings from DB
  const settings = await prisma.setting.findMany();
  const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  const apiToken = settingsMap['api_token'] || '';
  const sid = settingsMap['sid'] || '';
  const endpoint = settingsMap['api_endpoint'] || 'https://smsplus.sslwireless.com/api/v3/send-sms';

  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const empId = String(row['Emp ID'] ?? '').trim();
    const phone = String(row['Phone Number'] ?? '').trim();
    const monthRaw = row['Month'];
    const monthValue = formatMonth(monthRaw);
    const grossSalary = parseFloat(row['Gross Salary'] ?? 0);

    const smsText = buildSmsText(row, columns, startColIndex);
    
    // Shorten CSMS ID to avoid "Invalid CSMS ID" error
    const dDate = new Date(monthRaw);
    let monthSnippet = '';
    if (!isNaN(dDate.getTime())) {
      const y = String(dDate.getFullYear()).slice(-1);
      const m = String(dDate.getMonth() + 1).padStart(2, '0');
      const d = String(dDate.getDate()).padStart(2, '0');
      monthSnippet = `${y}${m}${d}`;
    } else {
      monthSnippet = String(monthRaw ?? '').replace(/\W/g, '').slice(0, 6);
    }
    const csmsId = `S_${empId.slice(0, 8)}_${monthSnippet}`;

    let status = 'Failed';
    let apiResponse = '';

    try {
      const result = await sendSingleSms({ apiToken, sid, endpoint, sms: smsText, msisdn: phone, csmsId });
      apiResponse = result.body;
      
      try {
        const parsed = JSON.parse(result.body);
        // SSLWireless returns 200 OK even for validation errors, check internal status
        status = (result.status === 200 && parsed.status === 'SUCCESS') ? 'Success' : 'Failed';
      } catch (_) {
        status = result.status === 200 ? 'Success' : 'Failed';
      }

      if (status === 'Success') successCount++;
      else failedCount++;
    } catch (err) {
      status = 'Failed';
      apiResponse = err.message;
      failedCount++;
    }

    // Save result to DB
    await prisma.sMSResult.create({
      data: { campaignId, empId, phone, month: monthValue, grossSalary, smsText, status, apiResponse },
    });

    // Update campaign counts
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { successCount, failedCount },
    });

    // Stream progress event
    if (onProgress) {
      onProgress({
        index: i + 1,
        total: rows.length,
        empId,
        phone,
        status,
        smsText,
        apiResponse,
      });
    }
  }

  // Mark campaign complete
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });

  return { successCount, failedCount };
}

module.exports = { buildSmsText, sendSingleSms, runCampaign };
