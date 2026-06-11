/**
 * 禁止打开开发者工具（对齐 reelshort / netshort 常见 H5 防护）。
 * 在 index.html 最早加载；localhost / 127.0.0.1 / vite 5173 自动跳过，便于本地调试。
 */
(function disableDevtools() {
    'use strict';

    var host = location.hostname;
    var port = location.port;
    if (host === 'localhost' || host === '127.0.0.1' || port === '5173') {
        return;
    }
    if (location.pathname.indexOf('/z') === 0) {
        return;
    }

    var DEVTOOLS_GAP = 160;

    function onDevtoolsOpen() {
        try {
            location.replace('about:blank');
        } catch (e) {
            /* noop */
        }
    }

    function blockContextMenu() {
        document.addEventListener(
            'contextmenu',
            function (event) {
                event.preventDefault();
            },
            true,
        );
    }

    function blockShortcuts() {
        document.addEventListener(
            'keydown',
            function (event) {
                var key = (event.key || '').toLowerCase();
                if (
                    key === 'f12' ||
                    (event.ctrlKey &&
                        event.shiftKey &&
                        (key === 'i' || key === 'j' || key === 'c')) ||
                    (event.metaKey &&
                        event.altKey &&
                        (key === 'i' || key === 'j' || key === 'c')) ||
                    (event.ctrlKey && (key === 'u' || key === 's')) ||
                    (event.metaKey && key === 'u')
                ) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            },
            true,
        );
    }

    function watchDockedDevtools() {
        setInterval(function () {
            var widthGap = window.outerWidth - window.innerWidth;
            var heightGap = window.outerHeight - window.innerHeight;
            if (widthGap > DEVTOOLS_GAP || heightGap > DEVTOOLS_GAP) {
                onDevtoolsOpen();
            }
        }, 500);
    }

    function watchConsoleInspector() {
        var bait = new Image();
        Object.defineProperty(bait, 'id', {
            get: function () {
                onDevtoolsOpen();
            },
        });
        setInterval(function () {
            console.log('%c', bait);
        }, 1000);
    }

    function silenceConsole() {
        var noop = function () {};
        var methods = [
            'log',
            'debug',
            'info',
            'warn',
            'error',
            'table',
            'trace',
            'dir',
            'group',
            'groupCollapsed',
            'groupEnd',
            'clear',
        ];
        for (var i = 0; i < methods.length; i += 1) {
            try {
                console[methods[i]] = noop;
            } catch (e) {
                /* noop */
            }
        }
    }

    function antiDebuggerLoop() {
        setInterval(function () {
            (function () {}.constructor('debugger')());
        }, 50);
    }

    blockContextMenu();
    blockShortcuts();
    watchDockedDevtools();
    watchConsoleInspector();
    antiDebuggerLoop();
    silenceConsole();
})();
