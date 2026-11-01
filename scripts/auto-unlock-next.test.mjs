import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function setup(responses = []) {
    let token = 'account-a';
    let anonymous = false;
    const requests = [];
    const storage = { getItem: () => token };
    const api = async (path, options) => {
        requests.push({ path, options });
        const next = responses.shift();
        if (next instanceof Error) throw next;
        return typeof next === 'function' ? next() : next;
    };
    function load(file, dependencies) {
        const exports = {};
        const source = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
        const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
        vm.runInNewContext(code, { exports, require: key => dependencies[key], localStorage: storage });
        return exports;
    }
    const preference = load('src/lib/autoUnlockNext.ts', {
        '@/api': { api }, '@/stores/user': { useUserStore: { getState: () => ({ signed: !!token, isAnonymous: () => anonymous }) } },
    });
    const player = load('src/pages/user/VDemo/fetchVDemoEpisode.ts', {
        '@/api': { api }, '@/lib/autoUnlockNext': preference,
        '@/components/video-player/videoPlayerUtils': { isEpisodeDetailLocked: value => !!value },
    });
    return { preference, player, requests, setToken: value => { token = value; }, guest: () => { anonymous = true; } };
}

test('guest does not read or save account preferences', async () => {
    const s = setup(); s.guest();
    assert.equal(await s.preference.readAutoUnlockNext(), null);
    assert.equal(await s.preference.saveAutoUnlockNext(true), false);
    assert.equal(s.requests.length, 0);
});

test('duplicate reads share one request and string false stays disabled', async () => {
    const s = setup([{ c: 0, d: { wallet: { auto_unlock_next: 'false' } } }]);
    const values = await Promise.all([s.preference.readAutoUnlockNext(), s.preference.readAutoUnlockNext()]);
    assert.deepEqual(values, [false, false]);
    assert.equal(s.requests.length, 1);
});

test('save preserves other wallet settings and a failed save retains previous state', async () => {
    const s = setup([{ c: 0, d: { wallet: { auto_unlock_next: false, other: 7 } } }, { c: 0 }, { c: 1 }]);
    await s.preference.readAutoUnlockNext();
    assert.equal(await s.preference.saveAutoUnlockNext(true), true);
    assert.equal(s.requests[1].options.data.wallet.other, 7);
    assert.equal(s.requests[1].options.data.wallet.auto_unlock_next, true);
    assert.equal(await s.preference.saveAutoUnlockNext(false), false);
    assert.equal(await s.preference.readAutoUnlockNext(), true);
});

test('a late read for another session cannot authorize coin charges', async () => {
    let finish;
    const s = setup([() => new Promise(resolve => { finish = resolve; })]);
    const pending = s.preference.readAutoUnlockNext();
    s.setToken('account-b');
    finish({ c: 0, d: { wallet: { auto_unlock_next: true } } });
    assert.equal(await pending, null);
    assert.equal(await s.preference.saveAutoUnlockNext(true), false);
});

for (const enabled of [false, true]) test(`active episode follows the saved ${enabled ? 'on' : 'off'} setting`, async () => {
    const s = setup([{ c: 0, d: { wallet: { auto_unlock_next: enabled } } }, { c: 0, d: { id: 8, lock: true } }]);
    await s.player.fetchVDemoActiveEpisode(8, false);
    assert.equal(s.requests[1].path, 'movie/episode');
    assert.equal(s.requests[1].options.data.auto_unlock, enabled ? 1 : 0);
});

test('failed preference loading leaves automatic spending off', async () => {
    const s = setup([new Error('offline'), { c: 0, d: { id: 8 } }]);
    await s.player.fetchVDemoActiveEpisode(8, false);
    assert.equal(s.requests[1].options.data.auto_unlock, 0);
});

test('VIP episode never requests automatic coin spending', async () => {
    const s = setup([{ c: 0, d: { id: 8 } }]);
    await s.player.fetchVDemoActiveEpisode(8, true);
    assert.equal(s.requests.length, 1);
    assert.equal(s.requests[0].options.data.auto_unlock, 0);
});
