require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const next = require('next');

const authRoutes = require('./routes/auth');
const uploadRoutes = require('./routes/uploads');
const campaignRoutes = require('./routes/campaigns');
const smsRoutes = require('./routes/sms');
const userRoutes = require('./routes/users');
const settingsRoutes = require('./routes/settings');

const app = express();
const PORT = process.env.PORT || 5000;
const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev, dir: path.resolve(__dirname, '../../frontend') });
const handle = nextApp.getRequestHandler();

// Ensure uploads directory exists
const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Middleware
app.use(helmet());
app.use(morgan('dev'));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingsRoutes);

// Serve static frontend files in production
if (process.env.NODE_ENV === 'production') {
  // Use Next.js request handler for all non-API routes
  app.all('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      return handle(req, res);
    }
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// Start server with robust error handling
async function startServer() {
  try {
    if (!dev) {
      console.log('📦 Production mode: Preparing Next.js...');
      await nextApp.prepare().catch(err => {
        console.error('⚠️ Next.js failed to prepare, but API will still run:', err.message);
      });
      
      // Handle Next.js requests in production
      app.all('*', (req, res) => {
        if (!req.path.startsWith('/api')) {
          return handle(req, res);
        }
      });
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server ready on port ${PORT} (NODE_ENV: ${process.env.NODE_ENV || 'development'})`);
    });
  } catch (err) {
    console.error('❌ FATAL STARTUP ERROR:', err);
    process.exit(1);
  }
}

startServer();
