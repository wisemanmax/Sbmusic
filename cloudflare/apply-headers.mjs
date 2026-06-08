#!/usr/bin/env node
// Apply SLIME BY's security headers to Cloudflare as a Response Header Transform Rule.
//
// WHY THIS EXISTS
//   When Cloudflare's free plan sits *in front of* GitHub Pages (proxy / orange cloud),
//   the repo's `_headers` file does NOT apply — that file is only honoured by Cloudflare
//   Pages / Netlify, not by a reverse proxy in front of another origin. GitHub Pages also
//   ignores it. So the security headers have to be re-expressed as a Cloudflare
//   "Modify Response Header" Transform Rule. This script builds that rule straight from
//   `vercel.json` (the single source of truth for the header set) so the two never drift.
//
// USAGE
//   # 1. Preview — prints the API payload + a paste-ready list for the dashboard.
//   #    No token needed. This is the default when CF_API_TOKEN is unset.
//   node cloudflare/apply-headers.mjs --dry-run
//
//   # 2. Apply for real — creates/replaces the response-header ruleset via the CF API.
//   export CF_API_TOKEN=...      # token with Zone > Transform Rules > Edit on the zone
//   export CF_ZONE_ID=...        # Cloudflare dashboard → your domain → Overview (API section)
//   node cloudflare/apply-headers.mjs
//
// SAFETY
//   The script PUTs the *entrypoint* ruleset for the http_response_headers_transform phase,
//   which replaces whatever response-header transform rules exist with the ones derived here.
//   It does not touch DNS, SSL, request-header rules, redirects, or any other phase. Run
//   --dry-run first and read the payload.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const VERCEL_JSON = join(HERE, '..', 'vercel.json');
const PHASE = 'http_response_headers_transform';
const API = 'https://api.cloudflare.com/client/v4';

// Map a vercel.json `source` (a path regex) onto a Cloudflare rule expression.
// We only translate the patterns this repo actually uses; anything else is skipped
// loudly rather than guessed at, so a future vercel.json change can't silently
// produce a wrong rule.
function sourceToExpression(source) {
  if (source === '/(.*)') return 'true'; // every request
  if (source === '/assets/(.*).mp3') return 'ends_with(http.request.uri.path, ".mp3")';
  return null;
}

function shortLabel(source) {
  if (source === '/(.*)') return 'all responses';
  return source;
}

async function buildRules() {
  let raw;
  try {
    raw = JSON.parse(await readFile(VERCEL_JSON, 'utf8'));
  } catch (err) {
    throw new Error(`Could not read/parse ${VERCEL_JSON}: ${err.message}`);
  }
  const groups = Array.isArray(raw.headers) ? raw.headers : [];
  if (!groups.length) throw new Error('vercel.json has no "headers" entries to translate.');

  const rules = [];
  for (const group of groups) {
    const expression = sourceToExpression(group.source);
    if (expression === null) {
      console.warn(`! skipping unmapped vercel.json source "${group.source}" ` +
        `(add a translation in sourceToExpression() if you want it on Cloudflare)`);
      continue;
    }
    const headers = {};
    for (const { key, value } of group.headers ?? []) {
      headers[key] = { operation: 'set', value };
    }
    if (!Object.keys(headers).length) continue;
    rules.push({
      action: 'rewrite',
      action_parameters: { headers },
      expression,
      description: `SLIME BY headers — ${shortLabel(group.source)} (managed by cloudflare/apply-headers.mjs)`,
      enabled: true,
    });
  }
  if (!rules.length) throw new Error('Nothing to apply — no vercel.json sources could be translated.');
  return rules;
}

function printDashboardHelp(rules) {
  console.log('\nDashboard route (no API token):');
  console.log('  Rules → Transform Rules → Modify Response Header → Create rule.');
  for (const rule of rules) {
    const when = rule.expression === 'true'
      ? 'When: all incoming requests'
      : `When (Edit expression): ${rule.expression}`;
    console.log(`\n  • ${when}`);
    console.log('    Then → Set static, one action per header:');
    for (const [name, { value }] of Object.entries(rule.action_parameters.headers)) {
      console.log(`      ${name}: ${value}`);
    }
  }
  console.log('');
}

async function apply(rules, { zoneId, token }) {
  const url = `${API}/zones/${zoneId}/rulesets/phases/${PHASE}/entrypoint`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ rules }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    const errs = (body.errors ?? []).map((e) => `${e.code} ${e.message}`).join('; ');
    throw new Error(`Cloudflare API ${res.status}: ${errs || JSON.stringify(body)}`);
  }
  return body.result;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const token = process.env.CF_API_TOKEN;
  const zoneId = process.env.CF_ZONE_ID;
  const dryRun = args.has('--dry-run') || !token;

  const rules = await buildRules();

  console.log(`Built ${rules.length} response-header rule(s) from vercel.json:\n`);
  console.log(JSON.stringify({ rules }, null, 2));

  if (dryRun) {
    if (!token) console.log('\n(no CF_API_TOKEN set → preview only)');
    printDashboardHelp(rules);
    console.log('Nothing was applied. Set CF_API_TOKEN + CF_ZONE_ID and re-run without --dry-run to push.');
    return;
  }
  if (!zoneId) throw new Error('CF_ZONE_ID is required to apply (Cloudflare dashboard → domain → Overview).');

  console.log(`\nApplying to zone ${zoneId} …`);
  const result = await apply(rules, { zoneId, token });
  console.log(`✓ Done. Ruleset "${result?.name ?? PHASE}" now has ${result?.rules?.length ?? rules.length} rule(s).`);
  console.log('Verify:  curl -sI https://slimeby.com | grep -i -E "content-security-policy|strict-transport|x-content-type"');
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}`);
  process.exit(1);
});
