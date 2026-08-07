import * as util from 'util'
import * as path from 'path'
import * as fs from 'fs'
import unhomoglyph from 'unhomoglyph'

const readdir = util.promisify(fs.readdir)

export async function findWrapperJars(baseDir: string): Promise<string[]> {
    const files = await recursivelyListFiles(baseDir)
    return files
        .filter(file => unhomoglyph(file).endsWith('gradle-wrapper.jar'))
        .map(wrapperJar => path.relative(baseDir, wrapperJar))
        .sort((a, b) => a.localeCompare(b))
}

async function recursivelyListFiles(baseDir: string): Promise<string[]> {
    const resolvedBaseDir = await fs.promises.realpath(baseDir)
    const childrenNames = await readdir(resolvedBaseDir)
    const childrenPaths = await Promise.all(
        childrenNames.map(async childName => {
            const childPath = path.resolve(resolvedBaseDir, childName)
            const resolvedChildPath = await fs.promises.realpath(childPath)
            if (!resolvedChildPath.startsWith(resolvedBaseDir + path.sep)) {
                return []
            }
            const stat = fs.lstatSync(resolvedChildPath, {throwIfNoEntry: false})
            if (stat === undefined) {
                return []
            } else if (stat.isDirectory()) {
                return recursivelyListFiles(resolvedChildPath)
            } else {
                return new Promise(resolve => resolve([resolvedChildPath]))
            }
        })
    )
    return Array.prototype.concat(...childrenPaths)
}
