#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

required_files=(
  README.md
  ROADMAP.md
  CONTRIBUTING.md
  SECURITY.md
  CODE_OF_CONDUCT.md
  LICENSE
  docs/architecture.md
  docs/platforms.md
  protocol/README.md
  protocol/v1/session.schema.json
  protocol/v1/examples/session-offer.json
  protocol/v1/validate-session.mjs
)

for file in "${required_files[@]}"; do
  test -s "$file" || { echo "missing or empty: $file" >&2; exit 1; }
done

command -v node >/dev/null 2>&1 || { echo "node is required for JSON checks" >&2; exit 1; }

node - <<'NODE'
const assert = require('node:assert/strict');
const fs = require('node:fs');
const schemaPath = 'protocol/v1/session.schema.json';
const examplePath = 'protocol/v1/examples/session-offer.json';
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const example = JSON.parse(fs.readFileSync(examplePath, 'utf8'));

assert.equal(schema.properties.protocol.const, 'spartan-gaming/1');
for (const required of schema.required) assert.ok(required in example, `${required} is required`);
assert.equal(example.protocol, schema.properties.protocol.const);
assert.match(example.messageId, new RegExp(schema.properties.messageId.pattern));
assert.match(example.sessionId, new RegExp(schema.properties.sessionId.pattern));
assert.ok(schema.properties.type.enum.includes(example.type));
assert.match(example.sentAt, /^\d{4}-\d{2}-\d{2}T.*Z$/);
assert.equal(typeof example.payload, 'object');

console.log(`valid JSON and protocol contract: ${schemaPath}`);
console.log(`valid JSON and protocol contract: ${examplePath}`);
NODE

node protocol/v1/validate-session.mjs protocol/v1/examples/session-offer.json

if command -v git >/dev/null 2>&1; then
  if git ls-files -z | grep -E -z '(^|/)(\.env|.*\.(pem|key))$' >/dev/null; then
    echo "credential-like file tracked by git" >&2
    exit 1
  fi
fi

echo "repository checks passed"
