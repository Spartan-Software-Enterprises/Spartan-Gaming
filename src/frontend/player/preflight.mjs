import {collectCapabilities} from '../diagnostics/capabilities.mjs';
import {readSessionPreferences} from '../session/preferences.mjs';
import {createInputPermissionPolicy} from '../input/policy.mjs';

/** Collect local evidence before creating a session offer. Failure stays fail-open. */
export async function preparePlayerSession({storage = globalThis.localStorage, collect = collectCapabilities} = {}) {
  let capabilities = null;
  try { capabilities = await collect(); } catch { capabilities = null; }
  const preferences = readSessionPreferences(storage, capabilities);
  return Object.freeze({capabilities, preferences, inputPolicy: createInputPermissionPolicy(preferences.capabilities)});
}
