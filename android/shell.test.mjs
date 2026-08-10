import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Android shell packages the shared frontend through a safe asset origin', () => {
  const build = read('app/build.gradle.kts');
  const activity = read('app/src/main/kotlin/com/spartan/gaming/app/MainActivity.kt');
  const manifest = read('app/src/main/AndroidManifest.xml');
  assert.match(build, /packageFrontendAssets/);
  assert.match(build, /androidx\.webkit:webkit/);
  assert.match(activity, /WebViewAssetLoader/);
  assert.match(activity, /appassets\.androidplatform\.net/);
  assert.match(activity, /allowFileAccess = false/);
  assert.match(activity, /addJavascriptInterface\(nativeBridge, "SpartanAndroid"\)/);
  assert.match(activity, /GameNativeHandoff\.launchOrInstall/);
  assert.match(manifest, /android:usesCleartextTraffic="false"/);
  assert.match(manifest, /android\.permission\.INTERNET/);
});

test('Android shell keeps native actions bounded and lifecycle-scoped', () => {
  const activity = read('app/src/main/kotlin/com/spartan/gaming/app/MainActivity.kt');
  assert.match(activity, /removeJavascriptInterface\("SpartanAndroid"\)/);
  assert.match(activity, /AndroidControllerInventory\.snapshot/);
  assert.match(activity, /AndroidGameModeBridge\.queryOnResume/);
  assert.match(activity, /override fun onTextInput\(payload: JSONObject\): Boolean \{[\s\S]*return false/);
  assert.match(activity, /target\.host == ASSET_HOST/);
});
