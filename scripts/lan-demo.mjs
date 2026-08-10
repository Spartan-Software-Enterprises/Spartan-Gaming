#!/usr/bin/env node
import {randomBytes, randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createFrontendServer} from './frontend/serve.mjs';
import {createSignalingServer} from '../signaling/agent.mjs';

const DEFAULT_TTL_MS = 10 * 60 * 1000;

function localUrl(address, pathname) {
  const host = address.address === '::' ? '127.0.0.1' : address.address;
  return `http://${host}:${address.port}${pathname}`;
}

export async function createLanDemo({frontendPort = 0, signalingPort = 0, ttlMs = DEFAULT_TTL_MS, sessionId = `ses-lan-${randomUUID().slice(0, 8)}`, secret = randomBytes(32).toString('base64url'), logger = console} = {}) {
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(sessionId)) throw new TypeError('sessionId has invalid characters');
  const frontend = createFrontendServer({host: '127.0.0.1', port: frontendPort, logger});
  const frontendAddress = await frontend.listen();
  const frontendOrigin = `http://127.0.0.1:${frontendAddress.port}`;
  let signaling;
  try {
    signaling = createSignalingServer({bind: '127.0.0.1', port: signalingPort, secret, allowedOrigins: [frontendOrigin]});
    const signalingAddress = await signaling.start();
    const signalingHost = signalingAddress.address === '::' ? '127.0.0.1' : signalingAddress.address;
    const endpoint = `ws://${signalingHost}:${signalingAddress.port}/signal`;
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    const result = Object.freeze({
      sessionId,
      expiresAt,
      frontendUrl: `${frontendOrigin}/dashboard/`,
      hostStudioUrl: `${frontendOrigin}/host/browser-studio.html`,
      playerUrl: `${frontendOrigin}/player/index.html`,
      signalingEndpoint: endpoint,
      hostTicket: signaling.broker.issueTicket({sessionId, role: 'host', subject: 'lan-browser-host', ttlMs}),
      clientTicket: signaling.broker.issueTicket({sessionId, role: 'client', subject: 'lan-browser-client', ttlMs}),
      frontend,
      signaling,
      close: async () => { await signaling.close(); await frontend.close(); },
    });
    return result;
  } catch (error) {
    await frontend.close().catch(() => {});
    throw error;
  }
}

function printInstructions(demo) {
  console.log(JSON.stringify({
    service: 'spartan-lan-demo',
    sessionId: demo.sessionId,
    expiresAt: demo.expiresAt,
    dashboardUrl: demo.frontendUrl,
    signalingEndpoint: demo.signalingEndpoint,
    host: {url: demo.hostStudioUrl, ticket: demo.hostTicket},
    client: {url: demo.playerUrl, ticket: demo.clientTicket},
    instructions: ['Open the host URL in one browser tab, enter the signaling endpoint, session ID, and host ticket, then choose a display and start the host.', 'Open the player URL in another tab, enter the same signaling endpoint and session ID with the client ticket, then connect securely.', 'This demo uses localhost WebRTC and user-approved display capture; it does not launch games or inject native input.'],
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createLanDemo({frontendPort: Number(process.env.SPARTAN_FRONTEND_PORT || 0), signalingPort: Number(process.env.SPARTAN_SIGNALING_PORT || 0)}).then(demo => {
    printInstructions(demo);
    const close = () => demo.close().finally(() => process.exit(0));
    process.once('SIGINT', close); process.once('SIGTERM', close);
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
