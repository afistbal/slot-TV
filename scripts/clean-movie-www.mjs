import fs from 'fs';
import path from 'path';

const outDir = path.resolve('D:/JJ-TV/movie-www');
const keepNames = new Set(['.git', '.well-known']);

function exists(p) {
    try {
        return fs.existsSync(p);
    } catch {
        return false;
    }
}

function rmRecursive(p) {
    if (!exists(p)) return;
    fs.rmSync(p, { recursive: true, force: true });
}

function cleanDirExcept(dir) {
    if (!exists(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        return;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
        if (keepNames.has(ent.name)) continue;
        rmRecursive(path.join(dir, ent.name));
    }
}

cleanDirExcept(outDir);
console.log(`[build-clean] cleaned ${outDir} (kept: ${[...keepNames].join(', ')})`);
