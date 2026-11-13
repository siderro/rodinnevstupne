#!/bin/bash
# Jednorázové založení repa siderro/rodinnevstupne a zapnutí GitHub Pages.
set -e
cd "$(dirname "$0")/.."

REPO=siderro/rodinnevstupne

if ! gh repo view "$REPO" >/dev/null 2>&1; then
  gh repo create "$REPO" --public --source . --remote origin \
    --description "Kam na výlet, když dětí máte víc než dvě."
fi
git remote get-url origin >/dev/null 2>&1 || git remote add origin "git@github.com:$REPO.git"

# Pages zapnout před pushem, aby první deploy rovnou prošel
gh api -X POST "repos/$REPO/pages" -f build_type=workflow >/dev/null 2>&1 \
  || gh api -X PUT "repos/$REPO/pages" -f build_type=workflow >/dev/null

git push -u origin main
echo "Hotovo: https://github.com/$REPO – web poběží na https://siderro.github.io/rodinnevstupne/"
