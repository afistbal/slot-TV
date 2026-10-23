import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SUPPORTED_MODES = new Set(['dev', 'development', 'prod', 'production']);
const COMMIT_FILES = ['index.html', 'sw.js'];
const VERSION_MANAGED_FILES = [
  'package.json',
  'package-lock.json',
  'index.html',
  'public/reelshort-privacy-policy.html',
  'public/airwallex.html',
];
const KNOWN_OUT_DIR_PATTERN = /^D:\/JJ-TV\/movie-www(?:-prod\d*)?$/i;

function normalizedPath(value) {
  return path.resolve(value).replaceAll('\\', '/');
}

export function outDirForMode(mode) {
  return mode === 'prod' || mode === 'production'
    ? 'D:/JJ-TV/movie-www-prod'
    : 'D:/JJ-TV/movie-www';
}

export function assertSupportedMode(mode) {
  if (!SUPPORTED_MODES.has(mode)) {
    throw new Error(`Unsupported build mode: ${mode}`);
  }
}

export function assertKnownOutDir(outDir) {
  const resolved = normalizedPath(outDir);
  if (!KNOWN_OUT_DIR_PATTERN.test(resolved)) {
    throw new Error(`[release-build] Refusing to publish to unknown output directory: ${resolved}`);
  }
  if (existsSync(resolved) && lstatSync(resolved).isSymbolicLink()) {
    throw new Error(`[release-build] Refusing to publish to a linked output directory: ${resolved}`);
  }
  return resolved;
}

export function nextPatchVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version ?? '').trim());
  if (!match) {
    throw new Error(`Invalid version format: "${String(version ?? '')}". Expected x.y.z`);
  }
  return `${Number(match[1])}.${Number(match[2])}.${Number(match[3]) + 1}`;
}

function readCurrentPackageVersion() {
  const pkg = JSON.parse(readFileSync(path.resolve('package.json'), 'utf8'));
  return String(pkg.version ?? '').trim();
}

function snapshotVersionFiles() {
  return VERSION_MANAGED_FILES.map((relativePath) => {
    const filePath = path.resolve(relativePath);
    return {
      filePath,
      content: existsSync(filePath) ? readFileSync(filePath) : null,
    };
  });
}

function sameSnapshotContent(current, expected) {
  if (current === null || expected === null) return current === expected;
  return current.equals(expected);
}

function restoreVersionFiles(original, expectedCurrent = null) {
  for (let index = 0; index < original.length; index += 1) {
    const before = original[index];
    const current = existsSync(before.filePath) ? readFileSync(before.filePath) : null;
    const expected = expectedCurrent?.[index]?.content ?? null;

    if (expectedCurrent && !sameSnapshotContent(current, expected)) {
      console.warn(`[release-build] Not restoring concurrently changed file: ${before.filePath}`);
      continue;
    }

    if (before.content === null) {
      rmSync(before.filePath, { force: true });
    } else {
      writeFileSync(before.filePath, before.content);
    }
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...options.env },
    shell: false,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

function walkFiles(dir) {
  const files = [];
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    } else {
      throw new Error(`[release-build] Unsupported staged entry: ${fullPath}`);
    }
  }
  return files;
}

function stripUrlSuffix(value) {
  return value.split('#', 1)[0].split('?', 1)[0];
}

function shouldValidateLocalReference(value) {
  if (!value || /^(?:[a-z]+:|\/\/|#)/i.test(value)) return false;
  const clean = stripUrlSuffix(value);
  return clean.startsWith('/') || clean.startsWith('./') || clean.startsWith('../');
}

function assertReferenceExists(stagingDir, sourceFile, rawReference) {
  if (!shouldValidateLocalReference(rawReference)) return;
  const clean = stripUrlSuffix(rawReference);
  if (clean === '/') return;
  const referencedPath = clean.startsWith('/')
    ? path.join(stagingDir, ...clean.slice(1).split('/'))
    : path.resolve(path.dirname(sourceFile), clean);
  if (!existsSync(referencedPath)) {
    throw new Error(
      `[release-build] Missing staged reference ${rawReference} from ${path.relative(stagingDir, sourceFile)}`,
    );
  }
}

function validateAssetDependencies(stagingDir, assetFile) {
  const source = readFileSync(assetFile, 'utf8');
  const patterns = /\.css$/i.test(assetFile)
    ? [/\burl\(\s*["']?([^"'()\s]+)["']?\s*\)/gi]
    : [
        /\bimport\s*(?:\(\s*)?["']([^"']+)["']/g,
        /\bfrom\s*["']([^"']+)["']/g,
        /\bnew\s+URL\(\s*["']([^"']+)["']\s*,\s*import\.meta\.url/g,
        /["'](assets\/[^"'?#\s]+\.[a-zA-Z0-9]+)(?:[?#][^"']*)?["']/g,
      ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const reference = match[1].startsWith('assets/') ? `/${match[1]}` : match[1];
      assertReferenceExists(stagingDir, assetFile, reference);
    }
  }
}

export function validateStaging(stagingDir) {
  const resolved = path.resolve(stagingDir);
  for (const name of ['index.html', 'sw.js', 'manifest.json', 'assets']) {
    if (!existsSync(path.join(resolved, name))) {
      throw new Error(`[release-build] Missing required staged output: ${name}`);
    }
  }

  const workboxFiles = readdirSync(resolved).filter((name) => /^workbox-[\w-]+\.js$/i.test(name));
  if (workboxFiles.length === 0) {
    throw new Error('[release-build] Missing generated workbox runtime');
  }

  const assetFiles = walkFiles(path.join(resolved, 'assets'));
  if (!assetFiles.some((file) => /\.js$/i.test(file))) {
    throw new Error('[release-build] Staged assets contain no JavaScript bundle');
  }
  for (const assetFile of assetFiles.filter((file) => /\.(?:js|css)$/i.test(file))) {
    validateAssetDependencies(resolved, assetFile);
  }

  for (const htmlPath of walkFiles(resolved).filter((file) => /\.html$/i.test(file))) {
    const html = readFileSync(htmlPath, 'utf8');
    for (const match of html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)=["']([^"']+)["']/gi)) {
      assertReferenceExists(resolved, htmlPath, match[1]);
    }
  }

  const swPath = path.join(resolved, 'sw.js');
  const sw = readFileSync(swPath, 'utf8');
  for (const match of sw.matchAll(/\burl\s*:\s*["']([^"']+)["']/g)) {
    assertReferenceExists(resolved, swPath, `/${match[1].replace(/^\/+/, '')}`);
  }
  for (const match of sw.matchAll(/importScripts\(([^)]*)\)/g)) {
    for (const script of match[1].matchAll(/["']([^"']+)["']/g)) {
      assertReferenceExists(resolved, swPath, script[1]);
    }
  }
  for (const match of sw.matchAll(/["']\.\/(workbox-[\w-]+)["']/g)) {
    const fileName = match[1].endsWith('.js') ? match[1] : `${match[1]}.js`;
    assertReferenceExists(resolved, swPath, `./${fileName}`);
  }

  return {
    assets: assetFiles.length,
    workbox: workboxFiles.length,
  };
}

function replaceFileAtomically(source, target) {
  mkdirSync(path.dirname(target), { recursive: true });
  const tempTarget = `${target}.release-${process.pid}-${Math.random().toString(16).slice(2)}.tmp`;
  copyFileSync(source, tempTarget);
  try {
    renameSync(tempTarget, target);
  } catch (error) {
    const backup = `${target}.release-${process.pid}.bak`;
    let movedOldFile = false;
    try {
      if (existsSync(target)) {
        renameSync(target, backup);
        movedOldFile = true;
      }
      renameSync(tempTarget, target);
      if (movedOldFile) rmSync(backup, { force: true });
    } catch (replaceError) {
      rmSync(tempTarget, { force: true });
      if (movedOldFile && !existsSync(target) && existsSync(backup)) {
        renameSync(backup, target);
      }
      throw replaceError;
    }
    if (error?.code !== 'EEXIST' && error?.code !== 'EPERM') {
      // The fallback succeeded, so this platform simply does not replace an
      // existing file with rename. No action is needed.
    }
  }
}

function mergeDirectory(sourceDir, targetDir) {
  mkdirSync(targetDir, { recursive: true });
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const source = path.join(sourceDir, entry.name);
    const target = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      mergeDirectory(source, target);
    } else if (entry.isFile()) {
      replaceFileAtomically(source, target);
    } else {
      throw new Error(`[release-build] Refusing to publish linked/special entry: ${source}`);
    }
  }
}

/**
 * Merge a clean staged build into the deployment checkout. Existing hashed
 * assets are intentionally retained; index.html and sw.js are committed only
 * after every dependency has been copied and pruning has succeeded.
 */
export function publishStaging(stagingDir, outDir, { prune = true } = {}) {
  const staging = path.resolve(stagingDir);
  const target = path.resolve(outDir);
  mkdirSync(target, { recursive: true });

  // Scan while the currently published index, secondary HTML entries and SW
  // are still intact. This both removes expired history and starts a fresh
  // seven-day grace period for the version that is about to be superseded.
  if (prune) {
    run(process.execPath, ['./scripts/prune-old-assets.mjs', target, '--days=7']);
  }

  const stagedAssets = path.join(staging, 'assets');
  mergeDirectory(stagedAssets, path.join(target, 'assets'));

  for (const entry of readdirSync(staging, { withFileTypes: true })) {
    if (entry.name === 'assets' || COMMIT_FILES.includes(entry.name)) continue;
    const source = path.join(staging, entry.name);
    const destination = path.join(target, entry.name);
    if (entry.isDirectory()) {
      mergeDirectory(source, destination);
    } else if (entry.isFile()) {
      replaceFileAtomically(source, destination);
    } else {
      throw new Error(`[release-build] Refusing to publish linked/special entry: ${source}`);
    }
  }

  // The document becomes visible only after all of its files are present.
  replaceFileAtomically(path.join(staging, 'index.html'), path.join(target, 'index.html'));
  // Publish the service worker last so an update cannot activate prematurely.
  replaceFileAtomically(path.join(staging, 'sw.js'), path.join(target, 'sw.js'));
}

export async function releaseBuild(mode) {
  assertSupportedMode(mode);
  const outDir = assertKnownOutDir(outDirForMode(mode));
  const stagingDir = mkdtempSync(path.join(tmpdir(), 'slot-tv-release-'));

  try {
    // Type/build errors must not destroy the working deployment or increment
    // the checked-in version. The next version is injected only into staging.
    run(process.execPath, [path.resolve('node_modules/typescript/bin/tsc'), '-b']);
    const nextVersion = nextPatchVersion(readCurrentPackageVersion());
    run(process.execPath, [path.resolve('node_modules/vite/bin/vite.js'), 'build', '--mode', mode], {
      env: {
        VITE_OUT_DIR: stagingDir,
        VITE_APP_VERSION_OVERRIDE: nextVersion,
      },
    });

    const summary = validateStaging(stagingDir);
    console.log(
      `[release-build] validated staging (${summary.assets} assets, ${summary.workbox} workbox runtime)`,
    );

    const versionFilesBefore = snapshotVersionFiles();
    let versionFilesAfter = null;
    try {
      run(process.execPath, ['./scripts/bump-version.mjs']);
      if (readCurrentPackageVersion() !== nextVersion) {
        throw new Error(`[release-build] Version bump did not produce expected version ${nextVersion}`);
      }
      versionFilesAfter = snapshotVersionFiles();
      publishStaging(stagingDir, outDir);
    } catch (error) {
      try {
        restoreVersionFiles(versionFilesBefore, versionFilesAfter);
      } catch (restoreError) {
        console.error('[release-build] Failed to restore version files after release failure', restoreError);
      }
      throw error;
    }
    console.log(`[release-build] published ${mode} -> ${outDir}`);
  } finally {
    rmSync(stagingDir, { recursive: true, force: true });
  }
}

const invokedPath = process.argv[1] ? normalizedPath(process.argv[1]) : '';
const modulePath = normalizedPath(fileURLToPath(import.meta.url));
if (invokedPath.toLowerCase() === modulePath.toLowerCase()) {
  const mode = String(process.argv[2] || 'dev').trim();
  releaseBuild(mode).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
