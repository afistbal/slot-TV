import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
function load(path, dependencies = {}, globals = {}) {
    const exports = {};
    vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/' + path, import.meta.url), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, { exports, ...globals, require: name => {
        if (name.endsWith('.scss')) return {};
        if (name.startsWith('@/assets/')) return '/test-fixture.svg';
        assert.ok(name in dependencies, 'Missing dependency: ' + name);
        return dependencies[name];
    } });
    return exports;
}
const ui = {
    react: React, 'react/jsx-runtime': require('react/jsx-runtime'), 'lucide-react': require('lucide-react'),
    'react-intl': { useIntl: () => ({ locale: 'zh-CN' }), FormattedMessage: ({ id }) => id },
};
const inline = load('components/video-player/VideoPlayerInlineRating.tsx', ui);

test('unrated intro always offers five enabled stars and forwards the selected score', () => {
    const selected = [];
    const tree = inline.VideoPlayerInlineRating({ onRate: score => selected.push(score) });
    const buttons = tree.props.children[1].props.children;
    assert.equal(buttons.length, 5);
    assert.ok(buttons.every(button => !button.props.disabled));
    buttons[3].props.onClick();
    assert.deepEqual(selected, [4]);
});

test('a saved rating stays visible with the selected stars, and submission disables repeat clicks', () => {
    const html = renderToStaticMarkup(React.createElement(inline.VideoPlayerInlineRating, { score: 4, onRate() {} }));
    assert.match(html, /我的评分/);
    assert.match(html, /已评分/);
    assert.equal((html.match(/role="radio"/g) ?? []).length, 5);
    assert.equal((html.match(/aria-checked="true"/g) ?? []).length, 1);
    assert.equal((html.match(/disabled=""/g) ?? []).length, 5);
    const busy = inline.VideoPlayerInlineRating({ submitting: true, onRate() {} });
    assert.ok(busy.props.children[1].props.children.every(button => button.props.disabled));
});

const data = { info: { id: 7, title: 'Test drama', introduction: 'Test introduction', image: '' }, tags: [], episodes: [] };
const children = ({ children }) => React.createElement(React.Fragment, null, children);
const drawerDependencies = {
    ...ui, 'react-router': { Link: children }, '@/components/Image': { default: () => null },
    '@/lib/videoIntroTagSearch': {}, '@/lib/normalizePlayerTags': { getBackendTagDisplayText: () => '' },
    '@/lib/movieTagLabels': { useMovieTagLabelsReady() {} }, '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
    '../videoPlayerShareUrl': { resolveVideoPosterUrl: () => '' }, '../videoPlayerUtils': { getTagDisplayText: () => '' },
    '../VideoPlayerInlineRating': inline,
};

test('PC and mobile introduction drawers render rating controls without depending on daily reward quota', () => {
    const Pc = load('components/video-player/views/VideoPlayerPcIntroDrawer.tsx', {
        ...drawerDependencies, './VideoPlayerPcDrawerCloseButton': { VideoPlayerPcDrawerCloseButton: () => null },
        './VideoPlayerPcRightDrawer': { VideoPlayerPcRightDrawer: children },
    }).VideoPlayerPcIntroDrawer;
    const Mobile = load('components/video-player/views/VideoPlayerEpisodeSpeedIntroDrawers.tsx', {
        ...drawerDependencies, '@/components/ui/drawer': { Drawer: children, DrawerContent: children, DrawerTitle: children },
        '../videoPlayerConstants': { SPEED: [] }, '../videoPlayerPcEpisodeTabs': { buildEpisodeTabRanges: () => [], H5_EPISODE_TAB_PAGE_SIZE: 50 },
    }).VideoPlayerEpisodeSpeedIntroDrawers;
    for (const Component of [Pc, Mobile]) {
        const html = renderToStaticMarkup(React.createElement(Component, {
            data, open: true, entered: true, anchorRef: { current: null }, staticBase: '',
            introduction: true, hideEpisodeDrawer: true, hideSpeedDrawer: true, onRate() {},
        }));
        assert.match(html, /Test drama/);
        assert.match(html, /给这部剧打分/);
        assert.equal((html.match(/role="radio"/g) ?? []).length, 5);
    }
});

function ratingApi({ left = 0, rateFails = false } = {}) {
    const requests = [];
    const state = { tasks: undefined, tasksSession: '', tasksUpdatedAt: 0,
        setTasks(tasks, session) { this.tasks = tasks; this.tasksSession = session; this.tasksUpdatedAt = Date.now(); },
        clearTasks() { this.tasks = undefined; this.tasksSession = ''; }, invalidate() {} };
    const wheel = load('lib/luckyWheel.ts');
    const pageData = load('lib/luckyPageData.ts', { '@/lib/luckyWheel': wheel });
    const api = load('api/lucky.ts', {
        '@/lib/movieCoverUrl': {}, '@/lib/luckyPageData': pageData, '@/lib/luckyWheel': wheel,
        '@/stores/lucky': { useLuckyStore: { getState: () => state } },
        '@/api': { formatApiFailure: (_method, path) => path + ' failed', api: async (path, options) => {
            requests.push({ path, data: options.data });
            if (path === 'user/tasks') return { c: 0, d: { tasks: [{ key: 'rating', left, cap: 3, done: left === 0, earned: 15 }] } };
            if (path === 'user/rate') return { c: rateFails ? 1 : 0, d: null };
            if (path === 'user/coin') return { c: 0, d: { coins: 3 } };
            throw new Error('Unexpected request: ' + path);
        } },
    }, { localStorage: { getItem: () => 'test-account' } });
    return { ...api, requests };
}

test('after five rewarded ratings, another rating still submits and no further coins are claimed', async () => {
    const api = ratingApi({ left: 0 });
    assert.equal(await api.submitLuckyRating('7', 5), undefined);
    const rate = api.requests.find(row => row.path === 'user/rate');
    assert.equal(rate.data.dramaId, '7');
    assert.equal(rate.data.score, 5);
    assert.ok(!api.requests.some(row => row.path === 'user/coin'));
});

test('available rewards are claimed only after a rating succeeds', async () => {
    const api = ratingApi({ left: 1 });
    assert.equal(await api.submitLuckyRating('7', 4), 3);
    const paths = api.requests.map(row => row.path);
    assert.ok(paths.indexOf('user/rate') < paths.indexOf('user/coin'));
    assert.equal(api.requests.find(row => row.path === 'user/coin').data.type, 'watchRate');
    const failed = ratingApi({ left: 1, rateFails: true });
    await assert.rejects(failed.submitLuckyRating('7', 4), /user\/rate failed/);
    assert.ok(!failed.requests.some(row => row.path === 'user/coin'));
});
