const express = require('express');
const prisma = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { parseExcel } = require('../services/excelService');
const { runCampaign, sendSingleSms } = require('../services/smsService');

const router = express.Router();

// Track active SSE connections per campaign to prevent duplicates
const activeCampaigns = new Set();

// GET /api/sms/stream/:campaignId — SSE endpoint to run campaign + stream results live
router.get('/stream/:campaignId', authenticate, async (req, res) => {
  const campaignId = parseInt(req.params.campaignId);

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  if (activeCampaigns.has(campaignId)) {
    send('error', { message: 'Campaign is already being processed.' });
    return res.end();
  }

  activeCampaigns.add(campaignId);

  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { upload: true },
    });

    if (!campaign) {
      send('error', { message: 'Campaign not found' });
      return res.end();
    }

    if (campaign.status === 'COMPLETED') {
      send('error', { message: 'Campaign already completed' });
      return res.end();
    }

    const { rows, columns, startColIndex, error } = parseExcel(campaign.upload.storedPath);
    if (error) {
      send('error', { message: error });
      return res.end();
    }

    send('start', { total: rows.length, campaignId });

    await runCampaign(campaignId, rows, columns, startColIndex, (progress) => {
      send('progress', progress);
    });

    // Fetch final counts
    const updated = await prisma.campaign.findUnique({ where: { id: campaignId } });
    send('complete', {
      campaignId,
      total: updated.total,
      successCount: updated.successCount,
      failedCount: updated.failedCount,
    });
  } catch (err) {
    console.error('SSE Error:', err);
    send('error', { message: err.message });
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'FAILED' },
    }).catch(() => {});
  } finally {
    activeCampaigns.delete(campaignId);
    res.end();
  }
});

// POST /api/sms/retry/:campaignId — retry only failed entries
router.post('/retry/:campaignId', authenticate, async (req, res) => {
  try {
    const campaignId = parseInt(req.params.campaignId);
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { results: { where: { status: 'Failed' } }, upload: true },
    });

    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const settings = await prisma.setting.findMany();
    const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    const apiToken = settingsMap['api_token'] || '';
    const sid = settingsMap['sid'] || '';
    const endpoint = settingsMap['api_endpoint'] || 'https://smsplus.sslwireless.com/api/v3/send-sms';

    let retried = 0, succeeded = 0;

    for (const result of campaign.results) {
      try {
        const sanitizedMonth = result.month.replace(/\W/g, '');
        const csmsId = `sms_${result.empId}_${sanitizedMonth}_retry`;
        const r = await sendSingleSms({ apiToken, sid, endpoint, sms: result.smsText, msisdn: result.phone, csmsId });
        const newStatus = r.status === 200 ? 'Success' : 'Failed';
        await prisma.sMSResult.update({
          where: { id: result.id },
          data: { status: newStatus, apiResponse: r.body, sentAt: new Date() },
        });
        if (newStatus === 'Success') succeeded++;
        retried++;
      } catch (err) {
        await prisma.sMSResult.update({
          where: { id: result.id },
          data: { apiResponse: err.message },
        });
        retried++;
      }
    }

    // Update campaign counts
    const allResults = await prisma.sMSResult.findMany({ where: { campaignId } });
    const successCount = allResults.filter((r) => r.status === 'Success').length;
    const failedCount = allResults.filter((r) => r.status === 'Failed').length;

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { successCount, failedCount },
    });

    res.json({ message: `Retried ${retried} entries, ${succeeded} succeeded` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
