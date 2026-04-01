const jwt = require('jsonwebtoken');
const https = require('http'); // The backend is http according to logs

const secret = "sms-app-super-secret-jwt-key-2024";
const token = jwt.sign({ id: 1, username: 'admin', role: 'ADMIN' }, secret);
const campaignId = 6;

async function hitSse() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: `/api/sms/stream/${campaignId}?token=${token}`,
      method: 'GET',
    };

    const req = https.request(options, (res) => {
      console.log(`Response Status: ${res.statusCode}`);
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
        if (data.includes('Campaign is already being processed.')) {
          console.log('SUCCESS: Second request blocked as expected.');
          req.destroy();
          resolve(true);
        }
        if (data.includes('event: start')) {
           console.log('First request started processing...');
        }
      });
      res.on('end', () => resolve(false));
    });

    req.on('error', (e) => {
       // console.error(`Problem with request: ${e.message}`);
       resolve(false);
    });
    req.end();
  });
}

async function main() {
  console.log('Starting first request...');
  hitSse(); // Don't await yet, let it run in background

  await new Promise(r => setTimeout(r, 1000)); // Wait a bit for the first one to acquire the lock

  console.log('Starting second request (should be blocked)...');
  const result = await hitSse();
  
  if (result) {
    console.log('Verification PASSED: Concurrency lock is working.');
  } else {
    console.log('Verification FAILED: Second request was not blocked.');
  }
}

main();
