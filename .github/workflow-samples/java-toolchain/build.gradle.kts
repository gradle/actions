plugins {
    java
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(16)
    }
}

repositories {
    mavenCentral()
}

testing {
    suites {
        val test by getting(JvmTestSuite::class) {
            useJUnit()
        }
    }
}
