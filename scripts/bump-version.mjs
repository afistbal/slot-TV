import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const packageJsonPath = resolve(process.cwd(), 'package.json');
const raw = await readFile(packageJsonPath, 'utf8');
const pkg = JSON.parse(raw);
const packageLockPath = resolve(process.cwd(), 'package-lock.json');

const version = String(pkg.version ?? '').trim();
const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);

if (!match) {
  throw new Error(`Invalid version format: "${version}". Expected x.y.z`);
}

const major = Number(match[1]);
const minor = Number(match[2]);
const patch = Number(match[3]) + 1;
const nextVersion = `${major}.${minor}.${patch}`;

pkg.version = nextVersion;

await writeFile(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
console.log(`[version] ${version} -> ${nextVersion}`);

try {
  const lock = JSON.parse(await readFile(packageLockPath, 'utf8'));
  lock.version = nextVersion;
  if (lock.packages?.['']) {
    lock.packages[''].version = nextVersion;
  }
  await writeFile(packageLockPath, `${JSON.stringify(lock, null, 2)}\n`, 'utf8');
  console.log(`[version-lock] package-lock.json -> ${nextVersion}`);
} catch (error) {
  if (error?.code !== 'ENOENT') {
    throw error;
  }
}

const { patchPublicHtmlFiles } = await import('./sync-public-html-assets.mjs');
await patchPublicHtmlFiles(nextVersion);
console.log(`[assets] public HTML icon refs -> ?v=${nextVersion}`);
