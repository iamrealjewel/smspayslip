/**
 * @file app.js
 * Consolidated Entry Point for cPanel Passenger
 * Version: 1.0.3 (Diagnostic)
 */
const path = require('path');
const fs = require('fs');

const logFile = path.join(__dirname, 'startup_check.txt');

function log(msg) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFile, `[${timestamp}] ${msg}\n`);
}

// Clear old log
if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

log("Initializing SMS Application...");
log(`Current Directory: ${__dirname}`);
log(`Node Version: ${process.version}`);

try {
    const backendPath = path.join(__dirname, 'backend', 'src', 'index.js');
    log(`Checking for backend at: ${backendPath}`);
    
    if (fs.existsSync(backendPath)) {
        log("Backend found. Requiring module...");
        require(backendPath);
        log("Module required successfully.");
    } else {
        log("CRITICAL ERROR: Backend entry point not found!");
        // List directory content for debugging
        const files = fs.readdirSync(__dirname);
        log(`Files in root: ${files.join(', ')}`);
        if (files.includes('backend')) {
            log(`Files in backend: ${fs.readdirSync(path.join(__dirname, 'backend')).join(', ')}`);
        }
    }
} catch (err) {
    log(`FATAL ERROR: ${err.message}`);
    log(`Stack: ${err.stack}`);
}

// Keep process alive for Passenger visibility
process.on('uncaughtException', (err) => {
    log(`UNCAUGHT EXCEPTION: ${err.message}`);
});
