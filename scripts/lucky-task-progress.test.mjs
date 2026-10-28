import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const compiled = ts.transpileModule(readFileSync(new URL('../src/lib/luckyPageData.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
vm.runInNewContext(compiled, { exports });
const decode = (tasks, earned = 0) => exports.decodeLuckyTasks({ tasks, earned, total: 50, once: [], once_total: 0 }).daily;

test('claimed check-in contributes to progress even when the summary is still zero', () => {
    const daily = decode([{ key: 'checkin', cap: 10, earned: 10, done: true }]);
    assert.equal(daily.earned, 10);
    assert.equal(daily.earned / daily.total * 100, 20);
    assert.equal(daily.total - daily.earned, 40);
});

test('multiple credited rewards are added once, without adding the summary twice', () => {
    const tasks = [{ key: 'checkin', cap: 10, earned: 10, done: true }, { key: 'share', cap: 30, earned: 5, done: false }];
    assert.equal(decode(tasks, 0).earned, 15);
    assert.equal(decode(tasks, 15).earned, 15);
});

test('ready-but-unclaimed tasks do not increase earned progress', () => {
    assert.equal(decode([{ key: 'watch', cap: 15, earned: 0, done: true, ready: true }]).earned, 0);
});

test('hidden comment rewards stay excluded', () => {
    const daily = decode([{ key: 'checkin', cap: 10, earned: 10, done: true }, { key: 'comment', cap: 5, earned: 5, done: true }], 15);
    assert.equal(daily.earned, 10);
    assert.equal(daily.total, 45);
});

test('numeric-string task amounts are supported and newer summary totals are retained', () => {
    assert.equal(decode([{ key: 'checkin', cap: '10', earned: '10', done: true }], '0').earned, 10);
    assert.equal(decode([{ key: 'checkin', cap: 10, earned: 10, done: true }], 15).earned, 15);
});
