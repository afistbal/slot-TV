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

test('hidden comment rows do not change backend daily aggregates', () => {
    const daily = decode([{ key: 'checkin', cap: 10, earned: 10, done: true }, { key: 'comment', cap: 5, earned: 5, done: true }], 15);
    assert.equal(daily.tasks.length, 1);
    assert.equal(daily.earned, 15);
    assert.equal(daily.total, 50);
});

test('numeric-string task amounts are supported and newer summary totals are retained', () => {
    assert.equal(decode([{ key: 'checkin', cap: '10', earned: '10', done: true }], '0').earned, 10);
    assert.equal(decode([{ key: 'checkin', cap: 10, earned: 10, done: true }], 15).earned, 15);
});

test('reported daily total 48 stays 48 even when a hidden comment cap is 3', () => {
    const result = exports.decodeLuckyTasks({
        tasks: [
            { key: 'checkin', cap: 15, earned: 10, done: true },
            { key: 'streak', cap: 3, earned: 0, done: false, min_sec: 60 },
            { key: 'share', cap: 30, earned: 0, done: false },
            { key: 'rating', cap: 15, earned: 0, done: false, left: 5 },
            { key: 'watch', cap: 15, earned: 0, done: false, need: 3600, sec: 0 },
            { key: 'comment', cap: 3, earned: 0, done: false },
        ],
        total: 48, earned: 10,
        once: [{ key: 'push_on', coins: 30, done: false, ready: true }], once_total: 0,
    });
    assert.equal(result.daily.total, 48);
    assert.equal(result.daily.earned, 10);
    assert.equal(result.daily.total - result.daily.earned, 38);
    assert.equal(result.daily.earned / result.daily.total * 100, 10 / 48 * 100);
    assert.deepEqual(Array.from(result.daily.tasks, task => task.coins), [15, 3, 30, 15, 15]);
    assert.equal(result.newcomer.total, 30);
    assert.equal(result.newcomer.tasks[0].coins, 30);
    assert.equal(result.newcomer.tasks[0].action, 'push');
});

test('newcomer total counts visible task coins independently of the once aggregate', () => {
    for (const aggregate of [0, 30, 90, '0', '90']) {
        const result = exports.decodeLuckyTasks({
            tasks: [], total: 0, earned: 0, once_total: aggregate,
            once: [
                { key: 'push_on', coins: '30', done: false },
                { key: 'bind_x', coins: 20, done: false },
                { key: 'follow_x', coins: 20, done: false },
                { key: 'join_tg', coins: 20, done: false },
                { key: 'comment', coins: 5, done: false },
            ],
        });
        assert.equal(result.newcomer.tasks.length, 1);
        assert.equal(result.newcomer.total, 30);
    }
});

test('claimed newcomer rewards remain part of the one-time total', () => {
    const result = exports.decodeLuckyTasks({
        tasks: [], total: 0, earned: 0, onceTotal: 0,
        once: [{ key: 'push_on', coins: 30, done: true, ready: false }],
    });
    assert.equal(result.newcomer.total, 30);
    assert.equal(result.newcomer.tasks[0].done, true);
});

test('push always uses subscribe even when the server reports it ready', () => {
    for (const ready of [false, true]) {
        const result = exports.decodeLuckyTasks({
            tasks: [], total: 0, earned: 0, once_total: 30,
            once: [{ key: 'push_on', coins: 30, done: false, ready }],
        });
        assert.equal(result.newcomer.tasks[0].action, 'push');
        assert.equal(result.newcomer.tasks[0].done, false);
    }
});
