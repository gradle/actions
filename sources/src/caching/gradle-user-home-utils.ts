import path from 'path'
import fs from 'fs'

export function readResourceFileAsString(...paths: string[]): string {
    // Resolving relative to __dirname will allow node to find the resource at runtime
    const absolutePath = path.resolve(__dirname, '..', '..', '..', 'sources', 'src', 'resources', ...paths)
    return fs.readFileSync(absolutePath, 'utf8')
}

/**
 * Iterate over all `JAVA_HOME_{version}_{arch}` envs and construct the toolchain.xml.
 *
 * @VisibleForTesting
 */
export function getPredefinedToolchains(): string | null {
    const javaHomeEnvs: string[] = []
    for (const javaHomeEnvsKey in process.env) {
        if (javaHomeEnvsKey.startsWith('JAVA_HOME_')) {
            javaHomeEnvs.push(javaHomeEnvsKey)
        }
    }
    if (javaHomeEnvs.length === 0) {
        return null
    }
    // language=XML
    let toolchainsXml = `<?xml version="1.0" encoding="UTF-8"?>
<toolchains>
<!-- JDK Toolchains installed by default on GitHub-hosted runners -->
`
    for (const javaHomeEnv of javaHomeEnvs) {
        const version = javaHomeEnv.match(/JAVA_HOME_(\d+)_/)?.[1]!
        toolchainsXml += `  <toolchain>
    <type>jdk</type>
    <provides>
      <version>${version}</version>
    </provides>
    <configuration>
      <jdkHome>\${env.${javaHomeEnv}}</jdkHome>
    </configuration>
  </toolchain>\n`
    }
    toolchainsXml += `</toolchains>\n`
    return toolchainsXml
}

export function mergeToolchainContent(existingToolchainContent: string, preInstalledToolchains: string): string {
    const appendedContent = preInstalledToolchains.split('<toolchains>').pop()!
    return existingToolchainContent.replace('</toolchains>', appendedContent)
}
