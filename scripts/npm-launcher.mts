#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const binaries: Record<string, string> = {
  'darwin-arm64': 'sshtty',
  'darwin-x64': 'sshtty',
  'linux-arm64': 'sshtty',
  'linux-x64': 'sshtty',
  'win32-x64': 'sshtty.exe',
}

const target = `${process.platform}-${process.arch}`
const binary = binaries[target]
if (!binary) {
  console.error(`sshtty does not support ${target}`)
  process.exit(1)
}

const result = spawnSync(
  path.join(import.meta.dirname, target, binary),
  process.argv.slice(2),
  { stdio: 'inherit' }
)
if (result.error) throw result.error
if (result.signal) process.kill(process.pid, result.signal)
process.exit(result.status)
