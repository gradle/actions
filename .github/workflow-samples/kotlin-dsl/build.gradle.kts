plugins {
    `java-library`
}

repositories {
    mavenCentral()
}

dependencies {
    api("org.apache.commons:commons-math3:3.6.1")
    implementation("com.google.guava:guava:33.5.0-jre")
}

testing {
    suites { 
       val test by getting(JvmTestSuite::class) { 
            useJUnitJupiter() 
        }
    }
}

tasks.named("test").configure {
    // Write marker file so we can detect if task was configured
    file("task-configured.txt").writeText("true")

    doLast {
        if (System.getProperties().containsKey("verifyCachedBuild")) {
            throw RuntimeException("Build was not cached: unexpected execution of test task")
        }
    }
}
