#!/bin/bash
set -e

VERSION=$1
BRANCH_NAME="release/$VERSION"

# CI script to commit release assets to the main branch after semantic release

# if CI env variable is not set to true exit
if [ -z "$CI" ]; then
  echo "We are not in the CI environment, exiting..."
  exit 1
fi

if [ -z "$VERSION" ]; then
  echo "No release version provided, exiting..."
  exit 1
fi

if [ -z "$GH_TOKEN" ]; then
  echo "GH_TOKEN is not set, exiting..."
  exit 1
fi

# Configure git
git config user.name 'Akadenia'
git config user.email 'auto@akadenia.com'

# Checkout to a new branch
git checkout -b "$BRANCH_NAME"

# Commit changes
git add package.json pnpm-lock.yaml CHANGELOG.md
git commit -m "chore(release): add release assets from $VERSION"

# Push branch to the remote using ephemeral token auth (does not persist in .git/config)
git push "https://x-access-token:${GH_TOKEN}@github.com/${CIRCLE_PROJECT_USERNAME}/${CIRCLE_PROJECT_REPONAME}.git" "$BRANCH_NAME"

# Create release PR
PAYLOAD=$(jq -n \
  --arg title "chore(release): ${VERSION} assets" \
  --arg head "$BRANCH_NAME" \
  --arg base "main" \
  --arg body "Automated release assets for ${VERSION}. Merging this will update \`package.json\`, \`pnpm-lock.yaml\`, and \`CHANGELOG.md\` on main." \
  '{title: $title, head: $head, base: $base, body: $body}')

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer ${GH_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${CIRCLE_PROJECT_USERNAME}/${CIRCLE_PROJECT_REPONAME}/pulls" \
  -d "$PAYLOAD")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "201" ]; then
  PR_URL=$(echo "$BODY" | jq -r '.html_url')
  echo "Release PR created: $PR_URL"
elif [ "$HTTP_CODE" = "422" ] && echo "$BODY" | grep -qi "pull request already exists"; then
  echo "Release PR already exists — skipping."
else
  echo "PR creation failed (HTTP $HTTP_CODE): $BODY"
  exit 1
fi
