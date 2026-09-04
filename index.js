/**
 * VOLQ-Auth - Universal Cross-Platform Orchestrator & Runner
 * Supports: Linux (Hidden Cloud / Pterodactyl / Docker / VPS), macOS (Apple Silicon & Intel), Windows (x64)
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const http = require('http');

// ANSI Color Codes for Clean CLI Logging
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m',
};

function log(tag, msg, color = colors.cyan) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${colors.dim}[${timestamp}]${colors.reset} ${color}${colors.bright}[${tag}]${colors.reset} ${msg}`);
}

function logError(tag, msg) {
  log(tag, msg, colors.red);
}

// -----------------------------------------------------------------------------
// 1. Load Environment Variables (.env / backend/.env / process.env)
// -----------------------------------------------------------------------------
function loadEnv() {
  const envPaths = [
    path.join(__dirname, '.env'),
    path.join(__dirname, 'backend', '.env'),
    path.join(__dirname, '.env.local')
  ];

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"`]|['"`\r]$/g, '');
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      } catch (err) {
        // Ignore read errors
      }
    }
  }

  // Fallback defaults for Neon Cloud PostgreSQL and Security Keys
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgresql://volq_owner:npg_w9gN7mUhXLAG@ep-noisy-night-axqafr93-pooler.c-4.us-east-2.aws.neon.tech/volq?sslmode=require';
  }
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'volq_super_secret_jwt_key_32bytes_min!';
  }
  if (!process.env.SERVER_MASTER_KEY) {
    process.env.SERVER_MASTER_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  }
}

loadEnv();

// -----------------------------------------------------------------------------
// 2. Determine Operating System & Port Configuration
// -----------------------------------------------------------------------------
const platform = process.platform; // 'linux', 'darwin', 'win32'
const arch = process.arch;         // 'x64', 'arm64'

// In Pterodactyl / Hidden Cloud, port is passed via SERVER_PORT or PORT
const publicPort = parseInt(process.env.SERVER_PORT || process.env.PORT || '3000', 10);

// Backend runs internally; if publicPort happens to be 8080, shift backend to 8081
let backendPort = parseInt(process.env.BACKEND_PORT || '8080', 10);
if (publicPort === backendPort) {
  backendPort = 8081;
}

const isDev = process.env.NODE_ENV === 'development' || process.env.DEV_MODE === 'true';

console.log(`
${colors.bright}${colors.cyan}================================================================================${colors.reset}
${colors.bright}${colors.cyan}   VOLQ-AUTH (OPENKEYAUTH) - MULTI-PLATFORM UNIFIED SERVER${colors.reset}
${colors.dim}   Universal Host: Hidden Cloud • Pterodactyl • Linux • macOS • Windows${colors.reset}
${colors.bright}${colors.cyan}================================================================================${colors.reset}
   ${colors.green}• Platform:${colors.reset} ${platform} (${arch})
   ${colors.green}• Public Web & API Port:${colors.reset} ${publicPort}
   ${colors.green}• Internal Backend Port:${colors.reset} ${backendPort}
   ${colors.green}• Database Engine:${colors.reset} Neon Cloud PostgreSQL
${colors.bright}${colors.cyan}================================================================================${colors.reset}
`);

// -----------------------------------------------------------------------------
// 3. Locate & Prepare Backend Binary
// -----------------------------------------------------------------------------
function resolveBackendCommand() {
  const binDir = path.join(__dirname, 'backend', 'bin');
  let binaryName = '';

  if (platform === 'win32') {
    binaryName = 'server-windows.exe';
  } else if (platform === 'darwin') {
    binaryName = arch === 'arm64' ? 'server-darwin-arm64' : 'server-darwin-amd64';
  } else {
    // Linux / container (Hidden Cloud, Pterodactyl, Ubuntu, Alpine)
    binaryName = 'server-linux';
  }

  const binaryPath = path.join(binDir, binaryName);

  if (fs.existsSync(binaryPath)) {
    // On POSIX systems (Linux / macOS), ensure binary has execution permission (0755)
    if (platform !== 'win32') {
      try {
        fs.chmodSync(binaryPath, 0o755);
        log('RUNNER', `Granted execution permissions (0755) to ${binaryName}`, colors.green);
      } catch (err) {
        log('RUNNER', `Note on chmod: ${err.message}`, colors.yellow);
      }
    }
    return { cmd: binaryPath, args: [] };
  }

  // Fallback: Check if go compiler is installed
  try {
    execSync('go version', { stdio: 'ignore' });
    log('RUNNER', `Precompiled binary not found for ${platform}-${arch}, but Go compiler detected. Running via Go toolchain...`, colors.yellow);
    return { cmd: 'go', args: ['run', './cmd/server'] };
  } catch (err) {
    logError('RUNNER', `Could not find executable binary at ${binaryPath} and Go is not installed.`);
    logError('RUNNER', `Available binaries in ${binDir}: ${fs.existsSync(binDir) ? fs.readdirSync(binDir).join(', ') : 'none'}`);
    process.exit(1);
  }
}

// -----------------------------------------------------------------------------
// 4. Ensure Frontend is Installed and Built
// -----------------------------------------------------------------------------
function getNextBinPath() {
  const frontendDir = path.join(__dirname, 'frontend');
  try {
    return require.resolve('next/dist/bin/next', { paths: [frontendDir] });
  } catch (e) {
    return path.join(frontendDir, 'node_modules', 'next', 'dist', 'bin', 'next');
  }
}

function ensureFrontendReady() {
  const frontendDir = path.join(__dirname, 'frontend');
  const nodeModulesDir = path.join(frontendDir, 'node_modules');
  const nextBuildDir = path.join(frontendDir, '.next');

  if (!fs.existsSync(nodeModulesDir)) {
    log('FRONTEND', 'frontend/node_modules not found. Running npm install in frontend...', colors.yellow);
    try {
      execSync('npm install --production=false', { cwd: frontendDir, stdio: 'inherit', shell: true });
      log('FRONTEND', 'Dependencies installed successfully.', colors.green);
    } catch (err) {
      logError('FRONTEND', `Failed to install frontend dependencies: ${err.message}`);
      process.exit(1);
    }
  }

  if (!isDev && !fs.existsSync(nextBuildDir)) {
    log('FRONTEND', 'Production build (.next) not found. Building Next.js application...', colors.yellow);
    try {
      const nextBin = getNextBinPath();
      execSync(`"${process.execPath}" "${nextBin}" build`, {
        cwd: frontendDir,
        stdio: 'inherit',
        shell: true,
        env: {
          ...process.env,
          INTERNAL_API_URL: `http://127.0.0.1:${backendPort}`,
        }
      });
      log('FRONTEND', 'Production build complete.', colors.green);
    } catch (err) {
      logError('FRONTEND', `Failed to build Next.js frontend: ${err.message}`);
      process.exit(1);
    }
  }
}

// -----------------------------------------------------------------------------
// 5. Health Check Helper
// -----------------------------------------------------------------------------
function waitForBackend(port, maxAttempts = 30, interval = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      attempts++;
      const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
        if (res.statusCode === 200 || res.statusCode === 404) {
          resolve();
        } else {
          retry();
        }
      });
      req.on('error', () => {
        retry();
      });
      req.setTimeout(400, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (attempts >= maxAttempts) {
        reject(new Error(`Backend did not respond on port ${port} after ${maxAttempts * interval}ms`));
      } else {
        setTimeout(check, interval);
      }
    };

    check();
  });
}

// -----------------------------------------------------------------------------
// 6. Child Process Management & Graceful Exit
// -----------------------------------------------------------------------------
let backendProcess = null;
let frontendProcess = null;
let isShuttingDown = false;

function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('\n');
  log('SHUTDOWN', `Received ${signal || 'exit'}. Gracefully terminating VOLQ services...`, colors.yellow);

  if (frontendProcess) {
    try {
      frontendProcess.kill('SIGTERM');
    } catch (e) {}
  }
  if (backendProcess) {
    try {
      backendProcess.kill('SIGTERM');
    } catch (e) {}
  }

  setTimeout(() => {
    log('SHUTDOWN', 'All services stopped. Goodbye.', colors.green);
    process.exit(0);
  }, 1000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGHUP', () => shutdown('SIGHUP'));

// -----------------------------------------------------------------------------
// 7. Start Services
// -----------------------------------------------------------------------------
async function start() {
  const backendTarget = resolveBackendCommand();
  const backendCwd = path.join(__dirname, 'backend');

  log('BACKEND', `Spawning backend service on port ${backendPort}...`, colors.cyan);

  const backendEnv = {
    ...process.env,
    PORT: String(backendPort),
    ENV: isDev ? 'development' : 'production',
  };

  backendProcess = spawn(backendTarget.cmd, backendTarget.args, {
    cwd: backendCwd,
    env: backendEnv,
    stdio: ['inherit', 'pipe', 'pipe']
  });

  backendProcess.stdout.on('data', (chunk) => {
    const lines = chunk.toString().trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) log('VOLQ-API', line.trim(), colors.cyan);
    });
  });

  backendProcess.stderr.on('data', (chunk) => {
    const lines = chunk.toString().trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) log('VOLQ-API', line.trim(), colors.yellow);
    });
  });

  backendProcess.on('error', (err) => {
    logError('BACKEND', `Backend process failed to start: ${err.message}`);
  });

  backendProcess.on('exit', (code, sig) => {
    if (!isShuttingDown) {
      logError('BACKEND', `Backend process unexpectedly exited with code ${code} (signal ${sig})`);
      shutdown();
    }
  });

  // Wait for backend to be ready
  log('RUNNER', `Waiting for backend API on port ${backendPort}...`, colors.cyan);
  try {
    await waitForBackend(backendPort);
    log('BACKEND', `Backend is healthy and listening on 127.0.0.1:${backendPort}`, colors.green);
  } catch (err) {
    log('RUNNER', `Warning: ${err.message}. Proceeding with frontend startup...`, colors.yellow);
  }

  // Prepare & Launch Frontend
  ensureFrontendReady();

  const frontendDir = path.join(__dirname, 'frontend');
  log('FRONTEND', `Starting Next.js frontend on public port ${publicPort}...`, colors.magenta);

  const frontendEnv = {
    ...process.env,
    PORT: String(publicPort),
    INTERNAL_API_URL: `http://127.0.0.1:${backendPort}`,
    NEXT_PUBLIC_API_URL: '', // Use relative /api/v1 so Next.js proxies seamlessly
    NODE_ENV: isDev ? 'development' : 'production'
  };

  const nextBin = getNextBinPath();
  const frontendArgs = isDev
    ? [nextBin, 'dev', '-p', String(publicPort)]
    : [nextBin, 'start', '-p', String(publicPort)];

  frontendProcess = spawn(process.execPath, frontendArgs, {
    cwd: frontendDir,
    env: frontendEnv,
    stdio: ['inherit', 'pipe', 'pipe']
  });

  frontendProcess.stdout.on('data', (chunk) => {
    const lines = chunk.toString().trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) log('VOLQ-WEB', line.trim(), colors.magenta);
    });
  });

  frontendProcess.stderr.on('data', (chunk) => {
    const lines = chunk.toString().trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) log('VOLQ-WEB', line.trim(), colors.yellow);
    });
  });

  frontendProcess.on('error', (err) => {
    logError('FRONTEND', `Frontend process failed to start: ${err.message}`);
  });

  frontendProcess.on('exit', (code, sig) => {
    if (!isShuttingDown) {
      logError('FRONTEND', `Frontend process exited with code ${code} (signal ${sig})`);
      shutdown();
    }
  });

  log('RUNNER', `✨ VOLQ-Auth is live! Open http://localhost:${publicPort} (or your server IP:${publicPort})`, colors.green);
}

start().catch((err) => {
  logError('RUNNER', `Fatal startup error: ${err.stack || err.message}`);
  shutdown();
});
