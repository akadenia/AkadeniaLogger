#!/bin/bash
set -euo pipefail
echo "Checking required tools and env vars..."
command -v jq >/dev/null 2>&1 || { echo "ERROR: jq not found"; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "ERROR: curl not found"; exit 1; }
[ -n "${GH_TOKEN:-}" ] || { echo "ERROR: GH_TOKEN not set"; exit 1; }
echo "Preflight checks passed."
