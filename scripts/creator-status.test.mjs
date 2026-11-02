import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/pages/user/CreatorProgram.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source + '\nexport { normalizeAuthor };', { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
const flush = () => new Promise(resolve => setImmediate(resolve));

function find(node, predicate) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.map(value => find(value, predicate)).find(Boolean);
    return predicate(node) ? node : find(node.props?.children, predicate);
}

function setup({ status = null, ready = true, statusFails = false, submitFails = false,
    submittedStatus = 0, workspaceFails = false, query = '', deferStatus = false } = {}) {
    const requests = [], errors = [], successes = [], states = { page: [], dialog: [] };
    let scope = 'page', stateIndex = 0, effects = [], submitted = false;
    let releaseStatus, failStatus = statusFails;
    const element = (type, props) => ({ type, props });
    const dependencies = {
        react: {
            useCallback: value => value, useRef: current => ({ current }),
            useState(initial) {
                const pool = states[scope], index = stateIndex++;
                if (!(index in pool)) pool[index] = typeof initial === 'function' ? initial() : initial;
                return [pool[index], value => { pool[index] = typeof value === 'function' ? value(pool[index]) : value; }];
            },
            useEffect: effect => effects.push(effect),
        },
        'react/jsx-runtime': { jsx: element, jsxs: element },
        'react-intl': { useIntl: () => ({ formatMessage: ({ id }) => id }) },
        'react-router': { useNavigate: () => () => {}, useSearchParams: () => [new URLSearchParams(query), () => {}] },
        'lucide-react': {}, sonner: { toast: { error: value => errors.push(value), success: value => successes.push(value) } },
        '@/components/ProgramSelect': {}, '@/components/ProgramIcon': {}, '@/components/ReelShortTopNav': {},
        '@/components/ReelShortBasicsSpin': { ReelShortBasicsSpin: 'LoadingSpinner' },
        '@/components/ui/dialog': { Dialog: 'Dialog', DialogContent: 'DialogContent', DialogHeader: 'DialogHeader',
            DialogTitle: 'DialogTitle', DialogDescription: 'DialogDescription' },
        '@/constants/brand': { BRAND_DISPLAY_NAME: 'Test' }, '@/api/baseURL': { apiBaseURL: 'https://example.test/api/' },
        '@/stores/root': { useRootStore: selector => selector({ sessionBootstrapReady: ready }) },
        '@/stores/user': { useUserStore: () => ({ signed: true, isAnonymous: () => false }) },
        '@/data/creatorDemo': { isCreatorDemo: () => false },
        '@/components/CreatorWorkspace': { CreatorWorkspace: 'Workspace', loadCreatorWorkspace: async () => {
            requests.push({ method: 'post', path: 'creator/dashboard' });
            if (workspaceFails) throw new Error('workspace unavailable');
            return { totalEarnedCents: 123, contentStats: [] };
        } },
        '@/api': { formatApiFailure: (method, path) => `${method} /api/${path}`, api: async (path, options) => {
            requests.push({ path, ...options });
            assert.equal(path, 'user/author');
            if (options.method === 'post') {
                submitted = !submitFails;
                return { c: submitFails ? 1 : 0, m: '', d: null };
            }
            assert.equal(options.method, 'get');
            if (deferStatus) await new Promise(resolve => { releaseStatus = resolve; });
            return { c: failStatus ? 1 : 0, m: '', d: { status: submitted ? submittedStatus : status, review_note: '审核说明' } };
        } },
    };
    const exports = {};
    vm.runInNewContext(compiled, { exports, URLSearchParams, FormData: class {
        constructor(form) { this.form = form; }
        get(key) { return this.form[key] ?? null; }
    }, require: name => {
        if (name.endsWith('.scss')) return {};
        assert.ok(name in dependencies, 'Missing dependency: ' + name);
        return dependencies[name];
    } });
    function render() {
        scope = 'page'; stateIndex = 0; effects = [];
        return exports.default();
    }
    function start() {
        const tree = render();
        for (const effect of effects) effect();
        return tree;
    }
    async function enter() {
        start();
        await flush();
        return render();
    }
    async function submit() {
        const page = render();
        const button = find(page, node => node.type === 'button'
            && node.props.className === 'creator-program__button creator-program__button--large');
        button.props.onClick();
        const dialog = find(render(), node => node.type?.name === 'CreatorApplicationDialog');
        assert.equal(dialog.props.open, true);
        scope = 'dialog'; stateIndex = 0;
        const form = find(dialog.type(dialog.props), node => node.type === 'form');
        await form.props.onSubmit({ preventDefault() {}, currentTarget: {
            payoutMethod: '1', displayName: 'Test creator', contact: 'creator@example.test',
            intro: '创作介绍'.repeat(20), sampleUrl: 'https://example.test/work', monthlyOutput: '5',
        } });
        await flush();
        return render();
    }
    return { ...exports, requests, errors, successes, render, enter, submit, start,
        resolveStatus: () => releaseStatus(), setStatusFails: value => { failStatus = value; } };
}

test('numeric author status maps null/0/1/2 without treating zero as missing', () => {
    const { normalizeAuthor } = setup();
    assert.equal(normalizeAuthor({ status: null }), null);
    assert.equal(normalizeAuthor({ status: 0 }).status, 'pending');
    assert.equal(normalizeAuthor({ status: 1 }).status, 'approved');
    assert.equal(normalizeAuthor({ status: 2, review_note: '需要更多作品' }).reviewNote, '需要更多作品');
    assert.equal(normalizeAuthor({ status: 2 }).status, 'rejected');
});

for (const [status, page] of [[null, null], [0, 'CreatorPending'], [1, 'CreatorDashboard'], [2, 'CreatorRejected']]) {
    test(`GET user/author status=${status} controls the page and approved-only workspace loading`, async () => {
        const s = setup({ status });
        const tree = await s.enter();
        assert.equal(s.requests[0].path, 'user/author');
        assert.equal(s.requests[0].method, 'get');
        assert.equal(s.requests.filter(row => row.path === 'creator/dashboard').length, status === 1 ? 1 : 0);
        assert.equal(Boolean(find(tree, node => ['CreatorPending', 'CreatorDashboard', 'CreatorRejected'].includes(node.type?.name))), page !== null);
        if (page) assert.ok(find(tree, node => node.type?.name === page));
        assert.deepEqual(s.errors, []);
    });
}

test('legacy preview/demo query parameters cannot override the API status or open the application', async () => {
    const s = setup({ query: 'preview=approved&demo=1' });
    const tree = await s.enter();
    assert.ok(!find(tree, node => node.type?.name === 'CreatorDashboard' || node.type?.name === 'ProgramFlowPreview'));
    assert.equal(find(tree, node => node.type?.name === 'CreatorApplicationDialog').props.open, false);
    assert.equal(s.requests.length, 1);
});

test('a failed status query reports GET user/author and never opens a demo dashboard', async () => {
    const s = setup({ statusFails: true });
    const tree = await s.enter();
    assert.deepEqual(s.errors, ['GET /api/user/author']);
    assert.equal(s.requests.length, 1);
    assert.ok(!find(tree, node => node.type?.name === 'CreatorDashboard'));
});

for (const submittedStatus of [0, 1, 2]) {
    test(`submit stays POST, then GET status=${submittedStatus} drives the resulting page`, async () => {
        const s = setup({ submittedStatus });
        await s.enter();
        const tree = await s.submit();
        assert.deepEqual(s.requests.slice(0, 3).map(row => [row.method, row.path]),
            [['get', 'user/author'], ['post', 'user/author'], ['get', 'user/author']]);
        const page = ['CreatorPending', 'CreatorDashboard', 'CreatorRejected'][submittedStatus];
        assert.ok(find(tree, node => node.type?.name === page));
        assert.equal(s.requests.filter(row => row.path === 'creator/dashboard').length, submittedStatus === 1 ? 1 : 0);
        assert.equal(find(tree, node => node.type?.name === 'CreatorApplicationDialog').props.open, false);
        assert.deepEqual(s.errors, []);
    });
}

test('a rejected submission keeps the form open and does not fetch a new status', async () => {
    const s = setup({ submitFails: true });
    await s.enter();
    const tree = await s.submit();
    assert.deepEqual(s.requests.map(row => row.method), ['get', 'post']);
    assert.deepEqual(s.errors, ['POST /api/user/author']);
    assert.equal(find(tree, node => node.type?.name === 'CreatorApplicationDialog').props.open, true);
    assert.equal(s.successes.length, 0);
});

test('the page waits for session bootstrap before requesting author status', async () => {
    const s = setup({ ready: false });
    const tree = await s.enter();
    assert.equal(s.requests.length, 0);
    assert.ok(find(tree, node => node.type === 'LoadingSpinner'));
    assert.ok(!find(tree, node => node.props?.className === 'creator-program'));
});

for (const [status, page] of [[null, null], [0, 'CreatorPending'], [1, 'CreatorDashboard'], [2, 'CreatorRejected']]) {
    test(`slow status=${status} never flashes the application landing page before the response`, async () => {
        const s = setup({ status, deferStatus: true });
        const initial = s.start();
        assert.ok(find(initial, node => node.type === 'LoadingSpinner'));
        assert.ok(!find(initial, node => node.props?.className === 'creator-program'));
        await flush();
        const waiting = s.render();
        assert.ok(find(waiting, node => node.type === 'LoadingSpinner'));
        assert.ok(!find(waiting, node => node.props?.className === 'creator-program'));
        s.resolveStatus();
        await flush();
        const loaded = s.render();
        assert.ok(!find(loaded, node => node.type === 'LoadingSpinner'));
        if (page) assert.ok(find(loaded, node => node.type?.name === page));
        else assert.ok(find(loaded, node => node.props?.className === 'creator-program'));
    });
}

test('status failure offers retry without showing the application landing page', async () => {
    const s = setup({ status: 0, statusFails: true });
    const failed = await s.enter();
    assert.ok(!find(failed, node => node.props?.className === 'creator-program'));
    assert.ok(find(failed, node => node.props?.role === 'alert'));
    s.setStatusFails(false);
    find(failed, node => node.type === 'button' && node.props.children === 'creator_retry').props.onClick();
    assert.ok(find(s.render(), node => node.type === 'LoadingSpinner'));
    await flush();
    assert.ok(find(s.render(), node => node.type?.name === 'CreatorPending'));
});
