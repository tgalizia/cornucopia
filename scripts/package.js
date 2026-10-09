import { spawn } from 'node:child_process'
import { access, mkdir, readdir, readFile, rm } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const dist = path.join(root, 'dist')
const required = [
  'manifest.json',
  'background.js',
  'popup.js',
  'popup.html',
  'popup.css',
  'content.js',
  'grant.js',
  'grant.html',
  'docs-annotate.js',
  'icons/icon16.png',
  'icons/icon32.png',
  'icons/icon48.png',
  'icons/icon128.png',
]

await run('node', ['scripts/build.js'])

const manifest = JSON.parse(await readFile(path.join(dist, 'manifest.json'), 'utf8'))
assertStoreManifest(manifest)
await Promise.all(required.map((file) => access(path.join(dist, file))))
await assertNoSourceMaps(dist)

const release = path.join(root, 'release')
await mkdir(release, { recursive: true })
const zipPath = path.join(release, `cornucopia-${manifest.version}.zip`)
await rm(zipPath, { force: true })
await run('zip', ['-r', '-X', zipPath, '.', '-x', '*.DS_Store', '-x', '*.map'], { cwd: dist })

console.log(zipPath)

function assertStoreManifest(manifest) {
  if (manifest.manifest_version !== 3) {
    throw new Error('Chrome Web Store packages need manifest_version 3.')
  }
  if (manifest.update_url) {
    throw new Error('Remove update_url before uploading. The store rejects it.')
  }
  if (!/^\d{1,5}(\.\d{1,5}){0,3}$/.test(manifest.version)) {
    throw new Error(`Version "${manifest.version}" is not a Chrome Web Store version.`)
  }
  if (!manifest.description || manifest.description.length > 132) {
    throw new Error('manifest.description must be 1–132 characters.')
  }
  if (!manifest.icons?.['128']) {
    throw new Error('A 128px icon is required.')
  }
}

async function assertNoSourceMaps(dir) {
  const entries = await readdir(dir, { recursive: true })
  const maps = entries.filter((entry) => String(entry).endsWith('.map'))
  if (maps.length > 0) throw new Error(`Store package must not include source maps: ${maps.join(', ')}`)
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} exited with ${code}`))
    })
  })
}
