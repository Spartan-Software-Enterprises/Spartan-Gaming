import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Android shell packages the shared frontend through a safe asset origin', () => {
  const settings = read('settings.gradle.kts');
  const wrapper = read('gradle/wrapper/gradle-wrapper.properties');
  const gradleProperties = read('gradle.properties');
  const build = read('app/build.gradle.kts');
  const activity = read('app/src/main/kotlin/com/spartan/gaming/app/MainActivity.kt');
  const manifest = read('app/src/main/AndroidManifest.xml');
  assert.match(settings, /include\(":app"\)/);
  assert.match(wrapper, /gradle-8\.11\.1-bin\.zip/);
  assert.match(gradleProperties, /android\.useAndroidX=true/);
  assert.match(gradleProperties, /android\.enableJetifier=true/);
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

test('Android shell exposes a reproducible wrapper build in CI', () => {
  const workflow = fs.readFileSync(path.join(root, '..', '.github/workflows/android-debug.yml'), 'utf8');
  assert.match(workflow, /android-actions\/setup-android@v4/);
  assert.match(workflow, /actions\/setup-java@v5/);
  assert.match(workflow, /platforms;android-35/);
  assert.match(workflow, /build-tools;35\.0\.0/);
  assert.match(workflow, /\.\/gradlew --no-daemon :app:assembleDebug/);
  assert.match(workflow, /actions\/upload-artifact@v7/);
  assert.match(workflow, /app\/build\/outputs\/apk\/debug\/app-debug\.apk/);
});

test('Android release signing fails closed and never stores credentials in source', () => {
  const build = read('app/build.gradle.kts');
  const readme = read('README.md');
  assert.match(build, /SPARTAN_ANDROID_KEYSTORE/);
  assert.match(build, /SPARTAN_ANDROID_KEY_ALIAS/);
  assert.match(build, /SPARTAN_ANDROID_STORE_PASSWORD/);
  assert.match(build, /SPARTAN_ANDROID_KEY_PASSWORD/);
  assert.match(build, /releaseSigningPartial/);
  assert.match(build, /assembleRelease/);
  assert.match(readme, /Release signing is deliberately environment-only/);
  assert.doesNotMatch(build, /storePassword\s*=\s*"/);
  assert.doesNotMatch(build, /keyPassword\s*=\s*"/);
});

test('Android signed release workflow keeps keystore material external', () => {
  const workflow = fs.readFileSync(path.join(root, '..', '.github/workflows/android-release.yml'), 'utf8');
  assert.match(workflow, /workflow_dispatch/);
  assert.match(workflow, /environment: android-release/);
  assert.match(workflow, /actions\/setup-java@v5/);
  assert.match(workflow, /SPARTAN_ANDROID_KEYSTORE_B64/);
  assert.match(workflow, /android-actions\/setup-android@v4/);
  assert.match(workflow, /base64 --decode/);
  assert.match(workflow, /SPARTAN_ANDROID_STORE_PASSWORD/);
  assert.match(workflow, /:app:assembleRelease/);
  assert.match(workflow, /apksigner.*verify/);
  assert.match(workflow, /actions\/upload-artifact@v7/);
  assert.doesNotMatch(workflow, /BEGIN (RSA |EC )?PRIVATE KEY/);
});

test('Android shell keeps native actions bounded and lifecycle-scoped', () => {
  const activity = read('app/src/main/kotlin/com/spartan/gaming/app/MainActivity.kt');
  assert.match(activity, /removeJavascriptInterface\("SpartanAndroid"\)/);
  assert.match(activity, /AndroidControllerInventory\.snapshot/);
  assert.match(activity, /AndroidGameModeBridge\.queryOnResume/);
  assert.match(activity, /override fun onTextInput\(payload: JSONObject\): Boolean \{[\s\S]*return false/);
  assert.match(activity, /target\.host == ASSET_HOST/);
});
