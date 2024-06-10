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

# Configure git
git config user.name 'Akadenia' 
git config user.email 'auto@akadenia.com'

# Checkout to a new branch
git checkout -b $BRANCH_NAME

# Commit changes
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore(release): add release assets from $VERSION"

# Push branch to the remote
git push origin $BRANCH_NAME

