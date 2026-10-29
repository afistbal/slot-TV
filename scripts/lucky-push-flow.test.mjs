import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const sources = Object.fromEntries(['lib/luckyWheel.ts', 'lib/luckyPageData.ts', 'api/lucky.ts', 'lib/luckyPushSubscription.ts', 'pages/user/Lucky.tsx'].map(path => [path,
    ts.transpileModule(readFileSync(new URL('../src/' + path, import.meta.url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText,
]));

async function setup({ ready = true, saveFails = false, configFailures = 0 } = {}) {
    const requests = [], effects = [], success = [], errors = [];
    let token = 'account-a';
    let configErrors = configFailures;
    let permissionRequests = 0;
    let subscription = null;
    const state = {
        tasks: undefined, tasksSession: '', tasksUpdatedAt: 0, revision: 0, progressError: '',
        setTasks(data, session) { this.tasks = data; this.tasksSession = session; this.tasksUpdatedAt = Date.now(); },
        clearTasks() { this.tasks = undefined; this.tasksSession = ''; },
        invalidate() { this.tasksUpdatedAt = 0; this.revision++; },
    };
    let tasks = { tasks: [], total: 48, earned: 10, once_total: 0, once: [{ key: 'push_on', coins: 30, ready, done: false }] };
    const useLuckyStore = selector => selector(state);
    useLuckyStore.getState = () => state;
    const worker = { active: {}, pushManager: {
        getSubscription: async () => subscription,
        subscribe: async () => {
            subscription = {
                toJSON: () => ({ endpoint: 'https://push.example.test/device', keys: { p256dh: 'public', auth: 'auth' } }),
                unsubscribe: async () => { subscription = null; return true; },
            };
            return subscription;
        },
    } };
    const navigator = { userAgent: 'Push flow test', serviceWorker: { getRegistration: async () => worker, ready: Promise.resolve(worker) } };
    const Notification = { permission: 'default', requestPermission: async () => { permissionRequests++; return 'granted'; } };
    const shared = {
        navigator, Notification, Uint8Array, atob, URL, URLSearchParams, setTimeout, clearTimeout,
        localStorage: { getItem: () => token },
        window: { Notification, PushManager: {}, setTimeout, clearTimeout },
    };
    const dependencies = {
        '@/lib/movieCoverUrl': {},
        '@/stores/lucky': { useLuckyStore },
        '@/lib/isIosLikeDevice': { isIosLikeDevice: () => false },
        '@/api': {
            formatApiFailure: (_method, path) => 'Request failed: ' + path,
            api: async (path, options) => {
                requests.push({ path, data: options.data });
                if (path === 'user/tasks') return { c: 0, d: tasks };
                if (path === 'user/rewards') return { c: 0, d: {} };
                if (path === 'user/push/config') {
                    if (configErrors-- > 0) return { c: 1, d: null };
                    return { c: 0, d: { public_key: 'BA' } };
                }
                if (path === 'user/push/subscribe') {
                    if (saveFails) return { c: 1, d: null };
                    tasks = { ...tasks, once_earned: 30, once: [{ key: 'push_on', coins: 30, ready: true, done: true }] };
                    return { c: 0, d: { awarded: 30 } };
                }
                throw new Error('Unexpected endpoint: ' + path);
            },
        },
    };
    function load(path) {
        const exports = {};
        vm.runInNewContext(sources[path], { ...shared, exports, require: name => {
            if (name.endsWith('.scss')) return {};
            assert.ok(name in dependencies, 'Missing test dependency: ' + name);
            return dependencies[name];
        } });
        return exports;
    }
    dependencies['@/lib/luckyWheel'] = load('lib/luckyWheel.ts');
    dependencies['@/lib/luckyPageData'] = load('lib/luckyPageData.ts');
    const api = dependencies['@/api/lucky'] = load('api/lucky.ts');
    dependencies['@/lib/luckyPushSubscription'] = load('lib/luckyPushSubscription.ts');
    await api.getLuckyTasks();
    const element = (type, props) => ({ type, props });
    Object.assign(dependencies, {
        react: { useCallback: fn => fn, useRef: current => ({ current }), useState: value => [value, () => {}], useEffect: effect => effects.push(effect) },
        'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'fragment' },
        'react-intl': { useIntl: () => ({ locale: 'zh-CN', messages: {}, formatMessage: ({ id }) => id }) },
        'react-router': { useNavigate: () => () => {}, useSearchParams: () => [new URLSearchParams()] },
        sonner: { toast: { success: value => success.push(value), error: value => errors.push(value), info: () => {} } },
        '@/stores/root': { useRootStore: selector => selector({ sessionBootstrapReady: true }) },
        '@/data/luckyDemo': {},
    });
    for (const name of ['LuckyWheel', 'LuckyRatingSheet', 'LuckyIcon', 'ReelShortFooter', 'ReelShortTopNav']) dependencies['@/components/' + name] = { [name]: () => null };
    const tree = load('pages/user/Lucky.tsx').default();
    function find(node, predicate) {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) return node.map(child => find(child, predicate)).find(Boolean);
        return predicate(node) ? node : find(node.props?.children, predicate);
    }
    const rows = find(tree, node => node.type?.name === 'TaskRows' && node.props.rows.some(task => task.key === 'push_on'));
    const rowTree = rows.type(rows.props);
    const button = find(rowTree, node => node.type === 'button');
    // Run the actual page config effect; other page effects depend on a browser
    // lifecycle and are outside this focused click/request contract test.
    const configEffect = effects.find(effect => effect.toString().includes('getLuckyPushConfig'));
    assert.ok(configEffect, 'page entry must preload the push config');
    configEffect();
    await new Promise(resolve => setImmediate(resolve));
    return { api, state, requests, button, success, errors,
        permissionRequests: () => permissionRequests, hasSubscription: () => Boolean(subscription),
        switchAccount: value => { token = value; },
    };
}

for (const ready of [false, true]) {
    test(`page preloads config, then one click subscribes and refreshes automatic reward (ready=${ready})`, async () => {
        const s = await setup({ ready });
        assert.equal(s.requests.filter(row => row.path === 'user/push/config').length, 1);
        assert.equal(s.requests.some(row => row.path === 'user/push/subscribe'), false);
        assert.equal(s.permissionRequests(), 0, 'entry must never ask for notification permission');
        assert.equal(s.button.props.children, 'lucky_push_enable');
        s.button.props.onClick();
        s.button.props.onClick(); // double clicks must not create two subscriptions
        await new Promise(resolve => setImmediate(resolve));
        assert.deepEqual(s.errors, []);
        assert.equal(s.success.length, 1);
        assert.equal(s.requests.filter(row => row.path === 'user/push/config').length, 1, 'click reuses preloaded config');
        assert.equal(s.requests.filter(row => row.path === 'user/push/subscribe').length, 1);
        assert.equal(s.requests.some(row => row.path === 'user/coin'), false);
        assert.equal(s.state.tasks.once[0].done, true, 'claimed state must come from refreshed server tasks');
    });
}

test('failed subscribe does not show success or mark reward claimed', async () => {
    const s = await setup({ saveFails: true });
    s.button.props.onClick();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(s.success.length, 0);
    assert.equal(s.errors.length, 1);
    assert.equal(s.state.tasks.once[0].done, false);
    assert.equal(s.hasSubscription(), false, 'failed save rolls back a new browser subscription');
    assert.equal(s.requests.some(row => row.path === 'user/coin'), false);
});

test('a failed config preload can be retried by the click path', async () => {
    const s = await setup({ configFailures: 1 });
    s.button.props.onClick();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(s.requests.filter(row => row.path === 'user/push/config').length, 2);
    assert.equal(s.success.length, 1);
    assert.equal(s.state.tasks.once[0].done, true);
});

test('config cache shares requests and is isolated between accounts', async () => {
    const s = await setup();
    await Promise.all([s.api.getLuckyPushConfig(), s.api.getLuckyPushConfig()]);
    assert.equal(s.requests.filter(row => row.path === 'user/push/config').length, 1);
    s.switchAccount('account-b');
    const first = s.api.getLuckyPushConfig();
    const second = s.api.getLuckyPushConfig();
    assert.equal(first, second);
    await Promise.all([first, second]);
    assert.equal(s.requests.filter(row => row.path === 'user/push/config').length, 2);
});
