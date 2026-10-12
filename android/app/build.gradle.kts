import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val signingProperties = Properties().apply {
    val propertiesFile = rootProject.file("keystore.properties")
    if (propertiesFile.exists()) propertiesFile.inputStream().use(::load)
}
fun signingValue(property: String, environment: String): String? =
    providers.environmentVariable(environment).orNull ?: signingProperties.getProperty(property)
val releaseStoreFile = signingValue("storeFile", "TV_DIGITAL_STORE_FILE")
val releaseStorePassword = signingValue("storePassword", "TV_DIGITAL_STORE_PASSWORD")
val releaseKeyAlias = signingValue("keyAlias", "TV_DIGITAL_KEY_ALIAS")
val releaseKeyPassword = signingValue("keyPassword", "TV_DIGITAL_KEY_PASSWORD")
val releaseSigningReady = listOf(releaseStoreFile, releaseStorePassword, releaseKeyAlias, releaseKeyPassword).all { !it.isNullOrBlank() }

android {
    namespace = "com.tvdigital.player"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.tvdigital.player"
        minSdk = 24
        targetSdk = 36
        versionCode = 5
        versionName = "1.4.0-test"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        manifestPlaceholders["usesCleartextTraffic"] = "false"
    }

    signingConfigs {
        if (releaseSigningReady) {
            create("release") {
                storeFile = rootProject.file(releaseStoreFile!!)
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
                enableV1Signing = true
                enableV2Signing = true
                enableV3Signing = true
                enableV4Signing = true
            }
        }
    }

    buildTypes {
        debug {
            val backendBaseUrl = providers.gradleProperty("BACKEND_BASE_URL")
                .orElse("http://10.0.2.2:3000/")
                .get()
            buildConfigField("String", "BACKEND_BASE_URL", "\"$backendBaseUrl\"")
            buildConfigField("boolean", "ALLOW_HTTP_STREAMS", "true")
            manifestPlaceholders["usesCleartextTraffic"] = "true"
        }
        release {
            isMinifyEnabled = true
            if (releaseSigningReady) signingConfig = signingConfigs.getByName("release")
            val backendBaseUrl = providers.gradleProperty("BACKEND_BASE_URL")
                .orElse("https://example.invalid/")
                .get()
            buildConfigField("String", "BACKEND_BASE_URL", "\"$backendBaseUrl\"")
            val allowHttpStreams = providers.gradleProperty("ALLOW_HTTP_STREAMS")
                .orElse("false")
                .get()
            buildConfigField("boolean", "ALLOW_HTTP_STREAMS", allowHttpStreams)
            manifestPlaceholders["usesCleartextTraffic"] = allowHttpStreams
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    buildFeatures {
        buildConfig = true
        viewBinding = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.activity:activity-ktx:1.12.1")
    implementation("androidx.recyclerview:recyclerview:1.4.0")
    implementation("androidx.media3:media3-exoplayer:1.10.1")
    implementation("androidx.media3:media3-exoplayer-dash:1.10.1")
    implementation("androidx.media3:media3-exoplayer-hls:1.10.1")
    implementation("androidx.media3:media3-ui:1.10.1")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20250517")
}
