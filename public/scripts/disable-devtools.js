/**
 * 禁止打开开发者工具（对齐 reelshort `_app` 内 Bn 组件）。
 * 参考：www.reelshort.com/_next/static/chunks/pages/_app-*.js
 * reelshort 不做 about:blank / outerWidth 检测，避免 iOS Chrome 误杀。
 */
(function disableDevtools() {
    'use strict';

    function getQueryParam(name) {
        try {
            var search = location.search || '';
            if (!search || search.length < 2) {
                return null;
            }
            return new URLSearchParams(search).get(name);
        } catch (e) {
            return null;
        }
    }

    function getStorageItem(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            return null;
        }
    }

    function shouldSkip() {
        var host = location.hostname;
        var port = location.port;

        // 本地 / vite 调试跳过
        if (host === 'localhost' || host === '127.0.0.1' || port === '5173') {
            return true;
        }
        if (location.pathname.indexOf('/z') === 0) {
            return true;
        }

        // reelshort: development / test / gray 环境跳过
        if (/^(test|dev|gray)/i.test(host) || host.indexOf('testwww') !== -1) {
            return true;
        }
        // reelshort: ?developer_tools=1 或 localStorage developer_tools=1 跳过
        if (getQueryParam('developer_tools') === '1') {
            return true;
        }
        if (getStorageItem('developer_tools') === '1') {
            return true;
        }

        return false;
    }

    // reelshort t(): 每 1s 执行 Function("debugger")()
    function startAntiDebugger() {
        setInterval(function () {
            Function('debugger')();
        }, 1000);
    }

    // reelshort n(): 禁右键 + 拦截 DevTools 快捷键
    function blockDevtoolsShortcuts() {
        document.oncontextmenu = function () {
            return false;
        };
        document.addEventListener('keydown', function (event) {
            if (
                event.keyCode === 123 ||
                (event.ctrlKey && event.shiftKey && event.keyCode === 73) ||
                (event.altKey && event.metaKey && event.keyCode === 73) ||
                (event.shiftKey && event.keyCode === 121)
            ) {
                event.preventDefault();
                return false;
            }
        });
    }

    try {
        if (shouldSkip()) {
            return;
        }
        startAntiDebugger();
        blockDevtoolsShortcuts();
    } catch (e) {
        /* noop */
    }
})();
