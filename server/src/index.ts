import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { config, getDataDir } from './config.js';
import { apiRouter } from './routes/api.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', apiRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', dataDir: getDataDir() });
});

// Serve client static assets in production
const clientDistPath = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

// Fallback to index.html for React SPA routing (production)
app.get('*', (req, res) => {
  const indexPath = path.join(clientDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Client not built yet. In development, visit http://127.0.0.1:5200');
  }
});

app.listen(config.port, '127.0.0.1', () => {
  console.log(`Antigravity Tracker Backend listening on http://127.0.0.1:${config.port}`);
  console.log(`Connected to Antigravity Data Directory: ${getDataDir()}`);
});
