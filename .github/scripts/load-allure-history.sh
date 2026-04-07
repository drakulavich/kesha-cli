#!/bin/bash
# Manage Allure report snapshots on gh-pages.
# Keeps last 10 runs under reports/allure/1..10, latest at reports/allure/latest.
# Expects: allure-report/ directory with the current report.
# Outputs: deploy/ directory ready for gh-pages publish.

set -euo pipefail

KEEP=10

# Clone gh-pages to get existing reports
git clone --depth=1 --branch=gh-pages "https://github.com/${GITHUB_REPOSITORY}.git" gh-pages 2>/dev/null || mkdir -p gh-pages

mkdir -p deploy/reports/allure

# Copy existing snapshots
if [ -d "gh-pages/reports/allure" ]; then
  cp -r gh-pages/reports/allure/* deploy/reports/allure/ 2>/dev/null || true
fi

# Find next snapshot number
LATEST=0
for d in deploy/reports/allure/*/; do
  [ -d "$d" ] || continue
  NUM=$(basename "$d")
  [[ "$NUM" =~ ^[0-9]+$ ]] && [ "$NUM" -gt "$LATEST" ] && LATEST=$NUM
done
NEXT=$((LATEST + 1))

# Copy new report as next snapshot
cp -r allure-report "deploy/reports/allure/$NEXT"

# Create redirect index.html pointing to latest
cat > deploy/reports/allure/index.html << EOF
<!DOCTYPE html><meta http-equiv="refresh" content="0;url=$NEXT/index.html">
EOF

# Remove old snapshots beyond KEEP
cd deploy/reports/allure
for d in */; do
  NUM=$(basename "$d")
  [[ "$NUM" =~ ^[0-9]+$ ]] || continue
  if [ "$NUM" -le "$((NEXT - KEEP))" ]; then
    rm -rf "$NUM"
  fi
done
