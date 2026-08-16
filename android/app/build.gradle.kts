plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val releaseKeystore = System.getenv("SPARTAN_ANDROID_KEYSTORE")
val releaseKeyAlias = System.getenv("SPARTAN_ANDROID_KEY_ALIAS")
val releaseStorePassword = System.getenv("SPARTAN_ANDROID_STORE_PASSWORD")
val releaseKeyPassword = System.getenv("SPARTAN_ANDROID_KEY_PASSWORD")
val releaseSigningValues =
    listOf(
        releaseKeystore,
        releaseKeyAlias,
        releaseStorePassword,
        releaseKeyPassword,
    )
val releaseSigningConfigured = releaseSigningValues.all { !it.isNullOrBlank() }
val releaseSigningPartial =
    releaseSigningValues.any { !it.isNullOrBlank() } && !releaseSigningConfigured

if (releaseSigningPartial) {
    error(
        "Android release signing requires SPARTAN_ANDROID_KEYSTORE, SPARTAN_ANDROID_KEY_ALIAS, SPARTAN_ANDROID_STORE_PASSWORD, and SPARTAN_ANDROID_KEY_PASSWORD together"
    )
}

android {
    namespace = "com.spartan.gaming.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.spartan.gaming"
        minSdk = 33
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0-beta.9"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        buildConfig = false
    }

    signingConfigs {
        if (releaseSigningConfigured) {
            create("operatorRelease") {
                storeFile = file(releaseKeystore!!)
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            if (releaseSigningConfigured) {
                signingConfig = signingConfigs.getByName("operatorRelease")
            }
        }
    }

    sourceSets["main"]
        .kotlin
        .setSrcDirs(
            listOf(
                rootProject.file("bridge/src/main/kotlin"),
                rootProject.file("controller"),
                rootProject.file("gamemode"),
                rootProject.file("gamenative"),
                rootProject.file("text-input"),
                project.file("src/main/kotlin"),
            )
        )
    sourceSets["main"].assets.srcDir(layout.buildDirectory.dir("generated/assets"))
}

val packageFrontendAssets =
    tasks.register<Sync>("packageFrontendAssets") {
        from(rootProject.file("../src/frontend"))
        into(layout.buildDirectory.dir("generated/assets/frontend"))
        from(rootProject.file("../providers/catalog.json")) {
            into("catalogs")
            rename { "providers.json" }
        }
        from(rootProject.file("../emulators/catalog.json")) {
            into("catalogs")
            rename { "emulators.json" }
        }
        from(rootProject.file("../games/catalog.json")) {
            into("catalogs")
            rename { "games.json" }
        }
    }

val packageCatalogAssets =
    tasks.register<Sync>("packageCatalogAssets") {
        into(layout.buildDirectory.dir("generated/assets"))
        from(rootProject.file("../providers")) { into("providers") }
        from(rootProject.file("../emulators")) { into("emulators") }
        from(rootProject.file("../games")) { into("games") }
    }

tasks.named("preBuild") {
    dependsOn(packageFrontendAssets, packageCatalogAssets)
}

tasks.configureEach {
    if (name == "assembleRelease") {
        doFirst {
            check(releaseSigningConfigured) {
                "assembleRelease requires operator-managed Android signing environment variables"
            }
        }
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
}

val ktfmt by configurations.creating

dependencies {
    ktfmt("com.facebook:ktfmt:0.64")
}

val kotlinSourceFiles =
    fileTree(projectDir) {
            include("**/*.kt", "**/*.kts")
            exclude("build/**")
        }
        .files
        .sortedBy { it.absolutePath }

fun registerKtfmtTask(name: String, vararg formatterArgs: String) =
    tasks.register<JavaExec>(name) {
        group = "formatting"
        description = "Format Android Kotlin sources with ktfmt"
        classpath = ktfmt
        mainClass.set("com.facebook.ktfmt.cli.Main")
        args(*formatterArgs, *kotlinSourceFiles.map { it.absolutePath }.toTypedArray())
    }

registerKtfmtTask("formatKotlin", "--kotlinlang-style")

registerKtfmtTask("checkKotlinFormat", "--kotlinlang-style", "--dry-run", "--set-exit-if-changed")
