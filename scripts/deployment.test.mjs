import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const dockerfile = fs.readFileSync('docker/signaling.Dockerfile', 'utf8');
const compose = fs.readFileSync('docker-compose.yml', 'utf8');
const productionCompose = fs.readFileSync('docker-compose.production.yml', 'utf8');

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
