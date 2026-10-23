import fs from 'fs';
import path from 'path';

const cliOutDir = process.argv[2];
const outDir = path.resolve(cliOutDir || 'D:/JJ-TV/movie-www');
const keepNames = new Set(['.git', '.well-known', 'googlefdb534d9533860b7.html', 'assets']);

function shouldKeep(name) {
    return keepNames.has(name) || /^workbox-[\w-]+\.js$/i.test(name);
}

// Only known build destinations may be cleaned. Never allow a workspace/drive root.
if (!/^D:\/JJ-TV\/movie-www(?:-prod\d*)?$/i.test(outDir.replaceAll('\\', '/'))) {
    throw new Error(`[build-clean] Refusing to clean unknown output directory: ${outDir}`);
}
if (fs.existsSync(outDir) && fs.lstatSync(outDir).isSymbolicLink()) {
    throw new Error(`[build-clean] Refusing to clean a linked output directory: ${outDir}`);
}

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
        if (shouldKeep(ent.name)) continue;
        const target = path.resolve(dir, ent.name);
        if (path.dirname(target) !== outDir) {
            throw new Error(`[build-clean] Target is outside the output directory: ${target}`);
        }
        rmRecursive(target);
    }
}

cleanDirExcept(outDir);
console.log(`[build-clean] cleaned ${outDir} (kept: ${[...keepNames].join(', ')}, workbox-*.js)`);
