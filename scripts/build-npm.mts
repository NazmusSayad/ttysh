import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import path from 'node:path'

const root = path.join(import.meta.dirname, '..')
const output = path.join(root, 'dist', 'npm')

const manifest = {
  name: 'sshtty',
  version: '0.0.0',
  type: 'module',
  license: 'MIT',
  repository: {
    type: 'git',
    url: 'git+https://github.com/NazmusSayad/sshtty.git',
  },
  bin: { sshtty: 'bin/sshtty.js' },
}

mkdirSync(path.join(output, 'bin'), { recursive: true })
writeFileSync(
  path.join(output, 'bin', 'sshtty.js'),
  stripTypeScriptTypes(
    readFileSync(path.join(import.meta.dirname, 'npm-launcher.mts'), 'utf8')
  )
)
copyFileSync(path.join(root, 'LICENSE'), path.join(output, 'LICENSE'))
copyFileSync(path.join(root, 'README.md'), path.join(output, 'README.md'))
writeFileSync(
  path.join(output, 'package.json'),
  `${JSON.stringify(manifest, null, 2)}\n`
)
console.log(`npm package written to ${output}`)
