import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const dockerfile = fs.readFileSync('docker/signaling.Dockerfile', 'utf8');
const compose = fs.readFileSync('docker-compose.yml', 'utf8');
const productionCompose = fs.readFileSync('docker-compose.production.yml', 'utf8');
const nativeRollout = fs.readFileSync('.github/workflows/native-package-rollout.yml', 'utf8');
const hostService = fs.readFileSync('deploy/host/spartan-host.service', 'utf8');

test('signaling image is minimal, non-root, and health checked', () => {
  assert.match(dockerfile, /^FROM node:22-bookworm-slim/m);
  assert.match(dockerfile, /COPY signaling \.\/signaling/);
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

test('production preflight is part of the published deployment surface', () => {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.equal(packageJson.scripts['deployment:check'], 'node scripts/validate-production-config.mjs');
  assert.equal(packageJson.scripts['deployment:tls-check'], 'node scripts/deployment/tls-rotation.mjs');
  assert.equal(packageJson.scripts['deployment:turn-config'], 'node scripts/deployment/turn-relay.mjs');
  assert.match(fs.readFileSync('scripts/deployment/tls-rotation.mjs', 'utf8'), /rotateTlsCertificatePair/);
  assert.match(fs.readFileSync('scripts/validate-production-config.mjs', 'utf8'), /resolveProductionConfig/);
  assert.match(fs.readFileSync('signaling/production-config.mjs', 'utf8'), /resolveConfiguredSecret/);
  assert.match(fs.readFileSync('signaling/agent.mjs', 'utf8'), /resolveSignalingSecrets/);
  assert.match(fs.readFileSync('signaling/production-config.mjs', 'utf8'), /production broker package/);
});

test('production Compose mounts secrets and provisions the Redis broker dependency', () => {
  assert.match(productionCompose, /SPARTAN_SIGNALING_SECRET_FILE: \/run\/secrets\/signaling_secret/);
  assert.match(productionCompose, /SPARTAN_SIGNALING_BROKER_PACKAGE/);
  assert.match(productionCompose, /SPARTAN_SIGNALING_REDIS_URL/);
  assert.match(productionCompose, /SPARTAN_SIGNALING_TURN_SECRET_FILE/);
  assert.match(productionCompose, /image: redis:7\.4-alpine/);
  assert.match(productionCompose, /condition: service_healthy/);
  assert.match(productionCompose, /SPARTAN_SIGNALING_TLS_KEY_FILE/);
  assert.match(productionCompose, /read_only: true/);
  assert.match(productionCompose, /no-new-privileges:true/);
});

test('native package rollout builds isolated target artifacts without bypassing signing', () => {
  assert.match(nativeRollout, /workflow_dispatch/); assert.match(nativeRollout, /tags:\s*\n\s*- 'v\*'/); assert.match(nativeRollout, /native:plan/); assert.match(nativeRollout, /release-manifest\.mjs/); assert.match(nativeRollout, /package-manifest\.unsigned\.json/); assert.match(nativeRollout, /upload-artifact@v7/); assert.match(nativeRollout, /UNSIGNED-OPERATOR-SIGNATURE-REQUIRED/); assert.match(nativeRollout, /retention-days: 14/);
});

test('host deployment templates preserve shell-free, opt-in host startup', () => {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8')); assert.equal(packageJson.scripts['host:deployment-plan'], 'node scripts/deployment/host-plan.mjs'); assert.match(hostService, /NoNewPrivileges=true/); assert.match(hostService, /ProtectSystem=strict/); assert.match(hostService, /EnvironmentFile=-\/etc\/spartan-gaming\/host\.env/); assert.match(hostService, /host\/agent\.mjs/); assert.doesNotMatch(hostService, /enable-input/);
});
