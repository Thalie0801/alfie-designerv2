#!/usr/bin/env bash
set -euo pipefail
shopt -s nullglob
for f in .github/workflows/*.yml .github/workflows/*.yaml; do
  awk '
    /^\s*-\s+name:\s*/ {
      if (in_step && run_count>1) { printf("ERROR %s: step \"%s\" contient %d run:\n", FILENAME, step_name, run_count) }
      in_step=1; run_count=0; step_name=$0; next
    }
    in_step && /^\s*run:\s*/ { run_count++ }
    END {
      if (in_step && run_count>1) { printf("ERROR %s: step \"%s\" contient %d run:\n", FILENAME, step_name, run_count) }
    }
  ' "$f"
done
