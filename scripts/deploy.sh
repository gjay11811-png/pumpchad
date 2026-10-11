#!/usr/bin/env bash
# Build for GitHub Pages and publish dist/ to the gh-pages branch.
set -e
cd "$(dirname "$0")/.."
MSYS_NO_PATHCONV=1 npx vite build --base=/pumpchad/
touch dist/.nojekyll
cd dist
git init -q -b gh-pages
git add -A
git commit -q -m "Deploy $(date -u +%Y-%m-%dT%H:%M)"
git push -f "$(git -C .. remote get-url origin)" gh-pages
rm -rf .git
