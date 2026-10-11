#!/usr/bin/env bash
# Publish the CURRENT branch to the separate preview site (never touches the live site).
# https://gjay11811-png.github.io/pumpchad-preview/
set -e
cd "$(dirname "$0")/.."
rm -rf dist-preview
MSYS_NO_PATHCONV=1 npx vite build --base=/pumpchad-preview/ --outDir dist-preview
for f in dist-preview/index.html dist-preview/chadverse/index.html; do
  sed -i 's#<head>#<head>\n    <meta name="robots" content="noindex, nofollow" />#' "$f"
done
touch dist-preview/.nojekyll
cd dist-preview
git init -q -b gh-pages
git add -A
git commit -q -m "Chadverse dev preview $(date -u +%Y-%m-%dT%H:%M)"
git push -q -f https://github.com/gjay11811-png/pumpchad-preview.git gh-pages
rm -rf .git
