#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const lintTmpDir = path.join(projectRoot, '.lint-tmp');

const globalNodeModules = path.join(path.resolve(process.execPath, '..', '..'), 'lib', 'node_modules');
const moduleSearchPaths = [projectRoot, globalNodeModules];

function resolveFromSearchPaths(moduleName) {
  for (const basePath of moduleSearchPaths) {
    try {
      return require.resolve(moduleName, { paths: [basePath] });
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') {
        throw error;
      }
    }
  }
  throw new Error(`Cannot find module "${moduleName}". Install it locally or make sure it is available globally.`);
}

const ts = require(resolveFromSearchPaths('typescript'));

const skipDirectoryNames = new Set([
  '.git',
  '.lint-tmp',
  'dist',
  'build',
  'coverage',
  '.next',
  '.output',
  '.turbo',
  '.vercel',
  'node_modules',
]);

const skipDirectoryPaths = new Set([
  path.join('supabase', '.branches'),
]);

async function removeDirectory(targetPath) {
  await fs.rm(targetPath, { recursive: true, force: true });
}

async function ensureDirectory(targetPath) {
  await fs.mkdir(targetPath, { recursive: true });
}

async function* walkFiles(currentDir) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      if (skipDirectoryNames.has(entry.name)) {
        continue;
      }
      const relativePath = path.relative(projectRoot, entryPath);
      if (skipDirectoryPaths.has(relativePath)) {
        continue;
      }
      yield* walkFiles(entryPath);
    } else if (entry.isFile()) {
      yield entryPath;
    }
  }
}

function shouldProcessFile(filePath) {
  if (filePath.endsWith('.d.ts')) {
    return false;
  }
  const ext = path.extname(filePath).toLowerCase();
  return ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext);
}

function outputFilePath(originalPath) {
  const relativePath = path.relative(projectRoot, originalPath);
  const targetRelative = relativePath.replace(/\.[cm]?tsx?$/, '.js');
  return path.join(lintTmpDir, targetRelative);
}

async function writeTranspiledFile(sourcePath) {
  const destinationPath = outputFilePath(sourcePath);
  await ensureDirectory(path.dirname(destinationPath));
  const sourceText = await fs.readFile(sourcePath, 'utf8');
  const ext = path.extname(sourcePath).toLowerCase();
  let outputText = sourceText;
  if (ext === '.ts' || ext === '.tsx') {
    const transpileOptions = {
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext,
        jsx: ext === '.tsx' ? ts.JsxEmit.ReactJSX : ts.JsxEmit.None,
        esModuleInterop: true,
        allowJs: true,
        sourceMap: false,
        inlineSourceMap: false,
        declaration: false,
        removeComments: false,
        importHelpers: false,
        importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      },
      fileName: sourcePath,
      reportDiagnostics: false,
    };
    try {
      const result = ts.transpileModule(sourceText, transpileOptions);
      outputText = result.outputText;
    } catch (error) {
      error.message = `Failed to transpile ${path.relative(projectRoot, sourcePath)}: ${error.message}`;
      throw error;
    }
  }
  await fs.writeFile(destinationPath, outputText, 'utf8');
}

async function prepareLintWorkspace() {
  await removeDirectory(lintTmpDir);
  await ensureDirectory(lintTmpDir);
  for await (const filePath of walkFiles(projectRoot)) {
    if (!shouldProcessFile(filePath)) {
      continue;
    }
    await writeTranspiledFile(filePath);
  }
}

function runEslint() {
  const eslintBinary = 'eslint';
  const eslintConfigPath = path.join(projectRoot, 'eslint.offline.config.js');
  const args = ['--config', eslintConfigPath, '--ext', '.js,.jsx', lintTmpDir];
  const result = spawnSync(eslintBinary, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_NO_WARNINGS: '1',
    },
  });
  return result.status ?? (result.error ? 1 : 0);
}

try {
  await prepareLintWorkspace();
  const statusCode = runEslint();
  await removeDirectory(lintTmpDir);
  if (statusCode !== 0) {
    process.exit(statusCode);
  }
} catch (error) {
  await removeDirectory(lintTmpDir).catch(() => {});
  console.error('[lint] Unexpected error:', error);
  process.exit(1);
}
