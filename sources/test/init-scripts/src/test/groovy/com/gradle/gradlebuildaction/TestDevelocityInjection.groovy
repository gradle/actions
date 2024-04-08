package com.gradle.gradlebuildaction

import org.gradle.testkit.runner.BuildResult
import org.gradle.util.GradleVersion
import spock.lang.Requires

import static org.junit.Assume.assumeTrue

class TestDevelocityInjection extends BaseInitScriptTest {
    static final List<TestGradleVersion> CCUD_COMPATIBLE_VERSIONS = ALL_VERSIONS - [GRADLE_3_X]

    def initScript = 'gradle-actions.inject-develocity.init.gradle'

    private static final GradleVersion GRADLE_5 = GradleVersion.version('5.0')

    def "does not apply Develocity plugins when not requested"() {
        assumeTrue testGradleVersion.compatibleWithCurrentJvm

        when:
        def result = run([], initScript, testGradleVersion.gradleVersion)

        then:
        outputMissesDevelocityPluginApplicationViaInitScript(result)
        outputMissesCcudPluginApplicationViaInitScript(result)

        where:
        testGradleVersion << ALL_VERSIONS
    }

    def "does not override Develocity plugin when already defined in project"() {
        assumeTrue testGradleVersion.compatibleWithCurrentJvm

        given:
        declareDevelocityPluginApplication(testGradleVersion.gradleVersion)

        when:
        def result = run(testGradleVersion, testConfig())

        then:
        outputMissesDevelocityPluginApplicationViaInitScript(result)
        outputMissesCcudPluginApplicationViaInitScript(result)

        and:
        outputContainsBuildScanUrl(result)

        where:
        testGradleVersion << ALL_VERSIONS
    }

    @Requires(
            value = { data.testGradleVersion.gradleVersion >= GradleVersion.version("5.0") },
            reason = "Prior to Gradle 5.0, we apply a fixed version of the plugin, which can't introduce this conflict"
    )
    def "does not override GE or Build Scan plugins even if Develocity plugin is requested"() {
        assumeTrue testGradleVersion.compatibleWithCurrentJvm

        given:
        declareLegacyGradleEnterprisePluginApplication(testGradleVersion.gradleVersion)

        when:
        def result = run(testGradleVersion, testConfig())

        then:
        outputMissesDevelocityPluginApplicationViaInitScript(result)
        outputMissesCcudPluginApplicationViaInitScript(result)

        and:
        outputContainsBuildScanUrl(result)

        where:
        testGradleVersion << ALL_VERSIONS
    }

    def "applies Develocity plugin via init script when not defined in project"() {
        assumeTrue testGradleVersion.compatibleWithCurrentJvm

        when:
        def result = run(testGradleVersion, testConfig())

        then:
        outputContainsDevelocityPluginApplicationViaInitScript(result, testGradleVersion.gradleVersion)
        outputMissesCcudPluginApplicationViaInitScript(result)

        and:
        outputContainsBuildScanUrl(result)

        where:
        testGradleVersion << ALL_VERSIONS
    }

    def "applies deprecated Gradle Enterprise or Build Scan plugins if requested"() {
        assumeTrue testGradleVersion.compatibleWithCurrentJvm

        given:
        def appliedPluginClass = testGradleVersion.gradleVersion >= GradleVersion.version("6.0")
                ? "com.gradle.enterprise.gradleplugin.GradleEnterprisePlugin"
                : "com.gradle.scan.plugin.BuildScanPlugin"

        when:
        // 3.16.2 is the latest version of deprecated plugins
        def result = run(testGradleVersion, testConfig('3.16.2'))

        then:
        1 == result.output.count("Applying $appliedPluginClass via init script")

        and:
        outputContainsBuildScanUrl(result)

        where:
        testGradleVersion << ALL_VERSIONS
    }

    def "applies Develocity and CCUD plugins via init script when not defined in project"() {
        assumeTrue testGradleVersion.compatibleWithCurrentJvm

        when:
        def result = run(testGradleVersion, testConfig().withCCUDPlugin())

        then:
        outputContainsDevelocityPluginApplicationViaInitScript(result, testGradleVersion.gradleVersion)
        outputContainsCcudPluginApplicationViaInitScript(result)

        and:
        outputContainsBuildScanUrl(result)

        where:
        testGradleVersion << CCUD_COMPATIBLE_VERSIONS
    }

    def "applies CCUD plugin via init script where Develocity plugin already applied"() {
        assumeTrue testGradleVersion.compatibleWithCurrentJvm

        given:
        declareDevelocityPluginApplication(testGradleVersion.gradleVersion)

        when:
        def result = run(testGradleVersion, testConfig().withCCUDPlugin())

        then:
        outputMissesDevelocityPluginApplicationViaInitScript(result)
        outputContainsCcudPluginApplicationViaInitScript(result)

        and:
        outputContainsBuildScanUrl(result)

        where:
        testGradleVersion << CCUD_COMPATIBLE_VERSIONS
    }

    def "does not override CCUD plugin when already defined in project"() {
        assumeTrue testGradleVersion.compatibleWithCurrentJvm

        given:
        declareDevelocityPluginAndCcudPluginApplication(testGradleVersion.gradleVersion)

        when:
        def result = run(testGradleVersion, testConfig().withCCUDPlugin())

        then:
        outputMissesDevelocityPluginApplicationViaInitScript(result)
        outputMissesCcudPluginApplicationViaInitScript(result)

        and:
        outputContainsBuildScanUrl(result)

        where:
        testGradleVersion << CCUD_COMPATIBLE_VERSIONS
    }

    def "ignores Develocity URL and allowUntrustedServer when Develocity plugin is not applied by the init script"() {
        assumeTrue testGradleVersion.compatibleWithCurrentJvm

        given:
        declareDevelocityPluginApplication(testGradleVersion.gradleVersion)

        when:
        def config = testConfig().withServer(URI.create('https://develocity-server.invalid'))
        def result = run(testGradleVersion, config)

        then:
        outputMissesDevelocityPluginApplicationViaInitScript(result)
        outputMissesCcudPluginApplicationViaInitScript(result)

        and:
        outputContainsBuildScanUrl(result)

        where:
        testGradleVersion << ALL_VERSIONS
    }

    def "configures Develocity URL and allowUntrustedServer when Develocity plugin is applied by the init script"() {
        assumeTrue testGradleVersion.compatibleWithCurrentJvm

        when:
        def config = testConfig().withServer(mockScansServer.address)
        def result = run(testGradleVersion, config)

        then:
        outputContainsDevelocityPluginApplicationViaInitScript(result, testGradleVersion.gradleVersion)
        outputContainsDevelocityConnectionInfo(result, mockScansServer.address.toString(), true)
        outputMissesCcudPluginApplicationViaInitScript(result)
        outputContainsPluginRepositoryInfo(result, 'https://plugins.gradle.org/m2')

        and:
        outputContainsBuildScanUrl(result)

        where:
        testGradleVersion << ALL_VERSIONS
    }

    def "enforces Develocity URL and allowUntrustedServer in project if enforce url parameter is enabled"() {
        assumeTrue testGradleVersion.compatibleWithCurrentJvm

        given:
        declareDevelocityPluginApplication(testGradleVersion.gradleVersion, URI.create('https://develocity-server.invalid'))

        when:
        def config = testConfig().withServer(mockScansServer.address, true)
        def result = run(testGradleVersion, config)

        then:
        outputMissesDevelocityPluginApplicationViaInitScript(result)
        outputMissesCcudPluginApplicationViaInitScript(result)

        and:
        outputEnforcesDevelocityUrl(result, mockScansServer.address.toString(), true)

        and:
        outputContainsBuildScanUrl(result)

        where:
        testGradleVersion << ALL_VERSIONS
    }

    def "can configure alternative repository for plugins when Develocity plugin is applied by the init script"() {
        assumeTrue testGradleVersion.compatibleWithCurrentJvm

        when:
        def config = testConfig().withPluginRepository(new URI('https://plugins.grdev.net/m2'))
        def result = run(testGradleVersion, config)

        then:
        outputContainsDevelocityPluginApplicationViaInitScript(result, testGradleVersion.gradleVersion)
        outputContainsDevelocityConnectionInfo(result, mockScansServer.address.toString(), true)
        outputMissesCcudPluginApplicationViaInitScript(result)
        outputContainsPluginRepositoryInfo(result, 'https://plugins.grdev.net/m2')

        and:
        outputContainsBuildScanUrl(result)

        where:
        testGradleVersion << ALL_VERSIONS
    }

    def "can configure alternative repository for plugins with credentials when Develocity plugin is applied by the init script"() {
        assumeTrue testGradleVersion.compatibleWithCurrentJvm

        when:
        def config = testConfig().withPluginRepository(new URI('https://plugins.grdev.net/m2')).withPluginRepositoryCredentials("john", "doe")
        def result = run(testGradleVersion, config)

        then:
        outputContainsDevelocityPluginApplicationViaInitScript(result, testGradleVersion.gradleVersion)
        outputContainsDevelocityConnectionInfo(result, mockScansServer.address.toString(), true)
        outputMissesCcudPluginApplicationViaInitScript(result)
        outputContainsPluginRepositoryInfo(result, 'https://plugins.grdev.net/m2', true)

        and:
        outputContainsBuildScanUrl(result)

        where:
        testGradleVersion << ALL_VERSIONS
    }

    def "can configure capturing file fingerprints when Develocity plugin is applied by the init script"() {
        assumeTrue testGradleVersion.compatibleWithCurrentJvm

        when:
        def config = testConfig().withCaptureFileFingerprints()
        def result = run(testGradleVersion, config)

        then:
        outputContainsDevelocityPluginApplicationViaInitScript(result, testGradleVersion.gradleVersion)
        outputContainsDevelocityConnectionInfo(result, mockScansServer.address.toString(), true)
        outputMissesCcudPluginApplicationViaInitScript(result)
        if (testGradleVersion.gradleVersion >= GRADLE_5_X.gradleVersion) {
            outputCaptureFileFingerprints(result, true)
        }

        and:
        outputContainsBuildScanUrl(result)

        where:
        testGradleVersion << ALL_VERSIONS
    }

    def "stops gracefully when requested CCUD plugin version is <1.7"() {
        assumeTrue testGradleVersion.compatibleWithCurrentJvm

        when:
        def config = testConfig().withCCUDPlugin("1.6.6")
        def result = run(testGradleVersion, config)

        then:
        outputMissesDevelocityPluginApplicationViaInitScript(result)
        outputMissesCcudPluginApplicationViaInitScript(result)
        result.output.contains('Common Custom User Data Gradle plugin must be at least 1.7. Configured version is 1.6.6.')

        where:
        testGradleVersion << ALL_VERSIONS
    }

    def "can configure Develocity via CCUD system property overrides when CCUD plugin is inject via init script"() {
        assumeTrue testGradleVersion.compatibleWithCurrentJvm

        when:
        def config = testConfig().withCCUDPlugin().withServer(URI.create('https://develocity-server.invalid'))
        def result = run(testGradleVersion, config, ["help", "-Ddevelocity.url=${mockScansServer.address}".toString()])

        then:
        outputContainsDevelocityPluginApplicationViaInitScript(result, testGradleVersion.gradleVersion)
        outputContainsCcudPluginApplicationViaInitScript(result)

        and:
        outputContainsBuildScanUrl(result)

        where:
        testGradleVersion << CCUD_COMPATIBLE_VERSIONS
    }

    def "init script is configuration cache compatible"() {
        assumeTrue testGradleVersion.compatibleWithCurrentJvm

        when:
        def config = testConfig().withCCUDPlugin()
        def result = run(testGradleVersion, config, ["help", "--configuration-cache"])

        then:
        outputContainsDevelocityPluginApplicationViaInitScript(result, testGradleVersion.gradleVersion)
        outputContainsCcudPluginApplicationViaInitScript(result)

        and:
        outputContainsBuildScanUrl(result)

        when:
        result = run(testGradleVersion, config, ["help", "--configuration-cache"])

        then:
        outputMissesDevelocityPluginApplicationViaInitScript(result)
        outputMissesCcudPluginApplicationViaInitScript(result)

        and:
        outputContainsBuildScanUrl(result)

        where:
        testGradleVersion << CONFIGURATION_CACHE_VERSIONS
    }

    void outputContainsBuildScanUrl(BuildResult result) {
        def message = "Publishing build scan...\n${mockScansServer.address}s/$PUBLIC_BUILD_SCAN_ID"
        assert result.output.contains(message)
        assert 1 == result.output.count(message)
    }

    void outputContainsDevelocityPluginApplicationViaInitScript(BuildResult result, GradleVersion gradleVersion) {
        def pluginApplicationLogMsgGradle4 = "Applying com.gradle.scan.plugin.BuildScanPlugin via init script"
        def pluginApplicationLogMsgGradle5AndHigher = "Applying com.gradle.develocity.agent.gradle.DevelocityPlugin via init script"
        if (gradleVersion < GRADLE_5) {
            assert result.output.contains(pluginApplicationLogMsgGradle4)
            assert 1 == result.output.count(pluginApplicationLogMsgGradle4)
            assert !result.output.contains(pluginApplicationLogMsgGradle5AndHigher)
        } else {
            assert result.output.contains(pluginApplicationLogMsgGradle5AndHigher)
            assert 1 == result.output.count(pluginApplicationLogMsgGradle5AndHigher)
            assert !result.output.contains(pluginApplicationLogMsgGradle4)
        }
    }

    void outputMissesDevelocityPluginApplicationViaInitScript(BuildResult result) {
        def pluginApplicationLogMsgGradle4 = "Applying com.gradle.scan.plugin.BuildScanPlugin via init script"
        def pluginApplicationLogMsgGradle5AndHigher = "Applying com.gradle.develocity.agent.gradle.DevelocityPlugin via init script"
        assert !result.output.contains(pluginApplicationLogMsgGradle4)
        assert !result.output.contains(pluginApplicationLogMsgGradle5AndHigher)
    }

    void outputContainsCcudPluginApplicationViaInitScript(BuildResult result) {
        def pluginApplicationLogMsg = "Applying com.gradle.CommonCustomUserDataGradlePlugin via init script"
        assert result.output.contains(pluginApplicationLogMsg)
        assert 1 == result.output.count(pluginApplicationLogMsg)
    }

    void outputMissesCcudPluginApplicationViaInitScript(BuildResult result) {
        def pluginApplicationLogMsg = "Applying com.gradle.CommonCustomUserDataGradlePlugin via init script"
        assert !result.output.contains(pluginApplicationLogMsg)
    }

    void outputContainsDevelocityConnectionInfo(BuildResult result, String develocityUrl, boolean develocityAllowUntrustedServer) {
        def develocityConnectionInfo = "Connection to Develocity: $develocityUrl, allowUntrustedServer: $develocityAllowUntrustedServer"
        assert result.output.contains(develocityConnectionInfo)
        assert 1 == result.output.count(develocityConnectionInfo)
    }

    void outputCaptureFileFingerprints(BuildResult result, boolean captureFileFingerprints) {
        def captureFileFingerprintsInfo = "Setting captureFileFingerprints: $captureFileFingerprints"
        assert result.output.contains(captureFileFingerprintsInfo)
        assert 1 == result.output.count(captureFileFingerprintsInfo)
    }

    void outputContainsPluginRepositoryInfo(BuildResult result, String gradlePluginRepositoryUrl, boolean withCredentials = false) {
        def repositoryInfo = "Develocity plugins resolution: ${gradlePluginRepositoryUrl}"
        assert result.output.contains(repositoryInfo)
        assert 1 == result.output.count(repositoryInfo)

        if (withCredentials) {
            def credentialsInfo = "Using credentials for plugin repository"
            assert result.output.contains(credentialsInfo)
            assert 1 == result.output.count(credentialsInfo)
        }
    }

    void outputEnforcesDevelocityUrl(BuildResult result, String develocityUrl, boolean develocityAllowUntrustedServer) {
        def enforceUrl = "Enforcing Develocity: $develocityUrl, allowUntrustedServer: $develocityAllowUntrustedServer"
        assert result.output.contains(enforceUrl)
        assert 1 == result.output.count(enforceUrl)
    }

    private BuildResult run(TestGradleVersion testGradleVersion, TestConfig config, List<String> args = ["help"]) {
        if (testKitSupportsEnvVars(testGradleVersion.gradleVersion)) {
            return run(args, initScript, testGradleVersion.gradleVersion, [], config.envVars)
        } else {
            return run(args, initScript, testGradleVersion.gradleVersion, config.jvmArgs, [:])
        }
    }

    private boolean testKitSupportsEnvVars(GradleVersion gradleVersion) {
        // TestKit supports env vars for Gradle 3.5+, except on M1 Mac where only 6.9+ is supported
        def isM1Mac = System.getProperty("os.arch") == "aarch64"
        if (isM1Mac) {
            return gradleVersion >= GRADLE_6_X.gradleVersion
        } else {
            return gradleVersion >= GRADLE_3_X.gradleVersion
        }
    }

    private TestConfig testConfig(String develocityPluginVersion = DEVELOCITY_PLUGIN_VERSION) {
        new TestConfig(develocityPluginVersion)
    }

    class TestConfig {
        String serverUrl = mockScansServer.address.toString()
        boolean enforceUrl = false
        String ccudPluginVersion = null
        String pluginRepositoryUrl = null
        String pluginRepositoryUsername = null
        String pluginRepositoryPassword = null
        boolean captureFileFingerprints = false
        String develocityPluginVersion

        TestConfig(String develocityPluginVersion) {
            this.develocityPluginVersion = develocityPluginVersion
        }

        TestConfig withCCUDPlugin(String version = CCUD_PLUGIN_VERSION) {
            ccudPluginVersion = version
            return this
        }

        TestConfig withServer(URI url, boolean enforceUrl = false) {
            serverUrl = url.toASCIIString()
            this.enforceUrl = enforceUrl
            return this
        }

        TestConfig withPluginRepository(URI pluginRepositoryUrl) {
            this.pluginRepositoryUrl = pluginRepositoryUrl
            return this
        }

        TestConfig withCaptureFileFingerprints() {
            this.captureFileFingerprints = true
            return this
        }

        TestConfig withPluginRepositoryCredentials(String pluginRepoUsername, String pluginRepoPassword) {
            this.pluginRepositoryUsername = pluginRepoUsername
            this.pluginRepositoryPassword = pluginRepoPassword
            return this
        }

        def getEnvVars() {
            Map<String, String> envVars = [
                DEVELOCITY_INJECTION_INIT_SCRIPT_NAME     : "gradle-actions.inject-develocity.init.gradle",
                DEVELOCITY_INJECTION_ENABLED              : "true",
                DEVELOCITY_URL                            : serverUrl,
                DEVELOCITY_ALLOW_UNTRUSTED_SERVER         : "true",
                DEVELOCITY_PLUGIN_VERSION                 : develocityPluginVersion,
                DEVELOCITY_BUILD_SCAN_UPLOAD_IN_BACKGROUND: "true", // Need to upload in background since our Mock server doesn't cope with foreground upload
                DEVELOCITY_AUTO_INJECTION_CUSTOM_VALUE    : 'gradle-actions'
            ]
            if (enforceUrl) envVars.put("DEVELOCITY_ENFORCE_URL", "true")
            if (ccudPluginVersion != null) envVars.put("DEVELOCITY_CCUD_PLUGIN_VERSION", ccudPluginVersion)
            if (pluginRepositoryUrl != null) envVars.put("GRADLE_PLUGIN_REPOSITORY_URL", pluginRepositoryUrl)
            if (pluginRepositoryUsername != null) envVars.put("GRADLE_PLUGIN_REPOSITORY_USERNAME", pluginRepositoryUsername)
            if (pluginRepositoryPassword != null) envVars.put("GRADLE_PLUGIN_REPOSITORY_PASSWORD", pluginRepositoryPassword)
            if (captureFileFingerprints) envVars.put("DEVELOCITY_CAPTURE_FILE_FINGERPRINTS", "true")

            return envVars
        }

        def getJvmArgs() {
            List<String> jvmArgs = [
                "-Ddevelocity.injection.init-script-name=gradle-actions.inject-develocity.init.gradle",
                "-Ddevelocity.injection-enabled=true",
                "-Ddevelocity.url=$serverUrl",
                "-Ddevelocity.allow-untrusted-server=true",
                "-Ddevelocity.plugin.version=$develocityPluginVersion",
                "-Ddevelocity.build-scan.upload-in-background=true",
                "-Ddevelocity.auto-injection.custom-value=gradle-actions"
            ]

            if (enforceUrl) jvmArgs.add("-Ddevelocity.enforce-url=true")
            if (ccudPluginVersion != null) jvmArgs.add("-Ddevelocity.ccud-plugin.version=$ccudPluginVersion")
            if (pluginRepositoryUrl != null) jvmArgs.add("-Dgradle.plugin-repository.url=$pluginRepositoryUrl")
            if (pluginRepositoryUsername != null) jvmArgs.add("-Dgradle.plugin-repository.username=$pluginRepositoryUsername")
            if (pluginRepositoryPassword != null) jvmArgs.add("-Dgradle.plugin-repository.password=$pluginRepositoryPassword")
            if (captureFileFingerprints) jvmArgs.add("-Ddevelocity.capture-file-fingerprints=true")

            return jvmArgs.collect { it.toString() } // Convert from GStrings
        }
    }
}
