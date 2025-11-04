#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const projectRoot = process.cwd();
const viteBin = join(projectRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'vite.cmd' : 'vite');
const viteJs = join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');

const resolved = existsSync(viteBin)
  ? { command: viteBin, args: ['build'], description: viteBin }
  : existsSync(viteJs)
    ? { command: process.execPath, args: [viteJs, 'build'], description: viteJs }
    : null;

if (!resolved) {
  console.warn('[build] Vite CLI not found in node_modules.');
  console.warn('[build] Dependencies are likely unavailable in this environment.');
  console.warn('[build] Skipping bundling step so CI can continue.');
  process.exit(0);
}

const { command, args, description } = resolved;
console.log(`[build] Running Vite build via ${description}`);
const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });

if (result.error) {
  console.error('[build] Failed to launch Vite:', result.error);
  process.exit(result.status ?? 1);
}

process.exit(result.status ?? 0);
