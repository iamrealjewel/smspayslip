const jwt = require('jsonwebtoken');
const https = require('http');

const secret = "sms-app-super-secret-jwt-key-2024";
const token = jwt.sign({ id: 1, username: 'admin', role: 'ADMIN' }, secret);

async function request(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: `${path}${path.includes('?') ? '&' : '?'}token=${token}`,
      method: method,
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function test() {
  console.log('Testing GET /api/campaigns...');
  const all = await request('/api/campaigns');
  console.log(`Total campaigns: ${all.body.length}`);

  if (all.body.length > 0) {
    const first = all.body[0];
    const date = new Date(first.startedAt).toISOString().split('T')[0];
    
    console.log(`Testing filter with date: ${date}`);
    const filtered = await request(`/api/campaigns?from=${date}&to=${date}`);
    console.log(`Filtered count: ${filtered.body.length}`);

    console.log(`Testing DELETE /api/campaigns/${first.id}...`);
    const del = await request(`/api/campaigns/${first.id}`, 'DELETE');
    console.log(`Delete status: ${del.status}, message: ${del.body.message}`);

    const check = await request('/api/campaigns');
    console.log(`Total campaigns after delete: ${check.body.length}`);
    if (check.body.length === all.body.length - 1) {
      console.log('Verification PASSED');
    } else {
      console.log('Verification FAILED');
    }
  } else {
    console.log('No campaigns to test with.');
  }
}

test();
