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
  .github/workflows/repository-checks.yml
  .github/workflows/cross-platform-contracts.yml
  docs/architecture.md
  docs/platforms.md
  signaling/README.md
  signaling/broker.mjs
  signaling/broker.test.mjs
  signaling/agent.mjs
  signaling/agent.test.mjs
  signaling/agent.mjs
  chromium/README.md
  chromium/build-manifest.json
  chromium/config.mjs
  chromium/args/linux.gn
  chromium/args/mac.gn
  chromium/args/windows.gn
  scripts/chromium/check-environment.mjs
  scripts/chromium/config.test.mjs
  scripts/chromium/build.mjs
  scripts/chromium/build.test.mjs
  protocol/README.md
  protocol/v1/session.schema.json
  protocol/v1/examples/session-offer.json
  protocol/v1/validate-session.mjs
  docs/provider-support.md
  docs/emulation-support.md
  docs/host-support.md
  host/agent.mjs
  host/agent.integration.test.mjs
  host/process.mjs
  host/process.integration.test.mjs
  host/native-media.mjs
  host/native-media.integration.test.mjs
  host/publisher.integration.test.mjs
  host/webrtc.mjs
  host/webrtc.test.mjs
  signaling/agent.integration.test.mjs
  host/README.md
  host/pairing.mjs
  host/pairing.test.mjs
  host/signaling.mjs
  host/signaling.test.mjs
  host/session.mjs
  host/session.test.mjs
  host/capabilities.mjs
  host/capabilities.test.mjs
  host/adapters.mjs
  host/adapters.test.mjs
  host/environment.mjs
  host/environment.test.mjs
  host/media.mjs
  host/media.test.mjs
  host/publisher.mjs
  host/publisher.test.mjs
  host/input.mjs
  host/input.test.mjs
  host/audio.mjs
  host/audio.test.mjs
  docs/transport.md
  docs/deployment.md
  docker/signaling.Dockerfile
  docker-compose.yml
  scripts/deployment.test.mjs
  scripts/issue-signaling-ticket.mjs
  scripts/signaling-ticket.test.mjs
  providers/catalog.json
  emulators/catalog.json
  package.json
  src/frontend/catalog.mjs
  src/frontend/catalog.test.mjs
  src/frontend/dashboard/routes.mjs
  src/frontend/dashboard/routes.test.mjs
  src/frontend/dashboard/resume.mjs
  src/frontend/dashboard/resume.test.mjs
  src/frontend/dashboard/index.html
  src/frontend/dashboard/dashboard.css
  src/frontend/dashboard/dashboard.mjs
  src/frontend/launch/intent.mjs
  src/frontend/launch/intent.test.mjs
  src/frontend/launch/history.mjs
  src/frontend/launch/history.test.mjs
  src/frontend/settings/profile.mjs
  src/frontend/settings/profile.test.mjs
  src/frontend/settings/runtime-ui.mjs
  src/frontend/settings/runtime-ui.test.mjs
  src/frontend/session/preferences.mjs
  src/frontend/session/preferences.test.mjs
  src/frontend/input/policy.mjs
  src/frontend/input/policy.test.mjs
  src/frontend/input/haptics.mjs
  src/frontend/input/haptics.test.mjs
  src/frontend/input/pointer.mjs
  src/frontend/input/pointer.test.mjs
  src/frontend/host/readiness.mjs
  src/frontend/host/readiness.test.mjs
  src/frontend/session/session.mjs
  src/frontend/session/session.test.mjs
  src/frontend/session/quality.mjs
  src/frontend/session/quality.test.mjs
  src/frontend/session/recovery.mjs
  src/frontend/session/recovery.test.mjs
  src/frontend/session/runtime.mjs
  src/frontend/session/runtime.test.mjs
  src/frontend/session/telemetry.mjs
  src/frontend/session/telemetry.test.mjs
  src/frontend/input/input.mjs
  src/frontend/input/input.test.mjs
  src/frontend/adapters/adapters.mjs
  src/frontend/adapters/adapters.test.mjs
  src/frontend/host/host.mjs
  src/frontend/host/host.test.mjs
  src/frontend/host/index.html
  src/frontend/host/host.css
  src/frontend/host/host-page.mjs
  src/frontend/host/browser-publisher.mjs
  src/frontend/host/browser-publisher.test.mjs
  src/frontend/host/browser-host-runtime.mjs
  src/frontend/host/browser-host-runtime.test.mjs
  src/frontend/host/browser-studio.html
  src/frontend/host/browser-studio.css
  src/frontend/host/browser-studio.mjs
  src/frontend/host/browser-studio.test.mjs
  src/frontend/player/index.html
  src/frontend/player/player.css
  src/frontend/player/player.mjs
  src/frontend/player/player-state.mjs
  src/frontend/player/player-state.test.mjs
  src/frontend/player/transport-config.mjs
  src/frontend/player/transport-config.test.mjs
  src/frontend/player/media.mjs
  src/frontend/player/media.test.mjs
  src/frontend/player/connection.mjs
  src/frontend/player/connection.test.mjs
  src/frontend/player/immersive.mjs
  src/frontend/player/immersive.test.mjs
  src/frontend/workspaces/workspaces.mjs
  src/frontend/workspaces/workspaces.test.mjs
  src/frontend/workspaces/index.html
  src/frontend/workspaces/workspaces.css
  src/frontend/workspaces/workspaces-page.mjs
  src/frontend/pwa/cache.mjs
  src/frontend/pwa/cache.test.mjs
  src/frontend/pwa/service-worker.mjs
  src/frontend/pwa/register.mjs
  src/frontend/service-worker.mjs
  src/frontend/pwa/manifest.webmanifest
  src/frontend/input/profiles.mjs
  src/frontend/input/profiles.test.mjs
  src/frontend/input/profiles.html
  src/frontend/input/profiles.css
  src/frontend/input/profiles-page.mjs
  src/frontend/input/inspector.mjs
  src/frontend/input/inspector.test.mjs
  src/frontend/input/inspector.html
  src/frontend/input/inspector.css
  src/frontend/input/inspector-page.mjs
  src/frontend/input/navigation.mjs
  src/frontend/input/navigation.test.mjs
  src/frontend/compatibility/harness.mjs
  src/frontend/compatibility/harness.test.mjs
  src/frontend/providers/profiles.mjs
  src/frontend/providers/profiles.test.mjs
  src/frontend/providers/integration.mjs
  src/frontend/providers/integration.test.mjs
  src/frontend/providers/index.html
  src/frontend/providers/profiles.css
  src/frontend/providers/profiles-page.mjs
  src/frontend/diagnostics/capabilities.mjs
  src/frontend/diagnostics/capabilities.test.mjs
  src/frontend/diagnostics/focus.mjs
  src/frontend/diagnostics/focus.test.mjs
  src/frontend/diagnostics/index.html
  src/frontend/diagnostics/diagnostics.css
  src/frontend/diagnostics/diagnostics.mjs
  src/frontend/transport/transport.mjs
  src/frontend/transport/transport.test.mjs
  src/frontend/transport/ice.mjs
  src/frontend/transport/ice.test.mjs
  src/frontend/transport/policy.mjs
  src/frontend/transport/policy.test.mjs
  src/frontend/capture/capture.mjs
  src/frontend/capture/capture.test.mjs
  src/frontend/emulation/emulation.mjs
  src/frontend/emulation/emulation.test.mjs
  src/frontend/emulation/index.html
  src/frontend/emulation/emulation.css
  src/frontend/emulation/emulation-page.mjs
  src/frontend/emulation/integration.mjs
  src/frontend/emulation/integration.test.mjs
  src/frontend/settings/index.html
  src/frontend/settings/settings.css
  src/frontend/settings/settings.mjs
  src/frontend/settings/settings-data.mjs
  src/frontend/settings/settings.test.mjs
  src/frontend/settings/actions.mjs
  src/frontend/settings/actions.test.mjs
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
const providerCatalogPath = 'providers/catalog.json';
const emulatorCatalogPath = 'emulators/catalog.json';
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const example = JSON.parse(fs.readFileSync(examplePath, 'utf8'));
const providerCatalog = JSON.parse(fs.readFileSync(providerCatalogPath, 'utf8'));
const emulatorCatalog = JSON.parse(fs.readFileSync(emulatorCatalogPath, 'utf8'));

assert.equal(schema.properties.protocol.const, 'spartan-gaming/1');
for (const required of schema.required) assert.ok(required in example, `${required} is required`);
assert.equal(example.protocol, schema.properties.protocol.const);
assert.match(example.messageId, new RegExp(schema.properties.messageId.pattern));
assert.match(example.sessionId, new RegExp(schema.properties.sessionId.pattern));
assert.ok(schema.properties.type.enum.includes(example.type));
assert.match(example.sentAt, /^\d{4}-\d{2}-\d{2}T.*Z$/);
assert.equal(typeof example.payload, 'object');
for (const [name, catalog, minimum] of [
  ['provider', providerCatalog, 5],
  ['emulator', emulatorCatalog, 5],
]) {
  assert.equal(catalog.catalogVersion, 1, `${name} catalog version`);
  assert.ok(Array.isArray(catalog.providers ?? catalog.projects));
  assert.ok((catalog.providers ?? catalog.projects).length >= minimum);
}

console.log(`valid JSON and protocol contract: ${schemaPath}`);
console.log(`valid JSON and protocol contract: ${examplePath}`);
console.log(`valid provider catalog: ${providerCatalogPath}`);
console.log(`valid emulator catalog: ${emulatorCatalogPath}`);
NODE

node protocol/v1/validate-session.mjs protocol/v1/examples/session-offer.json
node --check chromium/config.mjs
node --check scripts/chromium/check-environment.mjs
node --check scripts/chromium/build.mjs
node --check signaling/broker.mjs
node --check signaling/agent.mjs
node --check signaling/agent.mjs
node --check src/frontend/dashboard/dashboard.mjs
node --check src/frontend/dashboard/resume.mjs
node --check src/frontend/session/session.mjs
node --check src/frontend/session/quality.mjs
node --check src/frontend/session/recovery.mjs
node --check src/frontend/session/runtime.mjs
node --check src/frontend/session/telemetry.mjs
node --check src/frontend/input/input.mjs
node --check src/frontend/adapters/adapters.mjs
node --check src/frontend/host/host.mjs
node --check src/frontend/host/host-page.mjs
node --check src/frontend/host/browser-publisher.mjs
node --check src/frontend/host/browser-host-runtime.mjs
node --check src/frontend/host/browser-studio.mjs
node --check host/agent.mjs
node --check host/agent.integration.test.mjs
node --check host/process.mjs
node --check host/process.integration.test.mjs
node --check host/native-media.mjs
node --check host/native-media.integration.test.mjs
node --check host/publisher.integration.test.mjs
node --check signaling/agent.integration.test.mjs
node --check host/pairing.mjs
node --check host/signaling.mjs
node --check host/session.mjs
node --check host/capabilities.mjs
node --check host/adapters.mjs
node --check host/environment.mjs
node --check host/media.mjs
node --check host/publisher.mjs
node --check host/webrtc.mjs
node --check host/webrtc.test.mjs
node --check host/input.mjs
node --check host/audio.mjs
node --check src/frontend/player/player.mjs
node --check src/frontend/player/transport-config.mjs
node --check src/frontend/player/media.mjs
node --check src/frontend/player/connection.mjs
node --check src/frontend/player/immersive.mjs
node --check src/frontend/workspaces/workspaces.mjs
node --check src/frontend/workspaces/workspaces-page.mjs
node --check src/frontend/pwa/cache.mjs
node --check src/frontend/pwa/service-worker.mjs
node --check src/frontend/pwa/register.mjs
node --check src/frontend/player/player-state.mjs
node --check src/frontend/launch/intent.mjs
node --check src/frontend/launch/history.mjs
node --check src/frontend/settings/profile.mjs
node --check src/frontend/settings/runtime-ui.mjs
node --check src/frontend/session/preferences.mjs
node --check src/frontend/input/policy.mjs
node --check src/frontend/input/haptics.mjs
node --check src/frontend/input/pointer.mjs
node --check src/frontend/host/readiness.mjs
node --check src/frontend/input/profiles.mjs
node --check src/frontend/input/profiles-page.mjs
node --check src/frontend/input/inspector.mjs
node --check src/frontend/input/inspector-page.mjs
node --check src/frontend/input/navigation.mjs
node --check src/frontend/compatibility/harness.mjs
node --check src/frontend/providers/profiles.mjs
node --check src/frontend/providers/profiles-page.mjs
node --check src/frontend/providers/integration.mjs
node --check src/frontend/diagnostics/capabilities.mjs
node --check src/frontend/diagnostics/diagnostics.mjs
node --check src/frontend/transport/transport.mjs
node --check src/frontend/transport/ice.mjs
node --check src/frontend/transport/policy.mjs
node --check src/frontend/capture/capture.mjs
node --check src/frontend/emulation/emulation.mjs
node --check src/frontend/emulation/emulation-page.mjs
node --check src/frontend/emulation/integration.mjs
node --test scripts/chromium/config.test.mjs scripts/chromium/build.test.mjs signaling/agent.test.mjs signaling/broker.test.mjs host/signaling.test.mjs host/session.test.mjs host/audio.test.mjs host/input.test.mjs host/publisher.test.mjs host/pairing.test.mjs host/capabilities.test.mjs host/adapters.test.mjs host/environment.test.mjs host/media.test.mjs src/frontend/catalog.test.mjs src/frontend/dashboard/routes.test.mjs src/frontend/launch/intent.test.mjs src/frontend/launch/history.test.mjs src/frontend/settings/profile.test.mjs src/frontend/settings/actions.test.mjs src/frontend/session/preferences.test.mjs src/frontend/input/policy.test.mjs src/frontend/input/haptics.test.mjs src/frontend/input/pointer.test.mjs src/frontend/host/readiness.test.mjs src/frontend/settings/settings.test.mjs src/frontend/session/session.test.mjs src/frontend/session/quality.test.mjs src/frontend/session/recovery.test.mjs src/frontend/session/runtime.test.mjs src/frontend/session/telemetry.test.mjs src/frontend/input/input.test.mjs src/frontend/input/profiles.test.mjs src/frontend/input/inspector.test.mjs src/frontend/input/navigation.test.mjs src/frontend/compatibility/harness.test.mjs src/frontend/providers/integration.test.mjs src/frontend/providers/profiles.test.mjs src/frontend/adapters/adapters.test.mjs src/frontend/host/host.test.mjs src/frontend/player/player-state.test.mjs src/frontend/player/immersive.test.mjs src/frontend/player/media.test.mjs src/frontend/player/transport-config.test.mjs src/frontend/player/connection.test.mjs src/frontend/workspaces/workspaces.test.mjs src/frontend/diagnostics/capabilities.test.mjs src/frontend/diagnostics/focus.test.mjs src/frontend/transport/ice.test.mjs src/frontend/transport/policy.test.mjs src/frontend/transport/transport.test.mjs src/frontend/capture/capture.test.mjs src/frontend/emulation/integration.test.mjs src/frontend/emulation/emulation.test.mjs src/frontend/pwa/cache.test.mjs src/frontend/host/browser-studio.test.mjs

if command -v git >/dev/null 2>&1; then
  if git ls-files -z | grep -E -z '(^|/)(\.env|.*\.(pem|key))$' >/dev/null; then
    echo "credential-like file tracked by git" >&2
    exit 1
  fi
fi

echo "repository checks passed"
