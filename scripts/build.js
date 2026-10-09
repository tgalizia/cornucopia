import esbuild from 'esbuild'
import { access, cp, mkdir, rm } from 'node:fs/promises'
import { renderIcons } from './icons.js'

const watch = process.argv.includes('--watch')
const sizes = [16, 32, 48, 128]

async function copyStatic() {
  await mkdir('dist/icons', { recursive: true })
  await cp('manifest.json', 'dist/manifest.json')
  await cp('src/popup/popup.html', 'dist/popup.html')
  await cp('src/popup/popup.css', 'dist/popup.css')
  await cp('src/tools/clear-data/grant.html', 'dist/grant.html')
  await cp('src/content/docs-annotate.js', 'dist/docs-annotate.js')
  for (const size of sizes) {
    await cp(`icons/icon${size}.png`, `dist/icons/icon${size}.png`)
  }
}

async function assertPackage() {
  const files = [
    'dist/manifest.json',
    'dist/background.js',
    'dist/popup.js',
    'dist/popup.html',
    'dist/popup.css',
    'dist/content.js',
    'dist/grant.js',
    'dist/grant.html',
    'dist/docs-annotate.js',
    ...sizes.map((size) => `dist/icons/icon${size}.png`),
  ]
  await Promise.all(files.map((file) => access(file)))
}

await renderIcons()
if (!watch) await rm('dist', { recursive: true, force: true })
await mkdir('dist', { recursive: true })

const options = {
  entryPoints: {
    background: 'src/background/index.js',
    popup: 'src/popup/popup.js',
    content: 'src/content/main.js',
    grant: 'src/tools/clear-data/grant.js',
  },
  bundle: true,
  outdir: 'dist',
  format: 'iife',
  loader: { '.css': 'text' },
  target: ['chrome102'],
  legalComments: 'none',
  logLevel: 'info',
  sourcemap: watch ? 'inline' : false,
  plugins: [{
    name: 'copy-static',
    setup(build) {
      build.onEnd(async (result) => {
        if (result.errors.length > 0) return
        await copyStatic()
      })
    },
  }],
}

if (watch) {
  const ctx = await esbuild.context(options)
  await ctx.watch()
  console.log('Watching for changes')
} else {
  await esbuild.build(options)
  await assertPackage()
}
