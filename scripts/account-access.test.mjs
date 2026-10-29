import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const compile = text => ts.transpileModule(text, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
const access = {};
vm.runInNewContext(compile(read('src/lib/accountAccess.ts')), { exports: access });
const app = ts.createSourceFile('App.tsx', read('src/App.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const guard = app.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'RequireAccountRoute');

test('all profile links require an account while public viewing stays accessible', () => {
    for (const path of ['/profile', '/profile?tab=wallet', '/profile?tab=feedback', '/zh-CN/profile', '/en/profile?tab=topup']) {
        assert.equal(access.isAccountProtectedUrl(new URL(path, 'https://example.test')), true, path);
    }
    for (const path of ['/', '/foryou', '/drama/12', '/video/12/3', '/page/login']) {
        assert.equal(access.isAccountProtectedUrl(new URL(path, 'https://example.test')), false, path);
    }
});

function renderGuard({ ready = true, signed = false, anonymous = false } = {}) {
    const exports = {}, navigations = [];
    const context = {
        exports, require,
        useNavigate: () => (...args) => navigations.push(args),
        useRootStore: selector => selector({ sessionBootstrapReady: ready }),
        useUserStore: selector => selector({ signed, isAnonymous: () => anonymous }),
        InitialBootPlaceholder: () => React.createElement('div', { 'data-boot': true }),
        PcLoginDialog: () => React.createElement('div', { 'data-login': true }),
    };
    vm.runInNewContext(compile(guard.getText(app) + '\nexport { RequireAccountRoute };'), context);
    const node = exports.RequireAccountRoute({ children: React.createElement('div', { 'data-account': true }) });
    return { node, navigations, html: renderToStaticMarkup(node) };
}

test('logged-out and anonymous sessions cannot render account content', () => {
    for (const state of [{ signed: false }, { signed: true, anonymous: true }]) {
        const result = renderGuard(state);
        assert.match(result.html, /data-login/);
        assert.doesNotMatch(result.html, /data-account/);
        result.node.props.children.props.onOpenChange(false);
        assert.equal(result.navigations[0][0], '/');
        assert.equal(result.navigations[0][1].replace, true);
    }
});

test('session bootstrap must finish before any account content renders', () => {
    const result = renderGuard({ ready: false, signed: true });
    assert.match(result.html, /data-boot/);
    assert.doesNotMatch(result.html, /data-account|data-login/);
});

test('a signed-in account can render its profile', () => {
    assert.match(renderGuard({ signed: true, anonymous: false }).html, /data-account/);
});

test('direct profile navigation uses the account guard', () => {
    let profile;
    function visit(node) {
        if (ts.isObjectLiteralExpression(node) && node.properties.some(prop => ts.isPropertyAssignment(prop)
            && prop.name.getText(app) === 'path' && ts.isStringLiteral(prop.initializer) && prop.initializer.text === 'profile')) profile = node;
        ts.forEachChild(node, visit);
    }
    visit(app);
    assert.ok(profile);
    const element = profile.properties.find(prop => ts.isPropertyAssignment(prop) && prop.name.getText(app) === 'element').initializer;
    assert.ok(ts.isJsxElement(element));
    assert.equal(element.openingElement.tagName.getText(app), 'RequireAccountRoute');
});
