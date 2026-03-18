import * as core from '@actions/core'

import fs from 'fs'
import path from 'path'

import {ACTION_METADATA_DIR} from './configuration'

export function initializeGradleUserHome(userHome: string, gradleUserHome: string, encryptionKey?: string): void {
    // Create a directory for storing action metadata
    const actionCacheDir = path.resolve(gradleUserHome, ACTION_METADATA_DIR)
    fs.mkdirSync(actionCacheDir, {recursive: true})

    copyInitScripts(gradleUserHome)

    // Copy the default toolchain definitions to `~/.m2/toolchains.xml`
    registerToolchains(userHome)

    if (core.isDebug()) {
        configureInfoLogLevel(gradleUserHome)
    }

    if (encryptionKey) {
        core.exportVariable('GRADLE_ENCRYPTION_KEY', encryptionKey)
    }
}

function copyInitScripts(gradleUserHome: string): void {
    // Copy init scripts from src/resources to Gradle UserHome
    const initScriptsDir = path.resolve(gradleUserHome, 'init.d')
    fs.mkdirSync(initScriptsDir, {recursive: true})
    const initScriptFilenames = [
        'gradle-actions.build-result-capture.init.gradle',
        'gradle-actions.build-result-capture-service.plugin.groovy',
        'gradle-actions.github-dependency-graph.init.gradle',
        'gradle-actions.github-dependency-graph-gradle-plugin-apply.groovy',
        'gradle-actions.inject-develocity.init.gradle'
    ]
    for (const initScriptFilename of initScriptFilenames) {
        const initScriptContent = readResourceFileAsString('init-scripts', initScriptFilename)
        const initScriptPath = path.resolve(initScriptsDir, initScriptFilename)
        fs.writeFileSync(initScriptPath, initScriptContent)
    }
}

function registerToolchains(userHome: string): void {
    const preInstalledToolchains: string | null = getPredefinedToolchains()
    if (preInstalledToolchains == null) return

    const m2dir = path.resolve(userHome, '.m2')
    const toolchainXmlTarget = path.resolve(m2dir, 'toolchains.xml')
    if (!fs.existsSync(toolchainXmlTarget)) {
        // Write a new toolchains.xml file if it doesn't exist
        fs.mkdirSync(m2dir, {recursive: true})
        fs.writeFileSync(toolchainXmlTarget, preInstalledToolchains)

        core.info(`Wrote default JDK locations to ${toolchainXmlTarget}`)
    } else {
        // Merge into an existing toolchains.xml file
        const existingToolchainContent = fs.readFileSync(toolchainXmlTarget, 'utf8')
        const mergedContent = mergeToolchainContent(existingToolchainContent, preInstalledToolchains)

        fs.writeFileSync(toolchainXmlTarget, mergedContent)
        core.info(`Merged default JDK locations into ${toolchainXmlTarget}`)
    }
}

/**
 * When the GitHub environment ACTIONS_RUNNER_DEBUG is true, run Gradle with --info and --stacktrace.
 * see https://docs.github.com/en/actions/monitoring-and-troubleshooting-workflows/enabling-debug-logging
 *
 * @VisibleForTesting
 */
export function configureInfoLogLevel(gradleUserHome: string): void {
    const infoProperties = `org.gradle.logging.level=info\norg.gradle.logging.stacktrace=all\n`
    const propertiesFile = path.resolve(gradleUserHome, 'gradle.properties')
    if (fs.existsSync(propertiesFile)) {
        core.info(`Merged --info and --stacktrace into existing ${propertiesFile} file`)
        const existingProperties = fs.readFileSync(propertiesFile, 'utf-8')
        fs.writeFileSync(propertiesFile, `${infoProperties}\n${existingProperties}`)
    } else {
        core.info(`Created a new ${propertiesFile} with --info and --stacktrace`)
        fs.writeFileSync(propertiesFile, infoProperties)
    }
}

function readResourceFileAsString(...paths: string[]): string {
    // Resolving relative to `dist/<action>/main/index.js` will allow node to find the resource at runtime
    const moduleDir = import.meta.dirname
    const absolutePath = path.resolve(moduleDir, '..', '..', '..', 'sources', 'src', 'resources', ...paths)
    return fs.readFileSync(absolutePath, 'utf8')
}

/**
 * Iterate over all `JAVA_HOME_{version}_{arch}` envs and construct the toolchain.xml.
 *
 * @VisibleForTesting
 */
export function getPredefinedToolchains(): string | null {
    // Get the version and path for each JAVA_HOME env var
    const javaHomeEnvs = Object.entries(process.env)
        .filter(([key]) => key.startsWith('JAVA_HOME_') && process.env[key])
        .map(([key, value]) => ({
            jdkVersion: key.match(/JAVA_HOME_(\d+)_/)?.[1] ?? null,
            jdkPath: value as string
        }))
        .filter(env => env.jdkVersion !== null)

    if (javaHomeEnvs.length === 0) {
        return null
    }

    // language=XML
    return `<?xml version="1.0" encoding="UTF-8"?>
<toolchains>
<!-- JDK Toolchains installed by default on GitHub-hosted runners -->
${javaHomeEnvs
    .map(
        ({jdkVersion, jdkPath}) => `  <toolchain>
    <type>jdk</type>
    <provides>
      <version>${jdkVersion}</version>
    </provides>
    <configuration>
      <jdkHome>${jdkPath}</jdkHome>
    </configuration>
  </toolchain>`
    )
    .join('\n')}
</toolchains>\n`
}

export function mergeToolchainContent(existingToolchainContent: string, preInstalledToolchains: string): string {
    const appendedContent = preInstalledToolchains.split('<toolchains>').pop()!
    return existingToolchainContent.replace('</toolchains>', appendedContent)
}
