import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initDb } from './db/pool.js';

import cropsRouter from './routes/crops.js';
import farmersRouter from './routes/farmers.js';
import waterEntriesRouter from './routes/waterEntries.js';
import paymentsRouter from './routes/payments.js';
import hisabRouter from './routes/hisab.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/crops', cropsRouter);
app.use('/api/farmers', farmersRouter);
app.use('/api/water-entries', waterEntriesRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/hisab', hisabRouter);

// Root fallback to serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start Server & Initialize Database
async function startServer() {
  try {
    console.log('🔄 Initializing PostgreSQL database tables & seed data...');
    await initDb();
    
    let currentPort = parseInt(PORT, 10);
    const server = app.listen(currentPort, () => {
      console.log(`====================================================`);
      console.log(`🌾 Borewell Water Hisab (બોરવેલ પાણી હિસાબ)`);
      console.log(`🚀 Server running on: http://localhost:${currentPort}`);
      console.log(`====================================================`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`⚠️ Port ${currentPort} is already in use. Trying port ${currentPort + 1}...`);
        currentPort += 1;
        server.listen(currentPort);
      } else {
        console.error('❌ Server error:', err);
      }
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
