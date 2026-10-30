import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const source = ts.createSourceFile('Login.tsx', read('src/pages/user/Login.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const hook = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'useLoginBase');
const compile = text => ts.transpileModule(text, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;

function setup({ response = { c: 0, d: { token: 'account-token', info: { id: 22, anonymous: 0 } } }, customSuccess = true } = {}) {
    const storage = new Map([['isAnonymous', '1']]);
    const state = [], requests = [], messages = [], navigation = [];
    const prompt = { open: true, close() { prompt.open = false; } };
    const parent = { open: true, success: 0 };
    const user = { signed: true, info: { id: 7, anonymous: 1 }, signin(info) { user.info = info; } };
    let cursor = 0;
    const exports = {};
    vm.runInNewContext(compile(hook.getText(source) + '\nexport { useLoginBase };'), {
        exports,
        useState(initial) { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = value; }]; },
        useIntl: () => ({ formatMessage: ({ id }) => id }),
        usePixel: () => ({ track() {} }), useUserStore: () => user, useLoadingStore: () => ({}),
        useNavigate: () => (...args) => navigation.push(args),
        useAuthPromptStore: { getState: () => prompt },
        localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
        api: async (path, options) => { requests.push({ path, options }); return response; },
        emailVerify: value => value.includes('@'), fromSourceForLogin: () => ({}),
        getRegistrationReferralPayload: () => ({}), clearStoredAffiliateReferralCode() {},
        setIsAnonymousFromInfo: info => storage.set('isAnonymous', String(info.anonymous)),
        toast: { success: message => messages.push(message), error() {} },
    });
    function render() {
        cursor = 0;
        return exports.useLoginBase('pc', {
            onRequestClose: () => { parent.open = false; },
            ...(customSuccess ? { onLoginSuccess: () => { parent.success++; } } : {}),
        });
    }
    const form = render();
    form.setEmail('account@example.test');
    form.handleRegisterPasswordChange({ currentTarget: { value: 'password123' } });
    form.handleRegisterPasswordConfirmChange({ currentTarget: { value: 'password123' } });
    form.handleLoginPasswordChange({ currentTarget: { value: 'password123' } });
    return { render, prompt, parent, user, messages, requests, navigation, storage };
}

test('registration success clears a global prompt left open by another login entry', async () => {
    const s = setup();
    await s.render().handleRegister();
    assert.ok(s.messages.includes('register_success'));
    assert.equal(s.storage.get('token'), 'account-token');
    assert.equal(s.prompt.open, false);
    assert.equal(s.parent.success, 1);
    assert.equal(s.navigation.length, 0);
});

test('email login success also clears global login prompts', async () => {
    const s = setup();
    await s.render().handleSubmit();
    assert.equal(s.prompt.open, false);
    assert.equal(s.parent.success, 1);
    assert.equal(s.requests[0].options.data.anonymous_id, '');
});

test('an independently controlled login closes after successful registration', async () => {
    const s = setup({ customSuccess: false });
    await s.render().handleRegister();
    assert.equal(s.parent.open, false);
    assert.equal(s.prompt.open, false);
});

test('failed or incomplete registration leaves the form available for correction', async () => {
    for (const response of [{ c: 1 }, { c: 0, d: { token: '', info: {} } }]) {
        const s = setup({ response });
        await s.render().handleRegister();
        assert.equal(s.prompt.open, true);
        assert.equal(s.parent.open, true);
        assert.equal(s.parent.success, 0);
        assert.equal(s.messages.length, 0);
    }
});

function renderPrompt(user) {
    const effects = [];
    const prompt = { open: true, close() { prompt.open = false; } };
    const exports = {};
    vm.runInNewContext(compile(read('src/components/AccountLoginDialog.tsx')), {
        exports,
        require: name => ({
            'react/jsx-runtime': require('react/jsx-runtime'),
            react: { useEffect: effect => effects.push(effect) },
            '@/pages/user/Login': { PcLoginDialog: () => null },
            '@/stores/authPrompt': { useAuthPromptStore: selector => selector(prompt) },
            '@/stores/user': { useUserStore: selector => selector(user) },
            '@/lib/searchRoutes': { matchSearchFamilyPath: () => false },
            'react-router': { useLocation: () => ({ pathname: '/profile' }), useNavigate: () => () => {} },
        })[name],
    });
    const dialog = exports.AccountLoginDialog();
    for (const effect of effects) effect();
    return { dialog, prompt };
}

test('a stale global prompt stays hidden once a registered account is signed in', () => {
    const result = renderPrompt({ signed: true, isAnonymous: () => false });
    assert.equal(result.dialog.props.open, false);
    assert.equal(result.prompt.open, false);
});

test('guests and signed-out users can still open the login prompt', () => {
    for (const user of [{ signed: true, isAnonymous: () => true }, { signed: false, isAnonymous: () => false }]) {
        const result = renderPrompt(user);
        assert.equal(result.dialog.props.open, true);
        assert.equal(result.prompt.open, true);
    }
});
