'use strict';

const { spawn } = require('child_process');
const { createWriteStream, mkdirSync } = require('fs');
const { join } = require('path');

const LOGS_DIR = join(__dirname, '../../logs');
const ROLL_MS = 24 * 60 * 60 * 1000;

mkdirSync(LOGS_DIR, { recursive: true });

function logFilePath() {
  const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  return join(LOGS_DIR, `frontend_${ts}.log`);
}

let fileStream = createWriteStream(logFilePath(), { flags: 'a' });

const timer = setInterval(() => {
  const old = fileStream;
  fileStream = createWriteStream(logFilePath(), { flags: 'a' });
  old.end();
}, ROLL_MS);
timer.unref();

const proc = spawn('npm', ['run', '_dev'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true,
  cwd: join(__dirname, '..'),
});

function write(chunk) {
  process.stdout.write(chunk);
  fileStream.write(chunk);
}

proc.stdout.on('data', write);
proc.stderr.on('data', write);

proc.on('exit', (code) => {
  clearInterval(timer);
  fileStream.end(() => process.exit(code ?? 0));
});
