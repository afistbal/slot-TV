import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IntlProvider } from 'react-intl';

const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
function load(path, dependencies = {}, globals = {}) {
    const exports = {};
    vm.runInNewContext(ts.transpileModule(read('src/' + path), { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText, { exports, setTimeout, ...globals, require: name => {
        if (name.endsWith('.scss')) return {};
        assert.ok(name in dependencies, 'Missing dependency: ' + name);
        return dependencies[name];
    } });
    return exports;
}
const wheel = load('lib/luckyWheel.ts');
const data = load('lib/luckyPageData.ts', { '@/lib/luckyWheel': wheel });
const face = [{ kind: 'coins', v: 5 }, { kind: 'vip_day', v: 1 }, { kind: 'coins', mult: 2 }, { kind: 'bonus_pct', v: 5 }, { kind: 'coins', v: 15 }, { kind: 'luck', v: 1 }, { kind: 'coins', v: 10 }, { kind: 'drama_ep', v: 1 }];
const promo = { enabled: true, eligible: true, peak: true, free_left: 3, free_max: 3, paid_max: 10, paid_used: 0, ten_max: 5, ten_used: 0,
    ten_price_mult: 9.5, tickets: 2, coins: 1000, bets: [20, 50, 100], face_free: face, face_ticket: face, face_paid: { 20: face, 50: face, 100: face } };
const tasks = { tasks: [{ key: 'checkin', cap: 5, done: false, earned: 0 }], once: [], total: 66, earned: 0, once_total: 0, promo,
    rewards: { checkin: { rewards: [5, 20], milestones: { 3: 25 } }, referral: { signup_inviter: 8, purchase_pct: 12, daily_share: 6 }, rating: { reward: 2, daily_cap: 4 }, tickets: { daily_cap: 3 }, levels: { 20: 900 } } };

function setup() {
    let token = 'account-a', response = tasks;
    const requests = [];
    const store = { revision: 0, tasks: undefined, tasksSession: '', tasksUpdatedAt: 0,
        setTasks(value, key) { this.tasks = value; this.tasksSession = key; this.tasksUpdatedAt = Date.now(); },
        clearTasks() { this.tasks = undefined; this.tasksSession = ''; }, invalidate() { this.revision++; this.tasksUpdatedAt = 0; } };
    let spinResponse = { c: 0, d: { draws: [{ slot_idx: 2, prize_kind: 'coins', prize_value: 40 }] } };
    let afterSpin = () => {};
    const service = load('api/lucky.ts', {
        '@/lib/movieCoverUrl': {}, '@/lib/luckyPageData': data, '@/lib/luckyWheel': wheel,
        '@/stores/lucky': { useLuckyStore: { getState: () => store } },
        '@/api': { formatApiFailure: (_m, path) => 'POST ' + path + ': failed', api: async (path, options) => {
            requests.push({ path, data: options.data });
            if (path === 'user/tasks') return { c: 0, d: response };
            if (path === 'user/rewards') return { c: 0, d: response.rewards ?? null };
            if (path === 'user/promo/status') return { c: 0, d: response.promo ?? null };
            if (path === 'user/spin') { afterSpin(); return spinResponse; }
            throw new Error('Unexpected endpoint: ' + path);
        } },
    }, { localStorage: { getItem: () => token } });
    return { service, requests, store, setTasks: value => { response = value; }, setSpin: value => { spinResponse = value; }, switchDuringSpin: () => { afterSpin = () => { token = 'account-b'; }; } };
}

test('welfare page calls rewards while the hidden wheel still skips promo requests', async () => {
    const s = setup();
    const result = await s.service.getLuckyPage(() => { throw new Error('No fake demo'); });
    assert.equal(result.demo, false);
    assert.deepEqual(s.requests.map(row => row.path), ['user/tasks', 'user/rewards']);
    assert.equal(result.data.wheel.freeLeft, 0);
    assert.equal(result.data.wheel.enabled, false);
    assert.deepEqual(Array.from(result.data.rewards, row => row.key), ['checkin', 'streak', 'invite', 'share', 'rating']);
    assert.match(result.data.rewards.find(row => row.key === 'invite').description, /8.*12%/);
    assert.match(result.data.rewards.find(row => row.key === 'checkin').description, /5–20.*3.*25/);
    const cached = s.service.getCachedLuckyPage();
    assert.equal(cached.data.wheel.freeLeft, 0);
    assert.equal(s.requests.length, 2);
});

test('missing configuration keeps five requested cards with zero values and disables the wheel', () => {
    const result = data.decodeLuckyTaskContent({});
    assert.deepEqual(Array.from(result.rewards, row => row.key), ['checkin', 'streak', 'invite', 'share', 'rating']);
    assert.equal(wheel.luckyWheelAction(result.wheel, 20), 'done');
    assert.match(result.rewards.find(row => row.key === 'invite').description, /0.*0%/);
});

test('per-user task values never populate welfare cards without rewards data', () => {
    const result = data.decodeLuckyTaskContent({
        tasks: [{ key: 'rating', cap: '3', count: '8' }],
    });
    const rating = result.rewards.find(row => row.key === 'rating');
    assert.match(rating.description, /每部 \+0 币，每天最多 0 部/);
});

test('rating welfare card prefers the rewards catalog over per-user task state', () => {
    const result = data.decodeLuckyTaskContent({
        tasks: [{ key: 'rating', cap: 15, count: 5 }],
        rewards: { rating: { reward: 6, daily_cap: 9 } },
    });
    const rating = result.rewards.find(row => row.key === 'rating');
    assert.match(rating.description, /每部 \+6 币，每天最多 9 部/);
});

test('flat key-based rewards response renders the five welfare cards', () => {
    const result = data.decodeLuckyTaskContent({ rewards: [
        { key: 'checkin', rewards: [5, 15, 30, 15, 20, 25, 60], milestones: { 30: 500 } },
        { key: 'streak', cap: 3, milestones: { 30: 300 } },
        { key: 'invite', cap: 80, purchase_pct: 15 },
        { key: 'share', cap: 10 },
        { key: 'rating', cap: 3, count: 5 },
    ] });
    assert.deepEqual(Array.from(result.rewards, row => row.key), ['checkin', 'streak', 'invite', 'share', 'rating']);
    assert.match(result.rewards.find(row => row.key === 'checkin').description, /5–60.*30.*500/);
    assert.match(result.rewards.find(row => row.key === 'streak').description, /\+3.*30.*300/);
    assert.match(result.rewards.find(row => row.key === 'invite').description, /80.*15%/);
    assert.match(result.rewards.find(row => row.key === 'share').description, /\+10/);
    assert.match(result.rewards.find(row => row.key === 'rating').description, /\+3.*5/);
});

test('hidden wheel ignores promo configuration and keeps daily tasks', async () => {
    const s = setup();
    s.setTasks({ ...tasks, promo: { enabled: true } });
    const result = await s.service.getLuckyPage(() => { throw new Error('No fake values'); });
    assert.equal(result.demo, false);
    assert.equal(result.data.daily.total, 66);
    assert.equal(result.data.wheel.eligible, false);
    assert.equal(result.data.wheel.freeLeft, 0);
    assert.equal(result.error, undefined);
    assert.ok(!s.requests.some(row => row.path === 'user/promo/status'));
});

test('expired period disables the actual draw buttons while coupons and records remain visible', () => {
    const state = data.decodeLuckyTaskContent({ ...tasks, promo: { ...promo, peak_ends_at: '2020-01-01T00:00:00Z',
        coupons: [{ id: 'c1', pct: 10, cap: 90, expires_at: '2020-01-01T00:00:00Z' }],
        prizes: [{ id: 'r1', prize_kind: 'coins', prize_value: 10, created_at: '2020-01-01T00:00:00Z' }], luck_level: 2 } }).wheel;
    const html = renderWheel(state);
    assert.match(html, /当前阶段已结束/);
    assert.match(html, /class="lucky-wheel-hub" disabled/);
    assert.match(html, /我的充值加成券/);
    assert.match(html, /本期战绩/);
    assert.match(html, /Lv2/);
});

test('mode priority matches free/watch/gift/paid/topup and off-peak tickets', () => {
    const state = data.decodeLuckyTaskContent(tasks).wheel;
    assert.equal(wheel.luckyWheelAction(state, 20), 'free');
    assert.equal(wheel.luckyWheelAction({ ...state, freeNeedsWatch: true }, 20), 'watch');
    assert.equal(wheel.luckyWheelAction({ ...state, freeLeft: 0, giftSpins: 1 }, 20), 'gift');
    assert.equal(wheel.luckyWheelAction({ ...state, freeLeft: 0 }, 20), 'paid');
    assert.equal(wheel.luckyWheelAction({ ...state, freeLeft: 0, coins: 0 }, 20), 'topup');
    assert.equal(wheel.luckyWheelAction({ ...state, peak: false }, 20), 'ticket');
    assert.equal(wheel.luckyWheelAction({ ...state, peak: false, tickets: 0 }, 20), 'done');
});

for (const [mode, bet, n] of [['free', 0, 1], ['gift', 50, 1], ['paid', 20, 1], ['ticket', 0, 1], ['ten', 20, 10]]) {
    test('draw preserves promo_spin p_mode/p_bet and returns only server results: ' + mode, async () => {
        const s = setup();
        s.setSpin({ c: 0, d: { draws: Array.from({ length: n }, () => ({ slot_idx: 1, prize_kind: 'coins', prize_value: 7 })) } });
        const result = await s.service.spinLuckyWheel(mode, bet);
        assert.equal(JSON.stringify(s.requests[0]), JSON.stringify({ path: 'user/spin', data: { p_mode: mode, p_bet: bet } }));
        assert.equal(result.length, n); assert.equal(result[0].slotIdx, 1); assert.equal(result[0].prizeValue, 7);
        assert.equal(s.store.revision, 1, 'draw refreshes task state and shared coin balance');
    });
}

test('invalid responses and failed requests refresh quotas but never fabricate a winning prize', async () => {
    const s = setup();
    s.setSpin({ c: 0, d: { draws: [] } });
    await assert.rejects(s.service.spinLuckyWheel('paid', 20), /结果格式无效/);
    s.setSpin({ c: 1, m: 'failure' });
    await assert.rejects(s.service.spinLuckyWheel('paid', 20), /failed/);
    assert.equal(s.store.revision, 2);
    await assert.rejects(s.service.spinLuckyWheel('free', 20), /参数无效/);
    assert.equal(s.requests.length, 2, 'invalid arguments cannot create a draw request');
});

test('a draw completed after an account switch does not overwrite the new account', async () => {
    const s = setup(); s.switchDuringSpin();
    await assert.rejects(s.service.spinLuckyWheel('paid', 20), /账号已切换/);
    assert.equal(s.store.revision, 0);
});

const extras = load('components/LuckyWheelExtras.tsx', {'react/jsx-runtime': require('react/jsx-runtime'), 'react-intl': require('react-intl'), 'lucide-react': require('lucide-react'), '@/lib/luckyWheel': wheel, '@/stores/topUp': {}});
function wheelComponent() {
    return load('components/LuckyWheel.tsx', {
        react: React, 'react/jsx-runtime': require('react/jsx-runtime'), 'react-intl': require('react-intl'), 'react-router': { useNavigate: () => () => {} },
        'lucide-react': require('lucide-react'), sonner: { toast: {} }, '@/components/LuckyWheelExtras': extras, '@/api/lucky': {}, '@/lib/luckyWheel': wheel, '@/stores/topUp': {},
        '@/stores/user': { useUserStore: selector => selector({ info: { id: 7 } }) },
    }, { localStorage: { getItem: () => 'test' } }).LuckyWheel;
}
function renderWheel(state, disabled = false) {
    const Component = wheelComponent();
    return renderToStaticMarkup(React.createElement(IntlProvider, { locale: 'zh-CN', messages: {} }, React.createElement(Component, { state, disabled })));
}

test('wheel and chance guide render with both configured and zero states', () => {
    for (const state of [data.decodeLuckyTaskContent(tasks).wheel, wheel.decodeLuckyWheel(null)]) {
        const html = renderWheel(state);
        for (const text of ['幸运转盘', '怎么获得抽奖机会', '单抽', '十连', '充值加送', '本期奖池', '我的奖品与记录']) assert.ok(html.includes(text), text);
        assert.ok(!html.includes('升级奖励'));
    }
});

test('double clicking the actual wheel button only submits one draw', async () => {
    const calls = [], states = [];
    let stateIndex = 0, finish;
    const Component = load('components/LuckyWheel.tsx', {
        react: { useId: () => 'wheel-interface', useState(initial) { const i = stateIndex++; states[i] = initial; return [initial, value => { states[i] = value; }]; },
            useRef: current => ({ current }), useEffect: effect => effect() },
        'react/jsx-runtime': require('react/jsx-runtime'), 'react-intl': { useIntl: () => ({ locale: 'zh-CN' }) },
        'react-router': { useNavigate: () => () => {} }, 'lucide-react': require('lucide-react'),
        '@/components/LuckyWheelExtras': extras, '@/api/lucky': { spinLuckyWheel: (mode, bet) => { calls.push({ mode, bet }); return new Promise(resolve => { finish = resolve; }); } },
        '@/lib/luckyWheel': wheel, sonner: { toast: {} }, '@/stores/topUp': {}, '@/stores/user': { useUserStore: selector => selector({ info: { id: 7 } }) },
    }, { localStorage: { getItem: () => 'account-a' }, window: { matchMedia: () => ({ matches: true }), setTimeout } }).LuckyWheel;
    function find(node) {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) return node.map(find).find(Boolean);
        return node.props?.className === 'lucky-wheel-hub' ? node : find(node.props?.children);
    }
    const button = find(Component({ state: data.decodeLuckyTaskContent(tasks).wheel }));
    button.props.onClick(); button.props.onClick();
    assert.equal(calls.length, 1); assert.equal(calls[0].mode, 'free'); assert.equal(calls[0].bet, 0);
    finish([{ slotIdx: 2, prizeKind: 'coins', prizeValue: 40 }]);
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(states[1], false, 'button unlocks only after the result animation finishes');
    assert.ok(states.some(value => Array.isArray(value) && value[0]?.prizeValue === 40));
});

test('formal visibility predicate and reference colors remain available during temporary preview', () => {
    assert.equal(wheel.isLuckyWheelVisible({enabled:true,eligible:true}), true);
    for(const flags of [{enabled:false,eligible:false},{enabled:true,eligible:false},{enabled:false,eligible:true}]) assert.equal(wheel.isLuckyWheelVisible(flags), false);
    assert.equal(wheel.luckyWheelSegmentColor(0,8), '#1b1e22');
    assert.equal(wheel.luckyWheelSegmentColor(1,8), '#e8c268');
    assert.equal(wheel.luckyWheelSegmentColor(6,7), '#b98c2a');
    const html=renderWheel(data.decodeLuckyTaskContent(tasks).wheel);
    assert.ok(!html.includes('复制接口说明'));
    assert.ok(!html.includes('/api/'));
    assert.ok(!html.includes('心愿'));
});

if (process.env.WHEEL_PREVIEW_DIR) {
    const dir = process.env.WHEEL_PREVIEW_DIR; mkdirSync(dir, { recursive: true });
    const sass = require('sass');
    const css = ['lucky.scss', 'lucky-wheel.scss'].map(file => sass.compile('src/styles/' + file).css).join('\n');
    const snapshot = { ...data.decodeLuckyTasks(tasks), ...data.decodeLuckyTaskContent(tasks) };
    const Page = load('pages/user/Lucky.tsx', {
        react: React, 'react/jsx-runtime': require('react/jsx-runtime'), 'react-intl': require('react-intl'),
        'react-router': { useNavigate: () => () => {}, useSearchParams: () => [new URLSearchParams()] }, sonner: { toast: {} },
        '@/api/lucky': { getCachedLuckyPage: () => ({ data: snapshot, demo: false }) },
        '@/components/LuckyWheel': { LuckyWheel: wheelComponent() }, '@/components/LuckyRatingSheet': { LuckyRatingSheet: () => null },
        '@/components/LuckyIcon': { LuckyIcon: () => null }, '@/components/ReelShortTopNav': { ReelShortTopNav: () => null },
        '@/components/ReelShortFooter': { ReelShortFooter: () => null }, '@/data/luckyDemo': {}, '@/lib/luckyPushSubscription': {},
        '@/stores/root': { useRootStore: selector => selector({ sessionBootstrapReady: true }) },
        '@/stores/lucky': { useLuckyStore: selector => selector({ revision: 0, progressError: '' }) },
    }, { localStorage: { getItem: () => 'preview' } }).default;
    const content = renderToStaticMarkup(React.createElement(IntlProvider, { locale: 'zh-CN', messages: JSON.parse(read('src/locales/zh-CN.json')) }, React.createElement(Page)));
    const html = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{height:100%;margin:0;background:#0c0d0f}' + css + '</style>' + content;
    writeFileSync(dir + '/pc.html', html); writeFileSync(dir + '/phone.html', html);
    writeFileSync(dir + '/h5.html', '<!doctype html><style>html,body{height:100%;margin:0;background:#0c0d0f}iframe{display:block;width:390px;max-width:100%;height:100%;margin:auto;border:0}</style><iframe src="/phone"></iframe>');
}
