import fs from "node:fs";

const targets = [
  "src/features/studio/ChatGenerator.tsx",
];

let bad = false;

for (const file of targets) {
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, "utf8");
  // heuristique rapide: un "catch" ne doit pas exister en dehors d'un try/finally correctement fermés.
  // on vérifie aussi qu'il n'existe pas 2 tableaux de deps pour le même useCallback (pattern naïf)
  const orphanCatch = /}\s*catch\s*\(/.test(src) && !/try\s*{[\s\S]*}\s*catch\s*\(/.test(src);
  const doubleDeps = /useCallback\([\s\S]*\)\s*,\s*\[[^\]]*]\s*\)\s*;\s*}\s*,\s*\[/.test(src);

  if (orphanCatch || doubleDeps) {
    console.error(`[verify-trycatch] ${file}: orphanCatch=${orphanCatch}, doubleDeps=${doubleDeps}`);
    bad = true;
  }
}

if (bad) process.exit(1);
