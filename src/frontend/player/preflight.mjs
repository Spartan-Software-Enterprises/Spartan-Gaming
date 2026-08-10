import {collectCapabilities} from '../diagnostics/capabilities.mjs';
import {readSessionPreferences} from '../session/preferences.mjs';
import {createInputPermissionPolicy} from '../input/policy.mjs';
import {createActiveProfileStorage} from '../profiles/storage.mjs';

/** Collect local evidence before creating a session offer. Failure stays fail-open. */
export async function preparePlayerSession({storage = globalThis.localStorage, workspaceStorage = createActiveProfileStorage({storage}), controllerProfile, collect = collectCapabilities} = {}) {
  let capabilities = null;
  try { capabilities = await collect(); } catch { capabilities = null; }
  const preferences = readSessionPreferences(storage, capabilities, {workspaceStorage, controllerProfile});
  return Object.freeze({capabilities, preferences, inputPolicy: createInputPermissionPolicy(preferences.capabilities)});
}
