plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.tvdigital.player"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.tvdigital.player"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        debug {
            val backendBaseUrl = providers.gradleProperty("BACKEND_BASE_URL")
                .orElse("http://10.0.2.2:3000/")
                .get()
            buildConfigField("String", "BACKEND_BASE_URL", "\"$backendBaseUrl\"")
        }
        release {
            isMinifyEnabled = true
            val backendBaseUrl = providers.gradleProperty("BACKEND_BASE_URL")
                .orElse("https://example.invalid/")
                .get()
            buildConfigField("String", "BACKEND_BASE_URL", "\"$backendBaseUrl\"")
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
