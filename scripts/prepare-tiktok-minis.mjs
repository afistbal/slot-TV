import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const mode = process.argv[2] || 'tiktok'
const clientKey = String({
  // Keep the existing local TikTok credentials available for variant modes
  // such as `tiktok-prod`; the variant env file only needs to override API
  // settings.
  ...loadEnv('tiktok', rootDir, ''),
  ...loadEnv(mode, rootDir, ''),
  ...process.env,
}.VITE_TIKTOK_MINIS_CLIENT_KEY ?? '').trim()

if (!clientKey) {
  throw new Error(
    'Missing VITE_TIKTOK_MINIS_CLIENT_KEY. Copy .env.tiktok.example to .env.tiktok.local and set your TikTok Client Key.',
  )
}

if (!/^[A-Za-z0-9_-]+$/.test(clientKey)) {
  throw new Error('VITE_TIKTOK_MINIS_CLIENT_KEY contains unsupported characters.')
}

const templatePath = path.join(rootDir, 'index.tiktok.html')
const outputPath = path.join(rootDir, 'index.tiktok.local.html')
const template = readFileSync(templatePath, 'utf-8')
const output = template.replaceAll('%VITE_TIKTOK_MINIS_CLIENT_KEY%', clientKey)

if (output === template) {
  throw new Error('TikTok Minis entry template is missing the Client Key placeholder.')
}

writeFileSync(outputPath, output, 'utf-8')
