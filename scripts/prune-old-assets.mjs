import fs from 'fs';
import path from 'path';

const cliOutDir = process.argv[2];
const outDir = path.resolve(cliOutDir || 'D:/JJ-TV/movie-www');
const assetsDir = path.join(outDir, 'assets');
const daysArg = process.argv.find((arg) => arg.startsWith('--days='));
const retentionDays = Number(daysArg?.split('=')[1] || process.env.ASSET_RETENTION_DAYS || 7);
const retentionMs = Math.max(1, retentionDays) * 24 * 60 * 60 * 1000;
const cutoff = Date.now() - retentionMs;
const assetRefPattern = /(?:\/|["'(`])(?:\.\/)?assets\/([^"'()`\s?#]+\.[a-zA-Z0-9]+)(?:[?#][^"'()`\s]*)?/g;
const keepAssets = new Set();
const scannedFiles = new Set();

function exists(p) {
    try {
        return fs.existsSync(p);
    } catch {
        return false;
    }
}

function walkFiles(dir) {
    if (!exists(dir)) return [];

    const files = [];
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, ent.name);
        if (ent.isDirectory()) {
            files.push(...walkFiles(fullPath));
        } else if (ent.isFile()) {
            files.push(fullPath);
        }
    }
    return files;
}

function readText(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch {
        return '';
    }
}

function addAssetRef(assetName) {
    const normalized = assetName.replaceAll('\\', '/');
    if (!normalized || keepAssets.has(normalized)) return;
    keepAssets.add(normalized);

    const assetPath = path.join(assetsDir, ...normalized.split('/'));
    if (/\.(js|css)$/i.test(normalized)) {
        scanFile(assetPath);
    }
}

function scanFile(filePath) {
    if (!exists(filePath) || scannedFiles.has(filePath)) return;
    scannedFiles.add(filePath);

    const text = readText(filePath);
    for (const match of text.matchAll(assetRefPattern)) {
        addAssetRef(match[1]);
    }
}

function scanEntryFiles() {
    for (const filePath of fs.readdirSync(outDir, { withFileTypes: true })) {
        if (!filePath.isFile()) continue;
        if (!/\.(html|js|json|webmanifest)$/i.test(filePath.name)) continue;
        scanFile(path.join(outDir, filePath.name));
    }
}

function pruneEmptyDirs(dir) {
    if (!exists(dir)) return;

    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        if (ent.isDirectory()) {
            pruneEmptyDirs(path.join(dir, ent.name));
        }
    }

    if (dir === assetsDir) return;
    if (fs.readdirSync(dir).length === 0) {
        fs.rmdirSync(dir);
    }
}

if (!exists(assetsDir)) {
    console.log(`[assets-prune] skipped; assets dir not found: ${assetsDir}`);
    process.exit(0);
}

scanEntryFiles();

let deleted = 0;
let keptCurrent = 0;
let keptRecent = 0;

for (const filePath of walkFiles(assetsDir)) {
    const rel = path.relative(assetsDir, filePath).replaceAll('\\', '/');
    const stat = fs.statSync(filePath);

    if (keepAssets.has(rel)) {
        keptCurrent += 1;
        continue;
    }

    if (stat.mtimeMs >= cutoff) {
        keptRecent += 1;
        continue;
    }

    fs.rmSync(filePath, { force: true });
    deleted += 1;
}

pruneEmptyDirs(assetsDir);

console.log(`[assets-prune] ${assetsDir}`);
console.log(`[assets-prune] retention=${retentionDays}d current=${keptCurrent} recent=${keptRecent} deleted=${deleted}`);
