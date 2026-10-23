import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('./clean-movie-www.mjs', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '');

// Virtual filesystem only: these tests never clean the real deployment directory.
function simulate(target, linked = false) {
    const removed = [];
    const names = ['.git', '.well-known', 'googlefdb534d9533860b7.html', 'assets', 'index.html', 'sw.js', 'workbox-old.js', 'brands'];
    const fs = {
        existsSync: () => true,
        lstatSync: () => ({ isSymbolicLink: () => linked }),
        readdirSync: () => names.map((name) => ({ name })),
        rmSync: (file, options) => { removed.push({ file, options }); },
    };
    vm.runInNewContext(source, { fs, path: path.win32, process: { argv: ['node', 'clean', target] }, console: { log() {} } });
    return removed;
}

test('manual cleanup preserves historical assets and workbox runtimes', () => {
    for (const target of ['D:/JJ-TV/movie-www', 'D:/JJ-TV/movie-www-prod']) {
        const removed = simulate(target);
        assert.deepEqual(removed.map(({ file }) => path.win32.basename(file)), ['index.html', 'sw.js', 'brands']);
        for (const { file, options } of removed) {
            assert.equal(path.win32.dirname(file), path.win32.resolve(target));
            assert.equal(options.recursive, true);
        }
    }
});

test('refuses broad, unrelated and linked destinations', () => {
    for (const target of ['D:/', 'D:/JJ-TV', 'D:/JJ-Y/slot-TV', 'D:/JJ-TV/movie-www-prod/..']) {
        assert.throws(() => simulate(target), /Refusing to clean unknown output directory/);
    }
    assert.throws(() => simulate('D:/JJ-TV/movie-www-prod', true), /linked output directory/);
});

test('all build commands use the staged release pipeline', () => {
    const { scripts } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    for (const name of ['build', 'build:dev', 'build:prod']) {
        const command = scripts[name];
        assert.match(command, /scripts\/release-build\.mjs/, name);
        assert.ok(!command.includes('clean-movie-www.mjs'), name);
    }
    assert.match(scripts.build, /release-build\.mjs production$/);
    assert.match(scripts['build:prod'], /release-build\.mjs prod$/);
});
