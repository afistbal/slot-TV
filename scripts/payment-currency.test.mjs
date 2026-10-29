import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const compiled = Object.fromEntries(['lib/paymentCurrency.ts', 'lib/payCreateData.ts', 'pages/user/RadixRcShoppingPaySection.tsx'].map(path => [path,
    ts.transpileModule(source('src/' + path), { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText,
]));

async function checkout({ currency = 'USD', apple = false, productType = 2 } = {}) {
    const requests = [], elements = [], errors = [], statuses = [], refs = [], states = [];
    let effects = [], stateIndex = 0, refIndex = 0, inits = 0;
    const dependencies = {
        '@/lib/fbAttribution': { fbAttributionForPayCreate: () => ({ fbp: 'test-fbp' }) },
        '@/lib/payLog': { reportPayLog: () => {} },
        '@/lib/isApplePlatform': { isApplePlatform: () => apple },
        '@/lib/utils': { cn: (...args) => args.filter(Boolean).join(' ') },
        '@/api': { api: async (path, options) => {
            requests.push({ path, data: options.data });
            return { c: 0, d: { pi: 'test-intent', sn: 'test-order', client_secret: 'test-only',
                customer_id: 'test-customer', currency, amount: '1.00', env: 'demo' } };
        } },
        '@/lib/airwallexShoppingWalletEmbedSingleton': {
            airwallexEnsureShoppingWalletInit: async () => { inits++; }, normalizeAirwallexLocale: value => value,
        },
        '@/hooks/usePixel': { buildProductPixelPayload: value => value, trackFbAddToCart() {}, trackFbInitiateCheckout() {}, trackFbPurchase() {} },
        '@airwallex/components-sdk': { createElement: async (type, options) => {
            elements.push({ type, options });
            return { mount() {}, on() {}, unmount() {}, destroy() {} };
        } },
        sonner: { toast: { error: value => errors.push(value) } },
        'react-intl': { useIntl: () => ({ locale: 'zh-CN', formatMessage: ({ id }) => id }) },
        react: {
            useState(initial) {
                const index = stateIndex++;
                if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
                return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
            },
            useRef(initial) { const index = refIndex++; return refs[index] ??= { current: initial }; },
            useEffect: effect => effects.push(effect),
        },
        'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    };
    function load(path) {
        const exports = {};
        vm.runInNewContext(compiled[path], { exports, console, document: { activeElement: null }, HTMLElement: class {},
            window: { location: { href: 'https://example.test/shopping' } }, require(name) {
                if (name.startsWith('@/assets/')) return '';
                assert.ok(name in dependencies, 'Missing dependency: ' + name);
                return dependencies[name];
            },
        });
        return exports;
    }
    dependencies['@/lib/paymentCurrency'] = load('lib/paymentCurrency.ts');
    dependencies['@/lib/payCreateData'] = load('lib/payCreateData.ts');
    const Component = load('pages/user/RadixRcShoppingPaySection.tsx').default;
    function render() {
        effects = []; stateIndex = 0; refIndex = 0;
        Component({ walletProductId: 7, checkoutTargetProductId: 7, checkoutFrom: 'shopping',
            checkoutProductMeta: { id: 7, name: 'coin2000', price: '1.00', type: productType },
            payCreateDiscountType: 2, onPayStateChange: value => statuses.push(value) });
    }
    render();
    effects[0]();
    await new Promise(resolve => setImmediate(resolve));
    render();
    for (const ref of refs.slice(0, 3)) ref.current = { replaceChildren() {} };
    effects[1]();
    await new Promise(resolve => setImmediate(resolve));
    return { requests, elements, errors, statuses, inits };
}

for (const apple of [false, true]) {
    for (const productType of [1, 2]) {
        test(`USD checkout mounts wallet and card with unchanged $1 amount (apple=${apple}, productType=${productType})`, async () => {
            const result = await checkout({ apple, productType });
            assert.equal(result.requests.length, 1);
            assert.equal(result.requests[0].path, 'pay/create');
            assert.equal(result.requests[0].data.currency, 'USD');
            assert.equal(result.requests[0].data.product_id, 7);
            assert.equal(result.requests[0].data.discount_type, 2);
            assert.equal(result.requests[0].data.fbp, 'test-fbp');
            assert.equal(result.inits, 1);
            assert.equal(result.elements.length, apple ? 3 : 2);
            for (const { type, options } of result.elements) {
                assert.equal(options.mode, productType === 2 ? 'payment' : 'recurring');
                if (type === 'dropIn') assert.equal(options.currency, 'USD');
                else {
                    assert.equal(options.amount.currency, 'USD');
                    assert.equal(options.amount.value, 1);
                }
            }
            assert.deepEqual(result.errors, []);
            assert.deepEqual(result.statuses, []);
        });
    }
}

for (const currency of ['CNY', 'EUR', '', null]) {
    test(`unexpected or missing intent currency does not initialize Airwallex (${currency})`, async () => {
        const result = await checkout({ currency });
        assert.equal(result.requests[0].data.currency, 'USD');
        assert.equal(result.inits, 0);
        assert.equal(result.elements.length, 0);
        assert.deepEqual(result.errors, ['payment_currency_mismatch']);
        assert.deepEqual(result.statuses, ['failed']);
    });
}

test('standalone checkout passes USD and rejects incompatible payment intents', async () => {
    const html = source('public/airwallex.html');
    const script = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].at(-1)[1];
    for (const currency of ['USD', 'CNY', '']) {
        const redirects = [];
        const nodes = new Map();
        vm.runInNewContext(script, { URLSearchParams,
            window: { location: { search: '?customer_id=test&currency=' + currency } },
            document: { querySelector: name => {
                if (!nodes.has(name)) nodes.set(name, { style: {} });
                return nodes.get(name);
            } },
            AirwallexComponentsSDK: { init: async () => ({ payments: { redirectToCheckout: value => redirects.push(value) } }) },
        });
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(redirects.length, currency === 'USD' ? 1 : 0);
        if (currency === 'USD') assert.equal(redirects[0].currency, 'USD');
        else assert.match(nodes.get('#message').innerText, /USD/);
    }
});
