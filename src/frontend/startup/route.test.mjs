import assert from 'node:assert/strict';
import test from 'node:test';
import {resolveStartupRoute} from './route.mjs';

test('startup routing resumes authenticated sessions without exposing handoff data', () => {
  const recovery = {endpoint: 'wss://signal.example', sessionId: 'ses-1', ticket: 'secret'};
  assert.equal(resolveStartupRoute({'general.startupPage': 'Continue playing'}, {recovery}), '../player/index.html');
  assert.equal(resolveStartupRoute({'general.startupPage': 'Last session'}, {recovery}), '../player/index.html');
});

test('startup routing sends prior history to a recent view and never auto-opens providers', () => {
  assert.equal(resolveStartupRoute({'general.startupPage': 'Last session'}, {lastLaunch: {backendId: 'twitch', action: 'open-url'}}), './index.html?filter=recent&startup-resume=1');
  assert.equal(resolveStartupRoute({'general.startupPage': 'Continue playing'}, {lastLaunch: {backendId: 'twitch'}}), './index.html?filter=recent&startup-resume=1');
  assert.equal(resolveStartupRoute({'general.startupPage': 'New tab'}, {recovery: {ticket: 'secret'}, lastLaunch: {backendId: 'host'}}), null);
  assert.equal(resolveStartupRoute({'general.startupPage': 'invalid'}, {lastLaunch: {backendId: 'host'}}), null);
});
