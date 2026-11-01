import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IntlProvider } from 'react-intl';

const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
function load(path, dependencies = {}) {
    const exports = {};
    const compiled = ts.transpileModule(read('src/' + path), { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText;
    vm.runInNewContext(compiled, { exports, require: name => {
        if (name.endsWith('.scss')) return {};
        if (name.startsWith('@/assets/')) return '/test-fixture.svg';
        assert.ok(name in dependencies, 'Missing dependency: ' + name);
        return dependencies[name];
    } });
    return exports;
}
const dates = load('lib/chinaDateTime.ts');

test('Chinese date order and 24-hour time stay consistent across device time zones', () => {
    const originalZone = process.env.TZ;
    try {
        for (const zone of ['UTC', 'America/Los_Angeles', 'Asia/Shanghai', 'Asia/Tokyo']) {
            process.env.TZ = zone;
            assert.equal(dates.formatChinaDateTime('2026-10-24T03:25:40Z'), '2026-10-24 11:25:40');
            assert.equal(dates.formatChinaDateTime('2026-10-23T20:25:40-07:00'), '2026-10-24 11:25:40');
            assert.equal(dates.formatChinaDateTime('2026-10-24 11:25:40'), '2026-10-24 11:25:40');
            assert.equal(dates.formatChinaDateTime('2026-10-24T11:25:40'), '2026-10-24 11:25:40');
            assert.equal(dates.formatChinaDate('2026-10-24'), '2026-10-24');
        }
    } finally {
        if (originalZone === undefined) delete process.env.TZ;
        else process.env.TZ = originalZone;
    }
});

test('Beijing midnight crosses the day and year correctly and never becomes 24:00', () => {
    const value = '2026-12-31T16:05:06Z';
    assert.equal(dates.formatChinaDateTime(value), '2027-01-01 00:05:06');
    assert.equal(dates.formatChinaDateTime(value, { seconds: false }), '2027-01-01 00:05');
    assert.equal(dates.formatChinaDate(value), '2027-01-01');
    assert.equal(dates.formatChinaTime(value), '00:05');
    assert.equal(dates.formatChinaDateTime('2026-05-18T05:57:24Z'), '2026-05-18 13:57:24');
});

test('ISO, database dates, millisecond timestamps and Date values share the same display', () => {
    const value = '2026-10-24T03:25:40Z';
    for (const input of [value, '2026-10-24 03:25:40Z', '2026-10-24T11:25:40+08:00',
        '2026-10-24 11:25:40.123', Date.parse(value), new Date(value)]) {
        assert.equal(dates.formatChinaDateTime(input), '2026-10-24 11:25:40');
    }
    assert.equal(dates.formatChinaDateTime(0), '1970-01-01 08:00:00');
});

test('missing and invalid dates render a safe placeholder without throwing', () => {
    for (const input of [null, undefined, '', '  ', 'invalid date', NaN, Infinity, new Date(NaN)]) {
        assert.equal(dates.formatChinaDateTime(input), '—');
        assert.equal(dates.formatChinaDate(input), '—');
        assert.equal(dates.formatChinaTime(input, ''), '');
    }
});

function renderWallet(variant, activeTab, locale) {
    const row = { type: activeTab === 'recharge' ? 1 : 2, change: 10, amount: 10, target: 1,
        created_at: '2026-10-24T03:25:40Z', price: 1 };
    const state = [[row], false, activeTab, 1];
    let stateIndex = 0;
    const Component = load('pages/user/WalletTransactionHistory.tsx', {
        react: { ...React, useState: () => [state[stateIndex++], () => {}], useEffect: () => {} },
        'react/jsx-runtime': require('react/jsx-runtime'), 'react-intl': require('react-intl'),
        'lucide-react': require('lucide-react'), 'react-router': {},
        '@/lib/chinaDateTime': dates, '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
        '@/api': {}, '@/components/Loader': {}, '@/components/NoMore': { default: () => null },
        '@/lib/enrichBalanceHistoryRows': {}, '@/constants/brand': { BRAND_COIN_ICON_SRC: '/test-coin.svg' },
        '@/constants/videoRoute': {},
    }).WalletTransactionHistory;
    return renderToStaticMarkup(React.createElement(IntlProvider, {
        locale, messages: JSON.parse(read('src/locales/' + (locale === 'en' ? 'zh-CN' : locale) + '.json')),
    }, React.createElement(Component, { variant })));
}

test('PC and mobile wallet recharge and consumption records use Chinese dates in every UI language', () => {
    for (const variant of ['h5', 'pc']) {
        for (const tab of ['recharge', 'consumption']) {
            for (const locale of ['zh-CN', 'zh-TW', 'en']) {
                const html = renderWallet(variant, tab, locale);
                const displayed = html.match(/<time[^>]*>([^<]*)<\/time>/)?.[1];
                assert.equal(displayed, '2026-10-24 11:25:40', `${variant}/${tab}/${locale}`);
                assert.match(html, /datetime="2026-10-24T03:25:40Z"/i, 'preserve the source timestamp');
            }
        }
    }
});
