plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.spartan.gaming.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.spartan.gaming"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }

    buildFeatures {
        buildConfig = false
    }

    sourceSets["main"].kotlin.srcDirs(rootProject.projectDir)
    sourceSets["main"].assets.srcDir(layout.buildDirectory.dir("generated/assets"))
}

val packageFrontendAssets = tasks.register<Sync>("packageFrontendAssets") {
    from(rootProject.file("../src/frontend"))
    into(layout.buildDirectory.dir("generated/assets/frontend"))
}

tasks.named("preBuild") {
    dependsOn(packageFrontendAssets)
}

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
}
