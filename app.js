const path = require('path');
const fs = require('fs');

// Log that we've reached the root app.js
const logPath = path.join(__dirname, 'startup_check.txt');
fs.writeFileSync(logPath, `Root app.js executed at: ${new Date().toLocaleString()}\n`, { flag: 'a' });

try {
    // Navigate into the backend source
    const backendEntry = path.join(__dirname, 'backend', 'src', 'index.js');
    if (fs.existsSync(backendEntry)) {
        require(backendEntry);
    } else {
        fs.appendFileSync(logPath, `ERROR: Could not find backend entry at: ${backendEntry}\n`);
    }
} catch (err) {
    fs.appendFileSync(logPath, `CRASH: ${err.message}\n${err.stack}\n`);
}
