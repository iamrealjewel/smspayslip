const express = require('express');
const prisma = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roles');
const { sendSingleSms } = require('../services/smsService');

const router = express.Router();

// GET /api/settings — admin gets all settings
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const settings = await prisma.setting.findMany();
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    res.json(map);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings — update settings (upsert)
router.put('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const allowed = ['api_token', 'sid', 'api_endpoint'];
    const updates = [];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates.push(
          prisma.setting.upsert({
            where: { key },
            update: { value: req.body[key] },
            create: { key, value: req.body[key] },
          })
        );
      }
    }

    await Promise.all(updates);
    res.json({ message: 'Settings updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/settings/test-sms — send a test SMS
router.post('/test-sms', authenticate, requireAdmin, async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number required' });

    const settings = await prisma.setting.findMany();
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));

    const result = await sendSingleSms({
      apiToken: map['api_token'] || '',
      sid: map['sid'] || '',
      endpoint: map['api_endpoint'] || 'https://smsplus.sslwireless.com/api/v3/send-sms',
      sms: 'Test SMS from SMS Payslip App',
      msisdn: phone,
      csmsId: `test_${Date.now()}`,
    });

    res.json({ httpStatus: result.status, response: result.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/settings/stats — dashboard stats (any auth user)
router.get('/stats', authenticate, async (req, res) => {
  try {
    const [totalSMS, successSMS, campaigns, users, monthlyCounts] = await Promise.all([
      prisma.sMSResult.count(),
      prisma.sMSResult.count({ where: { status: 'Success' } }),
      prisma.campaign.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.$queryRaw`
        SELECT DATE_FORMAT(sentAt, '%Y-%m') as month, 
               COUNT(*) as total,
               SUM(CASE WHEN status='Success' THEN 1 ELSE 0 END) as success,
               SUM(CASE WHEN status='Failed' THEN 1 ELSE 0 END) as failed
        FROM SMSResult 
        WHERE sentAt >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
        GROUP BY month 
        ORDER BY month ASC
      `,
    ]);

    const statsData = {
      totalSMS,
      successSMS,
      failedSMS: totalSMS - successSMS,
      successRate: totalSMS > 0 ? Math.round((successSMS / totalSMS) * 100) : 0,
      totalCampaigns: campaigns,
      activeUsers: users,
      monthlyCounts: monthlyCounts.map(m => ({
        ...m,
        total: Number(m.total || 0),
        success: Number(m.success || 0),
        failed: Number(m.failed || 0),
      })),
    };

    res.json(statsData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
