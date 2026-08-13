import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import './deployment/production-rollout.test.mjs';
import './deployment/production-preflight.test.mjs';

const dockerfile = fs.readFileSync('docker/signaling.Dockerfile', 'utf8');
const compose = fs.readFileSync('docker-compose.yml', 'utf8');
const productionCompose = fs.readFileSync('docker-compose.production.yml', 'utf8');
const nativeRollout = fs.readFileSync('.github/workflows/native-package-rollout.yml', 'utf8');
const productionRollout = fs.readFileSync('.github/workflows/production-rollout.yml', 'utf8');
const hostService = fs.readFileSync('deploy/host/spartan-host.service', 'utf8');
const turnService = fs.readFileSync('deploy/turn/coturn.service', 'utf8');
const macHostPlist = fs.readFileSync('deploy/host/macos/com.spartan.gaming.host.plist', 'utf8');
const windowsHostReadme = fs.readFileSync('deploy/host/windows/README.md', 'utf8');
const dockerignore = fs.readFileSync('.dockerignore', 'utf8');
const dockerignoreEntries = new Set(
  dockerignore.split(/\r?\n/u).map((entry) => entry.trim()).filter(Boolean),
);

test('signaling image is minimal, non-root, and health checked', () => {
  assert.match(dockerfile, /^FROM node:22-bookworm-slim/m);
  assert.match(dockerfile, /COPY signaling \.\/signaling/);
  assert.match(dockerfile, /COPY docker\/signaling-healthcheck\.mjs/);
  assert.match(dockerfile, /COPY src\/frontend\/host \.\/src\/frontend\/host/);
  assert.match(dockerfile, /COPY src\/frontend\/(session|transport)/);
  assert.match(dockerfile, /^USER node$/m);
  assert.match(dockerfile, /HEALTHCHECK/);
  assert.match(dockerfile, /ENTRYPOINT \["node", "signaling\/agent\.mjs"\]/);
  assert.match(dockerfile, /"--bind", "0\.0\.0\.0"/);
});

test('Compose keeps the reference signaling service local and requires a secret', () => {
  assert.match(compose, /SPARTAN_SIGNALING_SECRET: \$\{SPARTAN_SIGNALING_SECRET:\?Set /);
  assert.match(compose, /SPARTAN_SIGNALING_ALLOWED_ORIGINS/);
  assert.match(compose, /SPARTAN_SIGNALING_MAX_MESSAGES_PER_SECOND/);
  assert.match(compose, /127\.0\.0\.1:8790:8790/);
  assert.match(compose, /read_only: true/);
  assert.match(compose, /cap_drop:\s*\n\s*- ALL/);
  assert.match(compose, /no-new-privileges:true/);
});

test('Docker build context excludes secrets and local build artifacts', () => {
  for (const entry of ['.git', '.env*', '*.pem', '*.key', 'node_modules', 'out'])
    assert.ok(dockerignoreEntries.has(entry), `missing Docker ignore entry: ${entry}`);
});

test('production preflight is part of the published deployment surface', () => {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.equal(
    packageJson.scripts['deployment:check'],
    'node scripts/validate-production-config.mjs',
  );
  assert.equal(
    packageJson.scripts['deployment:preflight'],
    'node scripts/deployment/production-preflight.mjs',
  );
  assert.equal(
    packageJson.scripts['deployment:tls-check'],
    'node scripts/deployment/tls-rotation.mjs',
  );
  assert.equal(
    packageJson.scripts['deployment:turn-config'],
    'node scripts/deployment/turn-relay.mjs',
  );
  assert.match(
    fs.readFileSync('scripts/deployment/tls-rotation.mjs', 'utf8'),
    /rotateTlsCertificatePair/,
  );
  assert.match(
    fs.readFileSync('scripts/validate-production-config.mjs', 'utf8'),
    /resolveProductionConfig/,
  );
  assert.match(
    fs.readFileSync('signaling/production-config.mjs', 'utf8'),
    /resolveConfiguredSecret/,
  );
  assert.match(fs.readFileSync('signaling/agent.mjs', 'utf8'), /resolveSignalingSecrets/);
  assert.match(
    fs.readFileSync('signaling/production-config.mjs', 'utf8'),
    /production broker package/,
  );
  assert.match(
    fs.readFileSync('scripts/deployment/production-preflight.mjs', 'utf8'),
    /verifyProductionInputs/,
  );
});

test('production Compose mounts secrets and provisions the Redis broker dependency', () => {
  assert.match(
    productionCompose,
    /SPARTAN_SIGNALING_SECRET_FILE: \/run\/secrets\/signaling_secret/,
  );
  assert.match(productionCompose, /SPARTAN_SIGNALING_BROKER_PACKAGE/);
  assert.match(productionCompose, /SPARTAN_SIGNALING_REDIS_URL/);
  assert.match(productionCompose, /SPARTAN_SIGNALING_TURN_SECRET_FILE/);
  assert.match(productionCompose, /image: redis:7\.4-alpine/);
  assert.match(productionCompose, /condition: service_healthy/);
  assert.match(productionCompose, /SPARTAN_SIGNALING_TLS_KEY_FILE/);
  assert.match(productionCompose, /SPARTAN_SIGNALING_REDIS_URL: ["']\$\{/);
  assert.match(productionCompose, /cap_add:\s*\n\s*- SETUID\s*\n\s*- SETGID/);
  assert.match(productionCompose, /read_only: true/);
  assert.match(productionCompose, /no-new-privileges:true/);
});

test('production Compose exposes coturn only as an explicit operator profile', () => {
  assert.match(productionCompose, /profiles: \[["']turn["']\]/);
  assert.match(productionCompose, /SPARTAN_TURN_IMAGE:\?Set an operator-approved coturn image/);
  assert.match(productionCompose, /network_mode: host/);
  assert.match(
    productionCompose,
    /SPARTAN_TURN_CONFIG_FILE:\?Mount the generated coturn config file/,
  );
  assert.match(productionCompose, /SPARTAN_TURN_CERT_FILE:\?Mount the TURN certificate file/);
  assert.match(productionCompose, /SPARTAN_TURN_KEY_FILE:\?Mount the TURN private key file/);
  assert.match(
    productionCompose,
    /command: \[["']turnserver["'], ["']-c["'], ["']\/run\/secrets\/turn_config["'], ["']--no-cli["']\]/,
  );
  assert.match(productionCompose, /- NET_BIND_SERVICE/);
  assert.match(productionCompose, /--no-cli/);
});

test('native package rollout builds, verifies, and conditionally publishes signed artifacts', () => {
  assert.match(nativeRollout, /workflow_dispatch/);
  assert.match(nativeRollout, /tags:\s*\n\s*- 'v\*'/);
  assert.match(nativeRollout, /native:plan/);
  assert.match(nativeRollout, /release-manifest\.mjs/);
  assert.match(nativeRollout, /package-manifest\.unsigned\.json/);
  assert.match(nativeRollout, /sign-release\.mjs/);
  assert.match(nativeRollout, /SPARTAN_RELEASE_SIGNING_TOKEN/);
  assert.match(nativeRollout, /upload-artifact@v7/);
  assert.match(nativeRollout, /UNSIGNED-OPERATOR-SIGNATURE-REQUIRED/);
  assert.match(nativeRollout, /retention-days: 14/);
  assert.match(nativeRollout, /publish-native-release/);
  assert.match(nativeRollout, /RELEASE_SIGNING_PUBLIC_KEY_JWK/);
  assert.match(nativeRollout, /download-artifact@v7/);
  assert.match(nativeRollout, /contents: write/);
  assert.match(nativeRollout, /test ! -e.*UNSIGNED-OPERATOR-SIGNATURE-REQUIRED/);
  assert.match(nativeRollout, /verify-release\.mjs/);
  assert.match(nativeRollout, /gh release create/);
  assert.match(nativeRollout, /sha256sum/);
});

test('production rollout workflow keeps activation operator-controlled and secret-safe', () => {
  assert.match(productionRollout, /workflow_dispatch:/);
  assert.match(productionRollout, /runs-on: \$\{\{ inputs\.runner_label \}\}/);
  assert.match(
    productionRollout,
    /node --env-file="\$DEPLOYMENT_ENV_FILE" scripts\/validate-production-config\.mjs/,
  );
  assert.match(
    productionRollout,
    /node --env-file="\$DEPLOYMENT_ENV_FILE" scripts\/deployment\/production-preflight\.mjs/,
  );
  assert.match(productionRollout, /scripts\/deployment\/production-rollout\.mjs/);
  assert.match(productionRollout, /--report-file/);
  assert.match(productionRollout, /actions\/upload-artifact@v7/);
  assert.match(productionRollout, /require_broker/);
  assert.match(productionRollout, /--require-broker/);
  assert.match(productionRollout, /check_turn/);
  assert.match(productionRollout, /--check-turn/);
  assert.match(productionRollout, /check_turn_network/);
  assert.match(productionRollout, /--check-turn-network/);
  assert.match(
    productionRollout,
    /node --env-file="\$ENV_FILE" scripts\/deployment\/production-rollout\.mjs/,
  );
  assert.match(productionRollout, /--execute --confirm/);
  assert.match(productionRollout, /COMPOSE_FILE: \$\{\{ inputs\.compose_file \}\}/);
  assert.match(productionRollout, /ENV_FILE: \$\{\{ inputs\.env_file \}\}/);
  assert.match(productionRollout, /args=\(--compose-file \"\$COMPOSE_FILE\"/);
  assert.doesNotMatch(productionRollout, /SPARTAN_SIGNALING_SECRET\s*:/);
  assert.doesNotMatch(productionRollout, /docker login/);
});

test('host deployment templates preserve shell-free, opt-in host startup', () => {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.equal(
    packageJson.scripts['host:deployment-plan'],
    'node scripts/deployment/host-plan.mjs',
  );
  assert.match(hostService, /NoNewPrivileges=true/);
  assert.match(hostService, /ProtectSystem=strict/);
  assert.match(hostService, /EnvironmentFile=-\/etc\/spartan-gaming\/host\.env/);
  assert.match(hostService, /host\/agent\.mjs/);
  assert.doesNotMatch(hostService, /enable-input/);
});

test('TURN deployment template keeps relay startup hardened and credential-free', () => {
  const turnReadme = fs.readFileSync('deploy/turn/README.md', 'utf8');
  assert.match(turnReadme, /deployment:turn-config/);
  assert.match(turnReadme, /does not\s+provision a public relay/);
  assert.match(turnService, /User=turnserver/);
  assert.match(turnService, /--config \/etc\/spartan-gaming\/turnserver\.conf/);
  assert.match(turnService, /--no-cli/);
  assert.match(turnService, /NoNewPrivileges=true/);
  assert.match(turnService, /ProtectSystem=strict/);
  assert.match(turnService, /RestrictAddressFamilies=AF_INET AF_INET6/);
  assert.doesNotMatch(turnService, /SECRET|password|static-auth-secret/i);
});

test('desktop host deployment templates preserve opt-in capabilities across macOS and Windows', () => {
  assert.match(macHostPlist, /com\.spartan\.gaming\.host/);
  assert.match(macHostPlist, /<string>127\.0\.0\.1<\/string>/);
  assert.match(macHostPlist, /<key>RunAtLoad<\/key>\s*<false\/>/);
  assert.match(macHostPlist, /SPARTAN_HOST_CONFIGURED/);
  assert.doesNotMatch(macHostPlist, /enable-input|SPARTAN_HOST_SIGNAL_TICKET|tls-key/);
  assert.match(windowsHostReadme, /host:deployment-plan/);
  assert.match(windowsHostReadme, /dedicated unprivileged account/);
  assert.match(windowsHostReadme, /does not\s+create a virtual gamepad/);
});
