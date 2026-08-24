package com.gradle.gradlebuildaction

import groovy.json.JsonSlurper

import static org.junit.Assume.assumeTrue

class TestBuildResultRecorder extends BaseInitScriptTest {
    def initScript = 'gradle-actions.build-result-capture.init.gradle'
    String latestGradleMajor

    def "produces build results file for build with #testGradleVersion"() {
        assumeTrue testGradleVersion.compatibleWithCurrentJvm

        when:
        run(testGradleVersion.gradleVersion)

        then:
        assertResults('help', testGradleVersion, false)

        where:
        testGradleVersion << ALL_VERSIONS
    }

    def "produces build results file for failing task with #testGradleVersion"() {
        assumeTrue testGradleVersion.compatibleWithCurrentJvm

        when:
        addFailingTaskToBuild()
        runAndFail(testGradleVersion.gradleVersion)

        then:
        assertResults('expectFailure', testGradleVersion, true)

        where:
        testGradleVersion << ALL_VERSIONS
    }

    def "produces build results file for failing configuration with #testGradleVersion"() {
        assumeTrue testGradleVersion.compatibleWithCurrentJvm

        when:
        buildFile << '''
throw new RuntimeException("Error in configuration")
'''
        runAndFail(testGradleVersion.gradleVersion)

        then:
        assertResults('expectFailure', testGradleVersion, true)

        where:
        testGradleVersion << SETTINGS_PLUGIN_VERSIONS // No build results generated for older Gradle versions
    }

    def "produces build results file for build that fails in included build with #testGradleVersion"() {
        assumeTrue testGradleVersion.compatibleWithCurrentJvm

        when:
        def includedBuildRoot = new File(testProjectDir, 'included-build')
        includedBuildRoot.mkdir()
        def includedSettings = new File(includedBuildRoot, 'settings.gradle')
        def includedBuild = new File(includedBuildRoot, 'build.gradle')

        includedSettings << """
            rootProject.name = 'included-build'
"""
        includedBuild << '''
task expectFailure {
    doLast {
        throw new RuntimeException("Expected to fail in included build")
    }
}
'''
        settingsFile << """
includeBuild('included-build')
"""
        buildFile << """
task expectFailure {
    dependsOn(gradle.includedBuild('included-build').task(':expectFailure'))
}
"""
        runAndFail(testGradleVersion.gradleVersion)

        then:
        assertResults('expectFailure', testGradleVersion, true)

        where:
        testGradleVersion << ALL_VERSIONS
    }

    def "produces build results file for build with --configuration-cache on #testGradleVersion"() {
        assumeTrue testGradleVersion.compatibleWithCurrentJvm

        when:
        run(['help', '--configuration-cache'], testGradleVersion.gradleVersion)

        then:
        assertResults('help', testGradleVersion, false, false)
        assert buildResultFile.delete()

        when:
        run(['help', '--configuration-cache'], testGradleVersion.gradleVersion)

        then:
        assertResults('help', testGradleVersion, false, true)

        where:
        testGradleVersion << CONFIGURATION_CACHE_VERSIONS
    }

    def "produces build results file for #testGradleVersion with build scan published"() {
        assumeTrue testGradleVersion.compatibleWithCurrentJvm

        when:
        declareDevelocityPluginApplication(testGradleVersion.gradleVersion)
        run(testGradleVersion.gradleVersion)

        then:
        assertResults('help', testGradleVersion, false)
        assertScanResults()

        where:
        testGradleVersion << ALL_VERSIONS
    }

    def "produces build results file for #testGradleVersion with legacy enterprise plugin publishing build scan"() {
        assumeTrue testGradleVersion.compatibleWithCurrentJvm

        when:
        declareLegacyGradleEnterprisePluginApplication(testGradleVersion.gradleVersion)
        run(testGradleVersion.gradleVersion)

        then:
        assertResults('help', testGradleVersion, false)
        assertScanResults()

        where:
        testGradleVersion << ALL_VERSIONS
    }

    def "produces build results file for #testGradleVersion with Develocity plugin and no build scan published"() {
        assumeTrue testGradleVersion.compatibleWithCurrentJvm

        when:
        declareDevelocityPluginApplication(testGradleVersion.gradleVersion)
        run(['help', '--no-scan'], testGradleVersion.gradleVersion)

        then:
        assertResults('help', testGradleVersion, false)

        where:
        testGradleVersion << ALL_VERSIONS
    }

    def "produces build results file for failing build on #testGradleVersion with build scan published"() {
        assumeTrue testGradleVersion.compatibleWithCurrentJvm

        when:
        declareDevelocityPluginApplication(testGradleVersion.gradleVersion)
        addFailingTaskToBuild()
        runAndFail(testGradleVersion.gradleVersion)

        then:
        assertResults('expectFailure', testGradleVersion, true)
        assertScanResults()

        where:
        testGradleVersion << ALL_VERSIONS
    }

    def "produces build results file for build with --configuration-cache on #testGradleVersion with build scan published"() {
        assumeTrue testGradleVersion.compatibleWithCurrentJvm

        when:
        declareDevelocityPluginApplication(testGradleVersion.gradleVersion)
        run(['help', '--configuration-cache'], testGradleVersion.gradleVersion)

        then:
        assertResults('help', testGradleVersion, false, false)
        assertScanResults()
        assert buildResultFile.delete()
        assert scanResultFile.delete()

        when:
        run(['help', '--configuration-cache'], testGradleVersion.gradleVersion)

        then:
        assertResults('help', testGradleVersion, false, true)
        assertScanResults()

        where:
        testGradleVersion << CONFIGURATION_CACHE_VERSIONS
    }

    def "produces build results file for failing build on #testGradleVersion when build scan publish fails"() {
        assumeTrue testGradleVersion.compatibleWithCurrentJvm

        when:
        declareDevelocityPluginApplication(testGradleVersion.gradleVersion)
        addFailingTaskToBuild()
        failScanUpload = true
        runAndFail(testGradleVersion.gradleVersion)

        then:
        assertResults('expectFailure', testGradleVersion, true)
        assertScanResults(true)

        where:
        testGradleVersion << ALL_VERSIONS
    }

    def "produces no build results file when GitHub env vars not set with #testGradleVersion"() {
        assumeTrue testGradleVersion.compatibleWithCurrentJvm

        when:
        run(['help'], initScript, testGradleVersion.gradleVersion,
            ["-DRUNNER_TEMP=", "-DGITHUB_ACTION="],
            [RUNNER_TEMP: '', GITHUB_ACTION: ''])

        then:
        def buildResultsDir = new File(testProjectDir, '.build-results')
        assert !buildResultsDir.exists()

        where:
        testGradleVersion << ALL_VERSIONS
    }

    def "produces no build results file when RUNNER_TEMP dir is not a writable directory with #testGradleVersion"() {
        assumeTrue testGradleVersion.compatibleWithCurrentJvm

        when:
        def invalidDir = new File(testProjectDir, 'invalid-runner-temp')
        invalidDir.createNewFile()

        run(['help'], initScript, testGradleVersion.gradleVersion,
            ["-DRUNNER_TEMP=${invalidDir.absolutePath}".toString()],
            [RUNNER_TEMP: invalidDir.absolutePath])

        then:
        def buildResultsDir = new File(testProjectDir, '.build-results')
        assert !buildResultsDir.exists()

        where:
        testGradleVersion << ALL_VERSIONS
    }

    def "produces build results file with build scan when Develocity plugin is applied in settingsEvaluated"() {
        assumeTrue testGradleVersion.compatibleWithCurrentJvm

        when:
        settingsFile.text = """
            plugins {
                id 'com.gradle.develocity' version '4.5.0' apply(false)
            }
            gradle.settingsEvaluated {
                apply plugin: 'com.gradle.develocity'
                develocity {
                    server = '$mockScansServer.address'
                }
            }
        """ + settingsFile.text

        allowDevelocityDeprecationWarning = true
        run(testGradleVersion.gradleVersion)

        then:
        assertResults('help', testGradleVersion, false)
        assertScanResults()

        where:
        testGradleVersion << SETTINGS_PLUGIN_VERSIONS
    }

    def "captures version status '#expectedStatus' when the latest released major is #latestMajor"() {
        assumeTrue GRADLE_8_X.compatibleWithCurrentJvm

        when:
        latestGradleMajor = latestMajor
        run(GRADLE_8_X.gradleVersion)

        then:
        assertVersionStatus(expectedStatus)

        where:
        latestMajor | expectedStatus
        '7'         | 'active'
        '8'         | 'active'
        '9'         | 'maintenance'
        '10'        | 'eol'
        '13'        | 'eol'
    }

    def "captures version status for #testGradleVersion"() {
        assumeTrue testGradleVersion.compatibleWithCurrentJvm

        when:
        latestGradleMajor = '9'
        run(testGradleVersion.gradleVersion)

        then:
        assertVersionStatus(expectedStatus)

        where:
        testGradleVersion | expectedStatus
        GRADLE_6_X        | 'eol'
        GRADLE_7_X        | 'eol'
        GRADLE_8_X        | 'maintenance'
    }

    def "captures no version status when the action did not supply the latest released major"() {
        assumeTrue GRADLE_8_X.compatibleWithCurrentJvm

        when:
        run(GRADLE_8_X.gradleVersion)

        then:
        assertVersionStatus(null)
    }

    def "captures no version status when the latest released major is not a number"() {
        assumeTrue GRADLE_8_X.compatibleWithCurrentJvm

        when:
        latestGradleMajor = 'not-a-number'
        run(GRADLE_8_X.gradleVersion)

        then:
        assertVersionStatus(null)
    }

    def run(def args = ['help'], def gradleVersion) {
        return run(args, initScript, gradleVersion, jvmArgs, envVars)
    }

    def runAndFail(def gradleVersion) {
        return runAndFail(['expectFailure'], initScript, gradleVersion, jvmArgs, envVars)
    }

    def getJvmArgs() {
        def jvmArgs = [
            "-DRUNNER_TEMP=${testProjectDir.absolutePath}".toString(),
            "-DGITHUB_ACTION=github-step-id".toString()
        ]
        if (latestGradleMajor != null) {
            jvmArgs << "-DGRADLE_ACTIONS_LATEST_GRADLE_MAJOR=${latestGradleMajor}".toString()
        }
        jvmArgs
    }

    def getEnvVars() {
        def envVars = [
            RUNNER_TEMP: testProjectDir.absolutePath,
            GITHUB_ACTION: 'github-step-id',
            GITHUB_OUTPUT: githubOutputFile.absolutePath
        ]
        if (latestGradleMajor != null) {
            envVars.GRADLE_ACTIONS_LATEST_GRADLE_MAJOR = latestGradleMajor
        }
        envVars
    }

    void assertResults(String task, TestGradleVersion testGradleVersion, boolean hasFailure, boolean configCacheHit = false) {
        def results = new JsonSlurper().parse(buildResultFile)
        assert results['rootProjectName'] == ROOT_PROJECT_NAME
        assert results['rootProjectDir'] == testProjectDir.canonicalPath
        assert results['requestedTasks'] == task
        assert results['gradleVersion'] == testGradleVersion.gradleVersion.version
        assert results['gradleHomeDir'] != null
        assert results['buildFailed'] == hasFailure
        assert results['configCacheHit'] == configCacheHit
    }

    void assertScanResults(boolean scanUploadFailed = false) {
        def scanResults = new JsonSlurper().parse(scanResultFile)
        assert scanResults['buildScanUri'] == (scanUploadFailed ? null : "${mockScansServer.address}s/${PUBLIC_BUILD_SCAN_ID}")
        assert scanResults['buildScanFailed'] == scanUploadFailed
    }

    void assertVersionStatus(String expectedStatus) {
        def results = new JsonSlurper().parse(buildResultFile)
        assert results['versionStatus'] == expectedStatus
        if (expectedStatus == null) {
            assert !githubOutput.contains('gradle-version-status')
        } else {
            assert githubOutput.contains("gradle-version-status=${expectedStatus}")
        }
    }

    private File getGithubOutputFile() {
        new File(testProjectDir, 'github-output')
    }

    private String getGithubOutput() {
        githubOutputFile.exists() ? githubOutputFile.text : ''
    }

    private File getBuildResultFile() {
        def buildResultsDir = new File(testProjectDir, '.gradle-actions/build-results')
        assert buildResultsDir.directory
        assert buildResultsDir.listFiles().size() == 1
        def resultsFile = buildResultsDir.listFiles()[0]
        assert resultsFile.name.startsWith('github-step-id')
        assert resultsFile.text.count('rootProjectName') == 1
        return resultsFile
    }

    private File getScanResultFile() {
        def buildResultsDir = new File(testProjectDir, '.gradle-actions/build-scans')
        assert buildResultsDir.directory
        assert buildResultsDir.listFiles().size() == 1
        def resultsFile = buildResultsDir.listFiles()[0]
        assert resultsFile.name.startsWith('github-step-id')
        assert resultsFile.text.count('buildScanUri') == 1
        return resultsFile
    }
}
