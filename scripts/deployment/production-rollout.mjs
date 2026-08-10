#!/usr/bin/env node
import {writeFile} from 'node:fs/promises';
import path from 'node:path';

const COMPOSE_SERVICES = Object.freeze(['signaling', 'redis', 'turn']);

function text(value) { return typeof value === 'string' ? value.trim() : ''; }
function evidenceText(value) { return text(value).slice(0, 128); }
function required(value, name) { const result = text(value); if (!result) throw new TypeError(`${name} is required`); return result; }
function absolute(value, name) { const result = path.resolve(required(value, name)); if (result === path.parse(result).root) throw new TypeError(`${name} cannot be the filesystem root`); return result; }
function projectName(value) { const result = required(value, 'projectName'); if (!/^[a-z0-9][a-z0-9_-]{0,62}$/i.test(result)) throw new TypeError('projectName must contain only letters, numbers, hyphens, and underscores'); return result; }
function composeExecutable(value) { const result = text(value) || 'docker'; if (/[\r\n]/.test(result) || result.includes(' ')) throw new TypeError('composeExecutable must be one executable path'); return result; }
function healthUrl(value, name) {
  const result = required(value, name);
  let parsed;
  try { parsed = new URL(result); } catch { throw new TypeError(`${name} must be an absolute URL`); }
  const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]';
  if (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) throw new TypeError(`${name} must use HTTPS except for loopback HTTP`);
  if (parsed.username || parsed.password || parsed.hash) throw new TypeError(`${name} must not contain credentials or a fragment`);
  return parsed.toString();
}

function composeArgs({composeExecutable: executable, composeFile, project, envFile, includeTurn, action}) {
  const args = ['compose', '--project-name', project, '--file', composeFile];
  if (envFile) args.push('--env-file', envFile);
  if (includeTurn) args.push('--profile', 'turn');
  if (action === 'config') args.push('config', '--quiet');
  else args.push('up', '--detach', '--build', ...(includeTurn ? COMPOSE_SERVICES : COMPOSE_SERVICES.slice(0, 2)));
  return Object.freeze({program: executable, args: Object.freeze(args)});
}

/** Create a secret-free, shell-free production deployment and health-check contract. */
export function createProductionRolloutPlan({composeExecutable: executable = 'docker', composeFile = 'docker-compose.production.yml', project = 'spartan-gaming', envFile, healthEndpoint = 'https://127.0.0.1/health', adminHealthEndpoint, includeTurn = true, requireBroker = false} = {}) {
  const normalizedExecutable = composeExecutable(executable);
  const normalizedComposeFile = absolute(composeFile, 'composeFile');
  const normalizedProject = projectName(project);
  const normalizedEnvFile = envFile ? absolute(envFile, 'envFile') : null;
  const health = healthUrl(healthEndpoint, 'healthEndpoint');
  const adminHealth = adminHealthEndpoint ? healthUrl(adminHealthEndpoint, 'adminHealthEndpoint') : null;
  const base = {composeExecutable: normalizedExecutable, composeFile: normalizedComposeFile, project: normalizedProject, envFile: normalizedEnvFile, includeTurn: Boolean(includeTurn)};
  return Object.freeze({status: 'planned', compose: Object.freeze({preflight: composeArgs({...base, action: 'config'}), up: composeArgs({...base, action: 'up'})}), health: Object.freeze({endpoint: health, adminEndpoint: adminHealth, required: Object.freeze(['service', ...(requireBroker ? ['broker'] : [])])}), security: Object.freeze({shell: false, credentials: 'external-secret-files', turn: Boolean(includeTurn), operatorConfirmationRequired: true})});
}

function defaultRunner({program, args}) {
  return import('node:child_process').then(({spawn}) => new Promise((resolve, reject) => {
    const child = spawn(program, args, {stdio: 'pipe', shell: false}); let stdout = ''; let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject); child.on('close', code => code === 0 ? resolve({stdout, stderr}) : reject(new Error(`deployment command failed with exit code ${code}`)));
  }));
}

async function checkHealth(endpoint, {fetchImpl = fetch, timeoutMs = 10_000} = {}) {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), timeoutMs); timeout.unref?.();
  try {
    const response = await fetchImpl(endpoint, {signal: controller.signal, headers: {accept: 'application/json'}});
    if (!response?.ok) throw new Error(`health endpoint returned HTTP ${response?.status ?? 'unknown'}`);
    const body = await response.json();
    if (!body || typeof body !== 'object' || typeof body.service !== 'string') throw new Error('health endpoint returned an invalid service status');
    const broker = body.broker && typeof body.broker === 'object' ? Object.freeze({status: evidenceText(body.broker.status), backend: evidenceText(body.broker.backend)}) : null;
    return Object.freeze({status: 'healthy', service: evidenceText(body.service), health: evidenceText(typeof body.status === 'string' ? body.status : 'ok'), ...(broker ? {broker} : {})});
  } finally { clearTimeout(timeout); }
}

/** Execute a previously-created plan with injected runner/fetch boundaries. */
export async function executeProductionRollout(plan, {runner = defaultRunner, fetchImpl = fetch, checkAdmin = false, timeoutMs = 10_000} = {}) {
  if (!plan || plan.status !== 'planned' || !plan.compose?.preflight || !plan.compose?.up) throw new TypeError('a valid production rollout plan is required');
  if (typeof runner !== 'function') throw new TypeError('runner must be a function');
  await runner(plan.compose.preflight); await runner(plan.compose.up);
  const primary = await checkHealth(plan.health.endpoint, {fetchImpl, timeoutMs});
  if (plan.health.required.includes('broker') && primary.broker?.status !== 'ready') throw new Error('production broker health is not ready');
  const admin = checkAdmin && plan.health.adminEndpoint ? await checkHealth(plan.health.adminEndpoint, {fetchImpl, timeoutMs}) : null;
  return Object.freeze({status: 'healthy', primary, admin});
}

/** Create bounded, secret-free evidence suitable for an operator artifact. */
export function createProductionRolloutReport(plan, result, {now = new Date()} = {}) {
  if (!plan?.health || result?.status !== 'healthy') throw new TypeError('a healthy rollout result is required');
  return Object.freeze({version: 1, kind: 'production-rollout', status: 'healthy', recordedAt: new Date(now).toISOString(), includeTurn: plan.security.turn, required: Object.freeze([...plan.health.required]), primary: Object.freeze({status: result.primary?.status, service: evidenceText(result.primary?.service), health: evidenceText(result.primary?.health), ...(result.primary?.broker ? {broker: Object.freeze({status: evidenceText(result.primary.broker.status), backend: evidenceText(result.primary.broker.backend)})} : {})}), admin: result.admin ? Object.freeze({status: result.admin.status, service: evidenceText(result.admin.service), health: evidenceText(result.admin.health), ...(result.admin.broker ? {broker: Object.freeze({status: evidenceText(result.admin.broker.status), backend: evidenceText(result.admin.broker.backend)})} : {})}) : null});
}

async function writeReport(file, report) { if (!text(file)) return; const target = path.resolve(file); if (target === path.parse(target).root) throw new TypeError('report file cannot be the filesystem root'); await writeFile(target, `${JSON.stringify(report, null, 2)}\n`, {encoding: 'utf8', mode: 0o600}); }

function argument(argv, name) { const index = argv.indexOf(name); return index < 0 ? '' : argv[index + 1]; }
if (path.resolve(process.argv[1] || '') === path.resolve(new URL(import.meta.url).pathname)) {
  try {
    const argv = process.argv.slice(2);
    const plan = createProductionRolloutPlan({composeFile: argument(argv, '--compose-file') || 'docker-compose.production.yml', project: argument(argv, '--project') || 'spartan-gaming', envFile: argument(argv, '--env-file') || undefined, healthEndpoint: argument(argv, '--health') || 'https://127.0.0.1/health', adminHealthEndpoint: argument(argv, '--admin-health') || undefined, includeTurn: !argv.includes('--without-turn'), requireBroker: argv.includes('--require-broker'), composeExecutable: argument(argv, '--compose-executable') || 'docker'});
    if (!argv.includes('--execute')) { console.log(JSON.stringify(plan, null, 2)); process.exit(0); }
    if (!argv.includes('--confirm')) throw new Error('production execution requires --confirm');
    const result = await executeProductionRollout(plan, {checkAdmin: argv.includes('--check-admin')}); const report = createProductionRolloutReport(plan, result); await writeReport(argument(argv, '--report-file'), report); console.log(JSON.stringify(result));
  } catch (error) { console.error(`production rollout failed: ${error.message}`); process.exitCode = 1; }
}
