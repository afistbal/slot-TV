import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IntlProvider } from 'react-intl';

const require = createRequire(import.meta.url);
const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
function load(file, dependencies = {}, globals = {}) {
    const exports = {};
    const compiled = ts.transpileModule(read('src/' + file), { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText;
    vm.runInNewContext(compiled, { exports, ...globals, require: name => {
        if (name.endsWith('.scss')) return {};
        assert.ok(name in dependencies, 'Missing dependency: ' + name);
        return dependencies[name];
    } });
    return exports;
}
const dataApi = load('lib/inviteData.ts');
const zero = dataApi.normalizeInviteInfo(null);
const configured = dataApi.normalizeInviteInfo({ invited_count: 8, settled_count: 2, earned_coins: 100, pending_coins: 20,
    config: { signup_inviter: 6, signup_invitee: 9, purchase_pct: 12.5, daily_invite_cap: 4,
        milestones: [{ n: 10, coins: 55 }, { n: 3, coins: 22 }] } });

function render(data = zero, { rulesOpen = false, locale = 'zh-CN', affiliate = false, failed = false, error = '' } = {}) {
    const Component = load('components/InviteCard.tsx', {
        react: { ...React, useState: () => [rulesOpen, () => {}] },
        'react/jsx-runtime': require('react/jsx-runtime'), 'react-intl': require('react-intl'),
        'lucide-react': require('lucide-react'), sonner: { toast: {} },
        '@/hooks/useInviteInfo': { useInviteInfo: () => ({ data, loading: false, failed, error }) },
        '@/hooks/useRequireAccount': { useRequireAccount: () => () => true },
        '@/stores/user': { useUserStore: selector => selector({ signed: true, isAnonymous: () => false, info: { uid: '7' } }) },
        '@/lib/formatUserUniqueIdForDisplay': { getUserUidForDisplay: info => info.uid },
        '@/lib/shareUrls': { buildAffiliateShareUrl: code => 'https://yogoshort.com/share/cf' + code + '?ref=' + code },
        '@/lib/inviteData': dataApi, '@/stores/sharePoster': {},
    }).InviteCard;
    return renderToStaticMarkup(React.createElement(IntlProvider, { locale, messages: JSON.parse(read('src/locales/' + locale + '.json')) },
        React.createElement(Component, { affiliate })));
}

test('missing config and stats default to zero, and cash statistics never become coins', () => {
    for (const input of [null, {}, { invitedCount: -8, earnedCoins: 'invalid', pendingCoins: Infinity, availableCents: 2000, config: { signupInviter: -1 } }]) {
        const result = dataApi.normalizeInviteInfo(input);
        assert.equal(result.invitedCount, 0);
        assert.equal(result.earnedCoins, 0);
        assert.equal(result.pendingCoins, 0);
        assert.equal(result.config.signupInviter, 0);
    }
    assert.equal(dataApi.nextInviteMilestone(zero).percent, 0);
    assert.equal(dataApi.nextInviteMilestone(zero).target, 0);
});

test('milestone progress uses settled invites and preserves configured reward amounts', () => {
    const next = dataApi.nextInviteMilestone(configured);
    assert.equal(next.target, 3);
    assert.equal(next.left, 1);
    assert.equal(next.coins, 22);
    assert.equal(next.percent, 67);
    assert.equal(configured.config.purchasePct, 12.5);
    assert.equal(dataApi.nextInviteMilestone({ ...configured, settledCount: 10 }).complete, true);
    assert.equal(dataApi.nextInviteMilestone({ ...configured, settledCount: 10 }).percent, 100);
});

test('both invitation locations retain copy, poster, rules, statistics and description when all values are zero', () => {
    for (const affiliate of [false, true]) {
        const html = render(zero, { affiliate, rulesOpen: true });
        for (const text of ['邀请好友一起看', '你得 0 金币', '0%', '有效邀请 0 / 0', '已邀请人数', '邀请规则', '复制链接', '分享海报']) assert.ok(html.includes(text), text);
        assert.ok(html.includes('aria-expanded="true"'));
        assert.ok(html.includes('https://yogoshort.com/share/cf7?ref=7'));
        assert.ok(!html.includes('80 金币'));
    }
    const html = render(configured, { rulesOpen: true });
    assert.ok(html.includes('额外 +22 金币'));
    assert.ok(html.includes('待结算 20 金币'));
    assert.ok(html.includes('width:67%'));
    assert.ok(render(zero, { locale: 'zh-TW' }).includes('邀請好友一起看'));
});

test('invitation read adapter uses the new contract, shares concurrent reads and separates account sessions', async () => {
    let token = 'account-a';
    const requests = [], pending = [];
    const affiliate = load('api/affiliate.ts', { '@/api': {
        api: (path, options) => { requests.push({ path, ...options }); return new Promise(resolve => pending.push(resolve)); },
        formatApiFailure: () => 'failed',
    } }, { localStorage: { getItem: () => token } });
    const service = load('api/invite.ts', { '@/lib/inviteData': dataApi, '@/api/affiliate': affiliate }, { localStorage: { getItem: () => token } });
    const a = service.getInviteInfo();
    assert.equal(a, service.getInviteInfo());
    const shared = affiliate.getAffiliateEligibility();
    assert.equal(requests.length, 1);
    token = 'account-b';
    const b = service.getInviteInfo();
    assert.equal(requests.length, 2);
    assert.equal(requests[0].path, 'user/affiliate');
    assert.equal(requests[0].method, 'post');
    assert.equal(requests[0].toastOnError, true);
    assert.deepEqual(Object.keys(requests[0].data), []);
    pending[0]({ c: 0, d: { invitedCount: 7 } });
    pending[1]({ c: 0, d: {} });
    await shared;
    assert.equal((await a).invitedCount, 7);
    assert.equal((await b).invitedCount, 0);
});

test('affiliate server errors enable the global message and release shared reads for retry', async () => {
    const requests = [];
    let fail = true;
    const affiliate = load('api/affiliate.ts', { '@/api': {
        api: async (path, options) => {
            requests.push({ path, ...options });
            return fail ? { c: 1, m: '邀请服务暂不可用', d: null, httpStatus: 500 } : { c: 0, d: { invitedCount: 2 } };
        },
        formatApiFailure: (_method, _path, result) => result.m,
    } }, { localStorage: { getItem: () => 'account' } });
    const service = load('api/invite.ts', { '@/lib/inviteData': dataApi, '@/api/affiliate': affiliate }, { localStorage: { getItem: () => 'account' } });
    const invitation = service.getInviteInfo();
    const eligibility = affiliate.getAffiliateEligibility();
    await Promise.all([
        assert.rejects(invitation, /邀请服务暂不可用/),
        assert.rejects(eligibility, /邀请服务暂不可用/),
    ]);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].toastOnError, true);
    fail = false;
    assert.equal((await service.getInviteInfo()).invitedCount, 2);
    assert.equal(requests.length, 2);
});

test('request failure adds no error, retry or diagnostic content to the page', () => {
    const html = render(zero, { failed: true, error: 'POST /api/user/affiliate: 404 Not Found {"c":1}' });
    assert.equal(html, render(zero));
    for (const text of ['404', '/api/', 'JSON', '<pre', '复制接口说明', '重试', '邀请数据暂未更新']) assert.ok(!html.includes(text), text);
});

test('backend reward fields drive the card and every task condition must pass', () => {
    const raw = { onceInviteReward: '80', inviteDepositRate: '0.15', inviteTaskReward: '500', registerReward: '20',
        gateNetUsdCents: 20000, gatePayers: 5, gateAccountDays: 3, accountDays: 2,
        invitedCount: 12, invitedCents: 20000, payers: 5, state: 'active' };
    const info = dataApi.normalizeInviteInfo(raw);
    assert.equal(info.config.signupInviter, 80);
    assert.equal(info.config.purchasePct, 15);
    assert.equal(info.config.signupInvitee, 0);
    assert.equal(info.registerReward, 20);
    assert.equal(info.hasEarnedCoins, false);
    assert.equal(dataApi.inviteTaskProgress(info.task).complete, false);
    const html = render(info, { rulesOpen: true });
    for (const text of ['你得 80 金币', '15%', '奖励 +500 金币', '有效邀请 5 / 5', '200.00', '账号天数 2 / 3']) assert.ok(html.includes(text), text);
    assert.ok(!html.includes('条件已达成'));
    const depositShort = dataApi.normalizeInviteInfo({ ...raw, accountDays: 3, invitedCents: 19999 });
    assert.equal(dataApi.inviteTaskProgress(depositShort.task).complete, false);
    assert.ok(dataApi.inviteTaskProgress(depositShort.task).percent < 100);
    const payersShort = dataApi.normalizeInviteInfo({ ...raw, accountDays: 3, payers: 4 });
    assert.equal(dataApi.inviteTaskProgress(payersShort.task).complete, false);
    const complete = dataApi.normalizeInviteInfo({ ...raw, accountDays: 3 });
    assert.equal(dataApi.inviteTaskProgress(complete.task).complete, true);
    assert.ok(render(complete).includes('条件已达成'));
    assert.ok(!render(complete).includes('已发放'));
    assert.equal(dataApi.inviteTaskProgress(dataApi.normalizeInviteInfo({ inviteTaskReward: 0, gatePayers: 0, gateNetUsdCents: 0 }).task).complete, false);
});

test('new fields override legacy config without guessing rate units or coin balances', () => {
    const info = dataApi.normalizeInviteInfo({ onceInviteReward: 0, inviteDepositRate: 0.15, inviteTaskReward: 100,
        config: { signupInviter: 80, purchasePct: 15 }, invitedCount: 99, payers: 2, gatePayers: 5,
        invitedCents: 5000, gateNetUsdCents: 20000, earnedCoins: 0, pendingCoins: 7 });
    assert.equal(info.config.signupInviter, 0);
    assert.equal(info.config.purchasePct, 15);
    assert.equal(info.task.payers, 2);
    assert.equal(info.hasEarnedCoins, true);
    assert.ok(render(info).includes('待结算 7 金币'));
    assert.ok(!render(info).includes('累计到账奖励暂不可用'));

});

const actualResponse = {
    gateAccountDays: 0, gateNetUsdCents: 20000, gatePayers: 5, accountDays: 0,
    invitedCount: 0, invitedCents: 0, onceInviteReward: 10, inviteDepositRate: 0.15,
    registerReward: 10, inviteTaskReward: 100, payers: 0, state: 'in_progress', inviteDepositReward: 0,
};

test('confirmed affiliate response displays 15 percent, actual task gates and deposit rewards', () => {
    const info = dataApi.normalizeInviteInfo(actualResponse);
    const html = render(info, { rulesOpen: true });
    for (const text of ['注册奖励 10 金币', '你得 10 金币', '你再得 15%', '再有 5 位好友充值，额外 +100 金币', '有效邀请 0 / 5', '200.00', '充值奖励金币']) assert.ok(html.includes(text), text);
    for (const text of ['0.15%', '金币推广仍可用', '暂不可用', '/api/', '重试', '额外奖励 300', '额外奖励 1000', '30 天内', '每日最多 20']) assert.ok(!html.includes(text), text);
    assert.equal(info.depositRewardCoins, 0);
    assert.equal(dataApi.normalizeInviteInfo({ ...actualResponse, inviteDepositRate: '0.15', inviteDepositReward: '12' }).depositRewardCoins, 12);
    const fractional = dataApi.normalizeInviteInfo({ ...actualResponse, inviteDepositRate: 0.075 });
    assert.equal(fractional.config.purchasePct, 7.5);
    assert.ok(render(fractional).includes('7.5%'));
    assert.equal(dataApi.normalizeInviteInfo({ ...actualResponse, inviteDepositRate: 0 }).config.purchasePct, 0);
    assert.ok(render(info, { locale: 'zh-TW' }).includes('15%'));
});

if (process.env.INVITE_PREVIEW_DIR) {
    const sass = require('sass');
    const css = sass.compile(new URL('../src/styles/invite-card.scss', import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, '$1')).css;
    const dir = process.env.INVITE_PREVIEW_DIR;
    mkdirSync(dir, { recursive: true });
    for (const [name, width, affiliate, rulesOpen] of [['h5', 360, false, false], ['pc', 760, true, true], ['error', 420, true, false]]) {
        writeFileSync(dir + '/' + name + '.html', '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#0c0d0f;font-family:Arial,sans-serif}main{box-sizing:border-box;max-width:' + width + 'px;padding:16px;margin:auto}' + css + '</style><main>' + render(dataApi.normalizeInviteInfo(actualResponse), { affiliate, rulesOpen, failed: name === 'error', error: 'POST /api/user/affiliate：404 Not Found · The route api/user/invite could not be found.' }) + '</main>');
    }
}
