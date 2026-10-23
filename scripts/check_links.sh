#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "=== Verifying Documentation Internal Links ==="

broken=0
total=0

while IFS= read -r mdfile; do
  dir="$(dirname "$mdfile")"
  
  # Extract relative links like [text](relative/path.md)
  # Ignore external links (http://, https://, mailto:)
  links=$(grep -oE '\[[^]]+\]\(([^)#]+)(#[^)]+)?\)' "$mdfile" | sed -E 's/.*\]\(([^)#]+)(#[^)]+)?\)/\1/' | grep -vE '^(http|https|mailto|file):' || true)

  for link in $links; do
    # Skip empty or anchor-only
    [ -z "$link" ] && continue

    total=$((total + 1))
    target="$dir/$link"

    if [ ! -e "$target" ] && [ ! -e "$ROOT_DIR/$link" ]; then
      echo "  [BROKEN LINK] in $mdfile -> $link"
      broken=$((broken + 1))
    fi
  done
done < <(find docs -name "*.md"; find . -maxdepth 1 -name "*.md" -o -name "llms.txt")

echo "=== Scanned $total links ==="

if [ "$broken" -gt 0 ]; then
  echo "  [FAIL] Found $broken broken relative links!"
  exit 1
else
  echo "  [OK] Zero broken internal links found."
fi
