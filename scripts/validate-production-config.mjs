#!/usr/bin/env node
import {normalizeProductionConfig} from '../signaling/production-config.mjs';

try {
  const config = normalizeProductionConfig({secret: process.env.SPARTAN_SIGNALING_SECRET, adminSecret: process.env.SPARTAN_SIGNALING_ADMIN_SECRET, tlsKey: process.env.SPARTAN_SIGNALING_TLS_KEY, tlsCert: process.env.SPARTAN_SIGNALING_TLS_CERT, allowedOrigins: process.env.SPARTAN_SIGNALING_ALLOWED_ORIGINS, sessionStore: process.env.SPARTAN_SIGNALING_SESSION_STORE, turnUrls: process.env.SPARTAN_SIGNALING_TURN_URLS});
  console.log(JSON.stringify(config));
} catch (error) {
  console.error(`production configuration invalid: ${error.message}`);
  process.exitCode = 1;
}
