import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { config, getDataDir } from './config.js';
import { apiRouter } from './routes/api.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', apiRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', dataDir: getDataDir() });
});

app.listen(config.port, '127.0.0.1', () => {
  console.log(`Antigravity Tracker Backend listening on http://127.0.0.1:${config.port}`);
  console.log(`Connected to Antigravity Data Directory: ${getDataDir()}`);
});
