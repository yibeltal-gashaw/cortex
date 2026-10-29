#!/usr/bin/env node

import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { exec, spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Parse CLI Arguments
const args = process.argv.slice(2);

let port = 3000;
let customDir = null;
let shouldOpen = true;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--help' || arg === '-h') {
    printHelp();
    process.exit(0);
  }
  if (arg === '--version' || arg === '-v') {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    console.log(`Cortex HUD v${pkg.version}`);
    process.exit(0);
  }
  if (arg === '--port' || arg === '-p') {
    port = parseInt(args[++i], 10) || 3000;
  } else if (arg === '--dir' || arg === '-d') {
    customDir = args[++i];
  } else if (arg === '--no-open') {
    shouldOpen = false;
  } else if (!arg.startsWith('-')) {
    customDir = arg;
  }
}

function printHelp() {
  console.log(`
  \x1b[35m___  ___  _ __| |_ _____  __\x1b[0m
 \x1b[35m/ __|/ _ \\| '__| __/ _ \\ \\/ /\x1b[0m
\x1b[35m| (__| (_) | |  | ||  __/>  < \x1b[0m
 \x1b[35m\\___|\\___/|_|   \\__\\___/_/\\_\\\x1b[0m
  \x1b[36mLocal Observability HUD for Google Antigravity\x1b[0m

\x1b[1mUSAGE:\x1b[0m
  $ \x1b[32mcortex\x1b[0m [options] [directory]

\x1b[1mOPTIONS:\x1b[0m
  -p, --port <port>       Port to bind web server (default: 3000)
  -d, --dir <path>        Custom Antigravity data directory path
  --no-open               Do not automatically launch browser
  -v, --version           Print Cortex version
  -h, --help              Show this help menu

\x1b[1mEXAMPLES:\x1b[0m
  $ \x1b[32mcortex\x1b[0m                  # Launch with auto-detected ~/.gemini/antigravity
  $ \x1b[32mcortex .\x1b[0m                # Point Cortex to current directory
  $ \x1b[32mcortex -p 4000\x1b[0m          # Start HUD on port 4000
  $ \x1b[32mnpx cortex\x1b[0m              # Run directly with npx
`);
}

// Banner
console.log(`
\x1b[35m  ___  ___  _ __| |_ _____  __\x1b[0m
\x1b[35m / __|/ _ \\| '__| __/ _ \\ \\/ /\x1b[0m
\x1b[35m| (__| (_) | |  | ||  __/>  < \x1b[0m
\x1b[35m \\___|\\___/|_|   \\__\\___/_/\\_\\\x1b[0m
  \x1b[36mGoogle Antigravity Session HUD\x1b[0m
`);

// Handle target directory
if (customDir) {
  const resolved = path.resolve(customDir);
  if (!fs.existsSync(resolved)) {
    console.error(`\x1b[31mError: Target directory does not exist: ${resolved}\x1b[0m`);
    process.exit(1);
  }
  process.env.ANTIGRAVITY_DATA_DIR = resolved;
  console.log(`\x1b[34m[Storage]\x1b[0m Using directory: \x1b[1m${resolved}\x1b[0m`);
}

process.env.PORT = String(port);

// Ensure client & server build artifacts exist
const serverEntry = path.join(rootDir, 'server', 'dist', 'index.js');
const clientDist = path.join(rootDir, 'client', 'dist', 'index.html');

if (!fs.existsSync(serverEntry) || !fs.existsSync(clientDist)) {
  console.log('\x1b[33mBuilding Cortex production bundles...\x1b[0m');
  try {
    const buildRes = spawn('npm', ['run', 'build'], { cwd: rootDir, stdio: 'inherit', shell: true });
    buildRes.on('close', (code) => {
      if (code !== 0) {
        console.error(`\x1b[31mBuild failed with exit code ${code}\x1b[0m`);
        process.exit(code);
      }
      startServer();
    });
  } catch (err) {
    console.error('\x1b[31mError building project:\x1b[0m', err);
    process.exit(1);
  }
} else {
  startServer();
}

function openBrowser(url) {
  const platform = os.platform();
  if (platform === 'win32') {
    exec(`start "" "${url}"`);
  } else if (platform === 'darwin') {
    exec(`open "${url}"`);
  } else {
    exec(`xdg-open "${url}"`);
  }
}

function startServer() {
  const url = `http://127.0.0.1:${port}`;
  console.log(`\x1b[32m[Server]\x1b[0m Starting Cortex on \x1b[1m${url}\x1b[0m`);

  // Import server
  const serverDistUrl = new URL(`file:///${serverEntry.replace(/\\/g, '/')}`).href;
  import(serverDistUrl).then(() => {
    console.log(`\x1b[32m[Ready]\x1b[0m Cortex HUD is live! Press \x1b[1mCtrl+C\x1b[0m to stop.`);

    if (shouldOpen) {
      setTimeout(() => {
        openBrowser(url);
      }, 500);
    }
  }).catch((err) => {
    console.error('\x1b[31m[Failed to start Cortex server]:\x1b[0m', err);
    process.exit(1);
  });
}

