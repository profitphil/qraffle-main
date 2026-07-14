#!/bin/sh
# Commit, push, build, and deploy to Netlify production in one step.
# Usage: npm run ship -- "commit message"
set -e

MSG="${1:-update}"

if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -m "$MSG"
fi

git push
npm run build
netlify deploy --prod --dir=dist
