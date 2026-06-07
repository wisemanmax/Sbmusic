#!/bin/bash
set -euo pipefail

# Only needed in Claude Code on the web (remote) sessions; local machines manage their own setup.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Install JS dev dependencies (Playwright) for the e2e suite.
# npm install (not ci) so the cached container layer is reused on later starts.
npm install

# Make sure the Chromium build Playwright drives is present. Don't fail the whole
# session if the browser CDN is unreachable — npm deps + JS lint still work and the
# e2e suite can run once a browser is available.
npx --yes playwright install chromium || echo "session-start: chromium download unavailable; 'npm run test:e2e' needs it" >&2

echo "session-start: deps ready (run 'npm test' for lint + e2e)" >&2
