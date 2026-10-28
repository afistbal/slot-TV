import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/luckyPushSubscription.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function setup({ saveFails = false, subscribed = true, permission = 'granted', permissionPending = false, subscribePending = false, fastTimeouts = false } = {}) {
    const calls = { config: 0, save: 0, subscribe: 0, unsubscribe: 0, permission: 0 };
    let current;
    const subscription = { endpoint: 'https://push.example.test/device', unsubscribe: async () => { calls.unsubscribe++; current = null; return true; } };
    current = subscribed ? subscription : null;
    const worker = { active: {}, pushManager: {
        getSubscription: async () => current,
        subscribe: async () => { calls.subscribe++; if (subscribePending) return new Promise(() => {}); current = subscription; return subscription; },
    } };
    const api = {
        getLuckyPushConfig: async () => { calls.config++; return { publicKey: 'BA' }; },
        saveLuckyPushSubscription: async () => { calls.save++; if (saveFails) throw new Error('save failed'); },
    };
    const exports = {};
    const context = {
        exports, require: () => api, Uint8Array, atob,
        window: { isSecureContext: true, Notification: {}, PushManager: {}, setTimeout: fastTimeouts ? callback => setTimeout(callback, 0) : setTimeout, clearTimeout },
        Notification: { permission, requestPermission: async () => { calls.permission++; return permissionPending ? new Promise(() => {}) : 'granted'; } },
        navigator: { serviceWorker: { getRegistration: async () => worker, ready: Promise.resolve(worker) } },
    };
    vm.runInNewContext(compiled, context);
    return { actions: exports, calls, hasSubscription: () => Boolean(current) };
}

test('failed save rolls back a new browser subscription', async () => {
    const state = setup({ saveFails: true, subscribed: false });
    await assert.rejects(state.actions.enableLuckyPushSubscription(), /save failed/);
    assert.equal(state.hasSubscription(), false);
});

test('expired subscription repairs automatically when browser permission is granted', async () => {
    const state = setup({ subscribed: false });
    assert.equal(await state.actions.syncLuckyPushSubscription(), true);
    assert.equal(state.hasSubscription(), true);
    assert.equal(state.calls.save, 1);
    assert.equal(state.calls.subscribe, 1);
    assert.equal(state.calls.permission, 0);
});

test('an unanswered permission request times out without saving a subscription', async () => {
    const state = setup({ permission: 'default', permissionPending: true, fastTimeouts: true });
    const stages = [];
    await assert.rejects(state.actions.enableLuckyPushSubscription(undefined, stage => stages.push(stage)), /等待通知授权超时/);
    assert.deepEqual(stages, ['permission']);
    assert.equal(state.calls.save, 0);
});

test('a stalled browser push connection times out and never reports a successful save', async () => {
    const state = setup({ subscribed: false, subscribePending: true, fastTimeouts: true });
    const stages = [];
    await assert.rejects(state.actions.enableLuckyPushSubscription(undefined, stage => stages.push(stage)), /连接浏览器通知服务超时/);
    assert.deepEqual(stages, ['connection']);
    assert.equal(state.calls.permission, 0);
    assert.equal(state.calls.save, 0);
});

test('already allowed notifications skip permission and report connection then saving', async () => {
    const state = setup();
    const stages = [];
    await state.actions.enableLuckyPushSubscription(undefined, stage => stages.push(stage));
    assert.deepEqual(stages, ['connection', 'saving']);
    assert.equal(state.calls.permission, 0);
    assert.equal(state.calls.save, 1);
});

test('subscribe adapter sends the nested browser keys required by the live backend', async () => {
    const requests = [];
    const apiSource = readFileSync(new URL('../src/api/lucky.ts', import.meta.url), 'utf8');
    const apiCompiled = ts.transpileModule(apiSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const exports = {};
    const dependencies = {
        '@/lib/movieCoverUrl': {},
        '@/api': { api: async (path, options) => { requests.push({ path, data: options.data }); return { c: 0, d: null }; } },
        '@/lib/luckyPageData': { camelLuckyPayload: value => value },
        '@/stores/lucky': { useLuckyStore: { getState: () => ({ invalidate() {} }) } },
    };
    vm.runInNewContext(apiCompiled, { exports, require: name => dependencies[name], navigator: { userAgent: 'Push verification' } });
    await exports.saveLuckyPushSubscription({ toJSON: () => ({ endpoint: 'https://push.example.test/device', keys: { p256dh: 'browser-public-key', auth: 'browser-auth' } }) });
    assert.deepEqual(JSON.parse(JSON.stringify(requests)), [{ path: 'user/push/subscribe', data: {
        endpoint: 'https://push.example.test/device', keys: { p256dh: 'browser-public-key', auth: 'browser-auth' }, userAgent: 'Push verification',
    } }]);
});

test('subscription refresh message reaches the application listener', () => {
    const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
    const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
    const name = main.match(/const PUSH_SUBSCRIPTION_CHANGED_MESSAGE = '([^']+)'/)[1];
    assert.ok(app.includes(`window.addEventListener('${name}', syncPush)`));
    assert.ok(app.includes(`window.removeEventListener('${name}', syncPush)`));
});
