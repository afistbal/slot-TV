import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { after, test } from 'node:test';
import { nextPatchVersion, publishStaging, validateStaging } from './release-build.mjs';

const root = mkdtempSync(path.join(tmpdir(), 'slot-tv-release-test-'));
after(() => rmSync(root, { recursive: true, force: true }));

function write(relativePath, text = '') {
  const filePath = path.join(root, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, text);
  return filePath;
}

function createStaging(name = 'staging') {
  write(`${name}/index.html`, '<link rel="stylesheet" href="/assets/index-new.css"><script type="module" src="/assets/index-new.js"></script>');
  write(`${name}/sw.js`, 'define(["./workbox-new"],function(){importScripts("/pwa-force-reload.js?v=2");const x=[{url:"assets/index-new.js"},{url:"assets/index-new.css"}]})');
  write(`${name}/manifest.json`, '{}');
  write(`${name}/workbox-new.js`, '/* current workbox */');
  write(`${name}/pwa-force-reload.js`, '/* reload */');
  write(`${name}/assets/index-new.js`, 'import "./lazy-new.js";');
  write(`${name}/assets/lazy-new.js`, 'export default 1;');
  write(`${name}/assets/index-new.css`, 'body{}');
  return path.join(root, name);
}

test('computes the staged patch version without mutating source files', () => {
  assert.equal(nextPatchVersion('2.1.32'), '2.1.33');
  assert.throws(() => nextPatchVersion('2.1'), /Expected x\.y\.z/);
});

test('rejects a staged bundle with a missing relative lazy dependency', () => {
  const staging = createStaging('missing-dependency-staging');
  rmSync(path.join(staging, 'assets/lazy-new.js'));
  assert.throws(() => validateStaging(staging), /Missing staged reference/);
});

test('validates and publishes a clean staging build without deleting old assets', () => {
  const staging = createStaging();
  const target = path.join(root, 'target');
  write('target/index.html', '<script src="/assets/index-old.js"></script>');
  write('target/sw.js', 'define(["./workbox-old-current"],function(){})');
  const oldEntry = write('target/assets/index-old.js', 'import "./lazy-old.js";');
  const oldLazy = write('target/assets/lazy-old.js', '/* old lazy */');
  const oldWorkbox = write('target/workbox-old-current.js', '/* old current */');
  const oldTime = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  for (const file of [oldEntry, oldLazy, oldWorkbox]) {
    utimesSync(file, oldTime, oldTime);
  }

  const summary = validateStaging(staging);
  assert.equal(summary.assets, 3);
  assert.equal(summary.workbox, 1);

  publishStaging(staging, target);

  assert.ok(existsSync(path.join(target, 'assets/index-old.js')));
  assert.ok(existsSync(path.join(target, 'assets/lazy-old.js')));
  assert.ok(existsSync(path.join(target, 'assets/index-new.js')));
  assert.ok(existsSync(path.join(target, 'workbox-old-current.js')));
  assert.match(readFileSync(path.join(target, 'index.html'), 'utf8'), /index-new/);
  assert.match(readFileSync(path.join(target, 'sw.js'), 'utf8'), /workbox-new/);
});

test('seven-day prune protects current references and removes expired historical files', () => {
  const target = path.join(root, 'prune-target');
  write('prune-target/index.html', '<script src="/assets/current.js"></script>');
  write('prune-target/sw.js', 'define(["./workbox-current"],function(){})');
  const currentAsset = write('prune-target/assets/current.js', 'import "./current-lazy.js";');
  const currentLazyAsset = write('prune-target/assets/current-lazy.js', '/* current lazy */');
  const oldAsset = write('prune-target/assets/expired.js', '/* expired */');
  const currentWorkbox = write('prune-target/workbox-current.js', '/* current */');
  const oldWorkbox = write('prune-target/workbox-expired.js', '/* expired */');
  const oldTime = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  for (const file of [currentAsset, currentLazyAsset, oldAsset, currentWorkbox, oldWorkbox]) {
    utimesSync(file, oldTime, oldTime);
  }

  const result = spawnSync(process.execPath, [
    path.resolve('scripts/prune-old-assets.mjs'),
    target,
    '--days=7',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  assert.ok(existsSync(currentAsset));
  assert.ok(existsSync(currentLazyAsset));
  assert.ok(!existsSync(oldAsset));
  assert.ok(existsSync(currentWorkbox));
  assert.ok(!existsSync(oldWorkbox));
  assert.ok((Date.now() - statSync(currentAsset).mtimeMs) < 60_000);
  assert.ok((Date.now() - statSync(currentLazyAsset).mtimeMs) < 60_000);
  assert.ok((Date.now() - statSync(currentWorkbox).mtimeMs) < 60_000);
});

test('invalid retention cannot delete unreferenced assets', () => {
  const target = path.join(root, 'invalid-retention-target');
  write('invalid-retention-target/index.html', '<main></main>');
  write('invalid-retention-target/assets/unreferenced.js', '/* keep on invalid input */');

  const result = spawnSync(process.execPath, [
    path.resolve('scripts/prune-old-assets.mjs'),
    target,
    '--days=not-a-number',
  ], { encoding: 'utf8' });

  assert.notEqual(result.status, 0);
  assert.ok(existsSync(path.join(target, 'assets/unreferenced.js')));
});
