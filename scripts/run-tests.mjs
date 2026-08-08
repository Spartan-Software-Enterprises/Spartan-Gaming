#!/usr/bin/env node
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageManifest = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'));
const testCommand = packageManifest.scripts?.test || '';
const files = testCommand.replace(/^node\s+--test\s+/, '').trim().split(/\s+/).filter(Boolean);
const concurrencyIndex = process.argv.indexOf('--concurrency');
const concurrency = concurrencyIndex >= 0 ? Number(process.argv[concurrencyIndex + 1]) : 1;
if (!files.length) throw new Error('package test script does not contain a Node test file list');
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 64) throw new Error('test concurrency must be an integer between 1 and 64');
const result = spawnSync(process.execPath, ['--test', `--test-concurrency=${concurrency}`, ...files], {cwd: repositoryRoot, stdio: 'inherit', shell: false});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
