import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const compiled = ts.transpileModule(readFileSync(new URL('../src/api/lucky.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const subscription = { toJSON: () => ({ endpoint: 'https://push.example.test/device', keys: { p256dh: 'public', auth: 'auth' } }) };
function setup({ ready = true, done = false, noPush = false } = {}) {
    let token = 'session-a';
    let now = 100_000;
    let response = { tasks: [], once: noPush ? [] : [{ key: 'push_on', ready, done }], total: 0, earned: 0, onceTotal: 0 };
    const requests = [];
    const pending = [];
    let defer = false;
    const state = {
        tasks: undefined, tasksSession: '', tasksUpdatedAt: 0, revision: 0,
        clearTasks() { state.tasks = undefined; state.tasksSession = ''; state.tasksUpdatedAt = 0; },
        setTasks(data, session) { state.tasks = data; state.tasksSession = session; state.tasksUpdatedAt = now; },
        invalidate() { state.tasksUpdatedAt = 0; state.revision++; },
    };
    const dependencies = {
        '@/lib/movieCoverUrl': {},
        '@/api': { api: async path => {
            requests.push(path);
            if (path === 'user/tasks') {
                const snapshot = response;
                if (defer) return new Promise(resolve => pending.push(() => resolve({ c: 0, d: snapshot })));
                return { c: 0, d: snapshot };
            }
            return { c: 0, d: null };
        } },
        '@/lib/luckyPageData': { camelLuckyPayload: value => value, luckyClaimableBadge: () => 0 },
        '@/stores/lucky': { useLuckyStore: { getState: () => state } },
    };
    const exports = {};
    vm.runInNewContext(compiled, {
        exports, require: name => dependencies[name], Date: { now: () => now },
        localStorage: { getItem: () => token }, navigator: { userAgent: 'Regression test' },
    });
    return {
        api: exports, state, requests, pending,
        taskCount: () => requests.filter(path => path === 'user/tasks').length,
        setDeferred(value) { defer = value; }, setResponse(value) { response = value; },
        setToken(value) { token = value; }, advance(ms) { now += ms; },
    };
}

test('layout and welfare page share one in-flight request and fresh cache', async () => {
    const s = setup(); s.setDeferred(true);
    const first = s.api.getLuckyTasks();
    const second = s.api.getLuckyTasks();
    assert.equal(first, second); assert.equal(s.taskCount(), 1);
    s.pending.shift()(); await Promise.all([first, second]);
    await s.api.getLuckyTasks(); assert.equal(s.taskCount(), 1);
});

test('startup push sync keeps an already-ready task snapshot: one tasks request', async () => {
    const s = setup(); await s.api.getLuckyTasks();
    await s.api.saveLuckyPushSubscription(subscription);
    await s.api.getLuckyTasks();
    assert.equal(s.state.revision, 0); assert.equal(s.taskCount(), 1);
});

test('claimed push task and absent push task do not trigger redundant reloads', async () => {
    for (const options of [{ ready: false, done: true }, { noPush: true }]) {
        const s = setup(options); await s.api.getLuckyTasks();
        await s.api.saveLuckyPushSubscription(subscription); await s.api.getLuckyTasks();
        assert.equal(s.state.revision, 0); assert.equal(s.taskCount(), 1);
    }
});

test('newly enabled push refreshes an unready task', async () => {
    const s = setup({ ready: false }); await s.api.getLuckyTasks();
    await s.api.saveLuckyPushSubscription(subscription);
    assert.equal(s.state.revision, 1);
    s.setResponse({ tasks: [], once: [{ key: 'push_on', ready: true, done: false }] });
    await s.api.getLuckyTasks(); assert.equal(s.taskCount(), 2);
    assert.equal(s.state.tasks.once[0].ready, true);
});

test('claiming a reward still refreshes task state immediately', async () => {
    const s = setup(); await s.api.getLuckyTasks();
    await s.api.getLuckyCoins('shareOnce'); await s.api.getLuckyTasks();
    assert.equal(s.taskCount(), 2);
});

test('task snapshots expire after 30 seconds', async () => {
    const s = setup(); await s.api.getLuckyTasks(); s.advance(30_000);
    await s.api.getLuckyTasks(); assert.equal(s.taskCount(), 2);
});

test('switching accounts never reuses or publishes the previous account request', async () => {
    const s = setup(); s.setDeferred(true);
    const a = s.api.getLuckyTasks(); s.setToken('session-b');
    const b = s.api.getLuckyTasks(); assert.equal(s.taskCount(), 2);
    s.pending.shift()(); await a; assert.equal(s.state.tasks, undefined);
    s.pending.shift()(); await b; assert.equal(s.state.tasksSession, 'session-b');
});

test('sign-in refresh does not reuse a task request started before the claim', async () => {
    const s = setup(); s.setDeferred(true);
    const beforeClaim = s.api.getLuckyTasks();
    await s.api.claimLuckySignin();
    s.setResponse({ tasks: [{ key: 'checkin', cap: 5, earned: 5, done: true }], once: [], total: 50, earned: 5, onceTotal: 0 });
    const afterClaim = s.api.getLuckyTasks(true);
    assert.equal(s.taskCount(), 2, 'sign-in must start a fresh task request');
    const resolveOld = s.pending.shift();
    s.pending.shift()();
    await afterClaim;
    assert.equal(s.state.tasks.earned, 5);
    resolveOld(); await beforeClaim;
    assert.equal(s.state.tasks.earned, 5, 'a late pre-sign-in response must not restore zero progress');
    await s.api.getLuckyTasks();
    assert.equal(s.taskCount(), 2);
});
