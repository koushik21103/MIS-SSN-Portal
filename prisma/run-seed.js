// Simple runner that loads .env.local then runs the seed
const fs = require('fs')
const path = require('path')

// Parse .env.local
const envPath = path.join(__dirname, '..', '.env.local')
const lines = fs.readFileSync(envPath, 'utf8').split('\n')
for (const line of lines) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eqIdx = trimmed.indexOf('=')
  if (eqIdx === -1) continue
  const key = trimmed.slice(0, eqIdx).trim()
  const val = trimmed.slice(eqIdx + 1).trim().replace(/^"(.*)"$/, '$1')
  process.env[key] = val
}

// Now run the seed via ts-node programmatically
require('ts-node').register({ compilerOptions: { module: 'commonjs' } })
require('./seed.ts')
