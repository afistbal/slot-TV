import fs from 'fs';
import path from 'path';

const cliOutDir = process.argv[2];
const outDir = path.resolve(cliOutDir || 'D:/JJ-TV/movie-www');
const assetsDir = path.join(outDir, 'assets');
const daysArg = process.argv.find((arg) => arg.startsWith('--days='));
const retentionDays = Number(daysArg?.split('=')[1] ?? process.env.ASSET_RETENTION_DAYS ?? 7);
if (!Number.isFinite(retentionDays) || retentionDays < 1) {
    throw new Error(`[assets-prune] Invalid retention period: ${String(daysArg?.split('=')[1] ?? process.env.ASSET_RETENTION_DAYS)}`);
}
const retentionMs = Math.max(1, retentionDays) * 24 * 60 * 60 * 1000;
const now = new Date();
const cutoff = now.getTime() - retentionMs;
const assetRefPattern = /(?:\/|["'(`])(?:\.\/)?assets\/([^"'()`\s?#]+\.[a-zA-Z0-9]+)(?:[?#][^"'()`\s]*)?/g;
const relativeAssetRefPattern = /["'(`]\s*(\.\.?\/[^"'()`\s?#]+\.[a-zA-Z0-9]+)(?:[?#][^"'()`\s]*)?/g;
const keepAssets = new Set();
const keepWorkbox = new Set();
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
    const assetPath = path.resolve(assetsDir, ...normalized.split('/'));
    const relativePath = path.relative(assetsDir, assetPath).replaceAll('\\', '/');
    if (!normalized || relativePath.startsWith('../') || path.isAbsolute(relativePath) || !exists(assetPath)) return;
    if (keepAssets.has(relativePath)) return;
    keepAssets.add(relativePath);

    if (/\.(js|css)$/i.test(relativePath)) {
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

    const sourceRelative = path.relative(assetsDir, filePath);
    const sourceIsAsset = sourceRelative !== '' && !sourceRelative.startsWith('..') && !path.isAbsolute(sourceRelative);
    if (!sourceIsAsset) return;

    for (const match of text.matchAll(relativeAssetRefPattern)) {
        const referencedPath = path.resolve(path.dirname(filePath), match[1]);
        const referencedRelative = path.relative(assetsDir, referencedPath).replaceAll('\\', '/');
        addAssetRef(referencedRelative);
    }
}

function scanEntryFiles() {
    for (const filePath of fs.readdirSync(outDir, { withFileTypes: true })) {
        if (!filePath.isFile()) continue;
        if (!/\.(html|js|json|webmanifest)$/i.test(filePath.name)) continue;
        const entryPath = path.join(outDir, filePath.name);
        scanFile(entryPath);
        const text = readText(entryPath);
        for (const match of text.matchAll(/(?:\.\/|\/)?(workbox-[\w-]+)(?:\.js)?/gi)) {
            keepWorkbox.add(`${match[1]}.js`);
        }
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
let deletedWorkbox = 0;
let keptWorkboxCurrent = 0;
let keptWorkboxRecent = 0;

for (const filePath of walkFiles(assetsDir)) {
    const rel = path.relative(assetsDir, filePath).replaceAll('\\', '/');
    const stat = fs.statSync(filePath);

    if (keepAssets.has(rel)) {
        // A currently published file becomes historical only when index.html is
        // replaced. Refreshing its timestamp gives that version a full grace
        // period after supersession, even if it had already been live for weeks.
        fs.utimesSync(filePath, now, now);
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

for (const entry of fs.readdirSync(outDir, { withFileTypes: true })) {
    if (!entry.isFile() || !/^workbox-[\w-]+\.js$/i.test(entry.name)) continue;
    const filePath = path.join(outDir, entry.name);
    const stat = fs.statSync(filePath);
    if (keepWorkbox.has(entry.name)) {
        fs.utimesSync(filePath, now, now);
        keptWorkboxCurrent += 1;
    } else if (stat.mtimeMs >= cutoff) {
        keptWorkboxRecent += 1;
    } else {
        fs.rmSync(filePath, { force: true });
        deletedWorkbox += 1;
    }
}

console.log(`[assets-prune] ${assetsDir}`);
console.log(`[assets-prune] retention=${retentionDays}d current=${keptCurrent} recent=${keptRecent} deleted=${deleted}`);
console.log(`[workbox-prune] current=${keptWorkboxCurrent} recent=${keptWorkboxRecent} deleted=${deletedWorkbox}`);
