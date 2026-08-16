import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('Android shell packages the shared frontend through a safe asset origin', () => {
  const settings = read('settings.gradle.kts');
  const wrapper = read('gradle/wrapper/gradle-wrapper.properties');
  const gradleProperties = read('gradle.properties');
  const build = read('app/build.gradle.kts');
  const activity = read('app/src/main/kotlin/com/spartan/gaming/app/MainActivity.kt');
  const updater = read('app/src/main/kotlin/com/spartan/gaming/app/GithubReleaseUpdate.kt');
  const manifest = read('app/src/main/AndroidManifest.xml');
  assert.match(settings, /include\(":app"\)/);
  assert.match(wrapper, /gradle-8\.11\.1-bin\.zip/);
  assert.match(gradleProperties, /android\.useAndroidX=true/);
  assert.match(gradleProperties, /android\.enableJetifier=true/);
  assert.match(build, /packageFrontendAssets/);
  assert.match(build, /packageCatalogAssets/);
  assert.match(build, /into\("providers"\)/);
  assert.match(build, /into\("emulators"\)/);
  assert.match(build, /into\("games"\)/);
  assert.match(build, /into\("catalogs"\)/);
  assert.match(build, /rename\s*\{\s*"providers\.json"\s*\}/);
  assert.match(build, /rename\s*\{\s*"emulators\.json"\s*\}/);
  assert.match(build, /rename\s*\{\s*"games\.json"\s*\}/);
  assert.doesNotMatch(build, /into\("catalogs\/providers\.json"\)/);
  assert.doesNotMatch(build, /into\("catalogs\/emulators\.json"\)/);
  assert.doesNotMatch(build, /into\("catalogs\/games\.json"\)/);
  assert.match(build, /androidx\.webkit:webkit/);
  assert.match(activity, /WebViewAssetLoader/);
  assert.match(activity, /appassets\.androidplatform\.net/);
  assert.match(activity, /addPathHandler\("\/providers\//);
  assert.match(activity, /addPathHandler\("\/emulators\//);
  assert.match(activity, /addPathHandler\("\/games\//);
  assert.match(activity, /if \(target\.scheme == "https"\) return false/);
  assert.match(activity, /allowFileAccess = false/);
  assert.match(activity, /addJavascriptInterface\(nativeBridge, "SpartanAndroid"\)/);
  assert.match(activity, /GameNativeHandoff\.launchOrInstall/);
  assert.match(activity, /GithubReleaseUpdate\.check/);
  assert.match(
    updater,
    /api\.github\.com\/repos\/Spartan-Software-Enterprises\/Spartan-Gaming\/releases/,
  );
  assert.match(updater, /setCancelable\(false\)/);
  assert.match(manifest, /android:usesCleartextTraffic="false"/);
  assert.match(manifest, /android\.permission\.INTERNET/);
});

test('Android shell exposes a reproducible wrapper build in CI', () => {
  const workflow = fs.readFileSync(
    path.join(root, '..', '.github/workflows/android-debug.yml'),
    'utf8',
  );
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
  const workflow = fs.readFileSync(
    path.join(root, '..', '.github/workflows/android-release.yml'),
    'utf8',
  );
  assert.match(workflow, /workflow_dispatch/);
  assert.match(workflow, /environment: android-release/);
  assert.match(workflow, /actions\/setup-java@v5/);
  assert.match(workflow, /SPARTAN_ANDROID_KEYSTORE_B64/);
  assert.match(workflow, /android-actions\/setup-android@v4/);
  assert.match(workflow, /base64 --decode/);
  assert.match(workflow, /SPARTAN_ANDROID_STORE_PASSWORD/);
  assert.match(workflow, /:app:assemble\$\{task\}Release/);
  assert.match(workflow, /apksigner.*verify/);
  assert.match(workflow, /actions\/upload-artifact@v7/);
  assert.doesNotMatch(workflow, /BEGIN (RSA |EC )?PRIVATE KEY/);
});

test('Android shell keeps native actions bounded and lifecycle-scoped', () => {
  const activity = read('app/src/main/kotlin/com/spartan/gaming/app/MainActivity.kt');
  assert.match(activity, /removeJavascriptInterface\("SpartanAndroid"\)/);
  assert.match(activity, /AndroidControllerInventory\.snapshot/);
  assert.match(activity, /AndroidGameModeBridge\.queryOnResume/);
  assert.match(
    activity,
    /override fun onTextInput\(payload: JSONObject\): Boolean \{[\s\S]*return false/,
  );
  assert.match(activity, /target\.host == ASSET_HOST/);
});

test('Android release profiles declare phone, tablet, foldable, Android TV, and Fire TV variants', () => {
  const build = read('app/build.gradle.kts');
  const manifest = read('app/src/main/AndroidManifest.xml');
  assert.match(build, /flavorDimensions \+= "device"/);
  for (const flavor of ['phone', 'tablet', 'foldable', 'androidTv', 'fireTv'])
    assert.ok(build.includes('create(\"' + flavor + '\")'));
  assert.match(manifest, /com\.spartan\.gaming\.device_profile/);
  for (const overlay of ['androidTv', 'fireTv']) {
    const overlayManifest = read('app/src/' + overlay + '/AndroidManifest.xml');
    assert.match(overlayManifest, /LEANBACK_LAUNCHER/);
    assert.match(overlayManifest, /android:screenOrientation="landscape"/);
    assert.match(overlayManifest, /android.hardware.touchscreen/);
  }
});
