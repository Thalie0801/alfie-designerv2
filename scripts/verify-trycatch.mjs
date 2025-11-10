import { execSync } from 'node:child_process';

const patterns = [
  { name: 'catch-without-brace', rg: String.raw`catch\s*\([^)]*\)\s*\)(?!\s*\{)` },
  { name: 'try-callback-close-then-code', rg: String.raw`try\s*\{[\s\S]*?\}\);\s*\n\s*(if|await|const|let|var|return|throw)` },
];

let failed = false;

for (const pattern of patterns) {
  try {
    const command = `rg -nUP "${pattern.rg}" --glob '!node_modules' --glob '!dist'`;
    const output = execSync(command, { stdio: 'pipe' }).toString().trim();
    if (output) {
      failed = true;
      console.log(`\n[verify:${pattern.name}] Offending lines:\n${output}\n`);
    }
  } catch (error) {
    if (error.status !== 1) {
      console.error(`\n[verify:${pattern.name}] Failed to run ripgrep:\n${error.message}\n`);
      failed = true;
    }
  }
}

if (failed) {
  console.error('\n❌ verify:trycatch failed. Fix the lines above.\n');
  process.exit(1);
}

console.log('✅ verify:trycatch passed.');
