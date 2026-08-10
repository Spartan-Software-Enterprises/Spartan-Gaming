#!/usr/bin/env node
import {spawn} from 'node:child_process';

const IMAGE = 'jrottenberg/ffmpeg@sha256:1275eb6dbd392e5bf1711d8ce9af7f2a5d7e7b198cad632764682e450a9eeeb7';
const uid = typeof process.getuid === 'function' ? process.getuid() : 1000;
const runtime = process.env.XDG_RUNTIME_DIR || `/run/user/${uid}`;
const args = [
  'run', '--rm', '--network', 'host', '--user', `${uid}:${typeof process.getgid === 'function' ? process.getgid() : uid}`,
  '--env', `DISPLAY=${process.env.DISPLAY || ':99'}`,
  '--volume', '/tmp/.X11-unix:/tmp/.X11-unix:ro',
  '--volume', `${runtime}/pulse:/tmp/spartan-pulse:ro`,
  '--env', 'PULSE_SERVER=unix:/tmp/spartan-pulse/native',
  IMAGE, 'ffmpeg', ...process.argv.slice(2),
];

const child = spawn('docker', args, {stdio: 'inherit', shell: false});
child.once('error', error => { console.error(error.message); process.exitCode = 127; });
child.once('exit', (code, signal) => { process.exitCode = typeof code === 'number' ? code : signal ? 128 : 1; });
