#!/usr/bin/env node
import {resolveProductionConfig} from '../signaling/production-config.mjs';

try {
  const config = resolveProductionConfig();
  console.log(JSON.stringify(config));
} catch (error) {
  console.error(`production configuration invalid: ${error.message}`);
  process.exitCode = 1;
}
