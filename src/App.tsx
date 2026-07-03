import {
    createBrowserRouter,
    matchPath,
    Navigate,
    Outlet,
    RouterProvider,
    useRouteError,
} from "react-router";
import { FormattedMessage, IntlProvider } from 'react-intl';
import { lazy, Suspense, useEffect, useRef, useState, type ComponentType } from "react";
import { Toaster } from "./components/ui/sonner";
import { useLoadingStore } from "./stores/loading";
import { LoaderCircle } from "lucide-react";
import { createPortal } from "react-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "./components/ui/dialog";
import { api, report, type TData } from "./api";
import { loginAnonymous } from "./lib/anonymousLogin";
import { getOrCreateDeviceUuid } from "./lib/browserFingerprint";
import { refreshSessionFromStoredToken } from "./lib/refreshSessionFromStoredToken";
import { useUserStore } from "./stores/user";
import { useConfigStore } from "./stores/config";
import { useRootStore } from "./stores/root";
import { cn } from "./lib/utils";
import { Button } from "./components/ui/button";
import { useConfirmStore } from "./stores/confirm";
import { toast } from "sonner";
import { init as initPixel, trackAnonymousCompleteRegistration } from './hooks/usePixel';
import { syncAdAttributionCache } from './lib/adAttribution';
import { syncFbAttributionCache } from './lib/fbAttribution';
import usePixel from './hooks/usePixel';
import { describeChunkLoadError, reloadAfterChunkLoadError } from './lib/pwaChunkRecovery';
import { useWindowPathname } from './hooks/useWindowPathname';
import { loadMessagesForLocale, messagesForLocale, type TIntlMessages } from './lib/messagesForLocale';
import { ReelShortBasicsSpin } from "./components/ReelShortBasicsSpin";

import { isIosLikeDevice } from "./lib/isIosLikeDevice";
import { scheduleSecondaryUserRoutesPrefetch } from "./lib/prefetchSecondaryUserRoutes";

/** 旧书签 `/page/checkout/:id`、已废弃的整页收银 → 购物页 */
function LegacyCheckoutToShoppingRedirect() {
    return <Navigate to="/shopping" replace />;
}

/** `/`、`/search`、`/categories`、`/tagSearch` 实际内容由 `layouts/user` 内 keep-alive 层渲染；此处仅占位以维持路由匹配 */
function LayoutUserPrimaryTabPlaceholder() {
    return null;
}

/** `config` 未完成前：与首页壳同色、无转圈，避免与首页内二次 loading 叠体感 */
function InitialBootPlaceholder() {
    return <div className="fixed inset-0 z-10 min-h-0 bg-app-canvas" aria-hidden />;
}

function RouteLazyFallback() {
    return (
        <div className="fixed inset-0 z-[9998] min-h-0 bg-app-canvas">
            <ReelShortBasicsSpin visible variant="modal" withOverlay={false} />
        </div>
    );
}

const LayoutUser = lazy(() => import('./layouts/user'));
const ShareToVideoRedirect = lazy(() => import('./pages/user/ShareToVideoRedirect'));
const UserMyList = lazy(() => import('./pages/user/MyList'));
const UserFavorite = lazy(() => import('./pages/user/Favorite'));
const UserHistory = lazy(() => import('./pages/user/History'));
const UserProfile = lazy(() => import('./pages/user/Profile'));
const UserShelf = lazy(() => import('./pages/user/Shelf'));
const UserEpisodes = lazy(() => import('./pages/user/Episodes'));
const UserFeedback = lazy(() => import('./pages/user/Feedback'));
const UserLanguage = lazy(() => import('./pages/user/Language'));
const UserAbout = lazy(() => import('./pages/user/About'));
const UserText = lazy(() => import('./pages/user/Text'));
const UserLogin = lazy(() => import('./pages/user/Login'));
const UserPay = lazy(() => import('./pages/user/Pay'));
const UserSearch = lazy(() => import('./pages/user/Search'));
const UserMyBalance = lazy(() => import('./pages/user/MyBanlance'));
const UserWallet = lazy(() => import('./pages/user/Wallet'));
const UserDetail = lazy(() => import('./pages/user/UserDetail'));
const UserRadixRc = lazy(() => import('./pages/user/RadixRc'));
const UserIosAddHomeGuide = lazy(() => import('./pages/user/IosAddHomeGuide'));
const ForDemoPage = lazy(() => import('./pages/user/ForDemo'));
const VDemoPage = lazy(() => import('./pages/user/VDemo'));
const AdminWeeklyUpdateTable = lazy(() => import('./pages/admin/WeeklyUpdateTable'));
const NotFound = lazy(() => import('./pages/NotFound'));

function lazyRoute(Component: ComponentType) {
    return (
        <Suspense fallback={<RouteLazyFallback />}>
            <Component />
        </Suspense>
    );
}

/** Chromium `beforeinstallprompt`（部分 TS lib 未声明） */
interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function ErrorBoundary() {
    const error = useRouteError();
    const errorText = describeChunkLoadError(error);

    useEffect(() => {
        report(errorText);
        reloadAfterChunkLoadError(error);
    }, [error, errorText]);

    return <div className="p-4 w-full">
        <h1 className="text-2xl">Oops! Something went wrong.</h1>
        <pre className="mt-4 select-all whitespace-pre-wrap">
            {errorText}
        </pre>
        <div className="flex justify-center mt-4">
            <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-md bg-red-400 text-white cursor-pointer">Reload</button>
        </div>
    </div>;
}

const router = createBrowserRouter([
    {
        path: '/',
        element: lazyRoute(LayoutUser),
        errorElement: <ErrorBoundary />,
        children: [
            {
                index: true,
                element: <LayoutUserPrimaryTabPlaceholder />,
            },
            {
                path: 'categories',
                element: <LayoutUserPrimaryTabPlaceholder />,
            },
            {
                path: ':locale/categories',
                element: <LayoutUserPrimaryTabPlaceholder />,
            },
            {
                path: 'search',
                element: <LayoutUserPrimaryTabPlaceholder />,
            },
            {
                path: ':locale/search',
                element: <LayoutUserPrimaryTabPlaceholder />,
            },
            {
                path: 'tagSearch',
                element: <LayoutUserPrimaryTabPlaceholder />,
            },
            {
                path: ':locale/tagSearch',
                element: <LayoutUserPrimaryTabPlaceholder />,
            },
            {
                path: 'shelf/:slug',
                element: lazyRoute(UserShelf),
            },
            {
                path: ':locale/shelf/:slug',
                element: lazyRoute(UserShelf),
            },
            {
                path: 'shelf/:slug/:page',
                element: lazyRoute(UserShelf),
            },
            {
                path: ':locale/shelf/:slug/:page',
                element: lazyRoute(UserShelf),
            },
            {
                path: 'episodes/:slug',
                element: lazyRoute(UserEpisodes),
            },
            {
                path: ':locale/episodes/:slug',
                element: lazyRoute(UserEpisodes),
            },
            {
                path: 'shopping',
                element: lazyRoute(UserRadixRc),
            },
            {
                path: ':locale/shopping',
                element: lazyRoute(UserRadixRc),
            },
            {
                path: 'my-list',
                element: lazyRoute(UserMyList),
                children: [
                    {
                        index: true,
                        element: lazyRoute(UserFavorite),
                    },
                    {
                        path: 'history',
                        element: lazyRoute(UserHistory),
                    },
                ]
            },
            {
                path: 'profile',
                element: lazyRoute(UserProfile),
            },
            {
                path: 'wallet',
                element: lazyRoute(UserWallet),
            },
            {
                path: ':locale/wallet',
                element: lazyRoute(UserWallet),
            },
            {
                path: 'user/detail',
                element: lazyRoute(UserDetail),
            },
            {
                path: 'radix-rc',
                element: <Navigate to="/shopping" replace />,
            },
            /** 须挂在 LayoutUser 下：否则整页离开用户壳子，首页/搜索的 keep-alive 会随 Layout 卸载 */
            {
                path: 'video/:id/:episode?',
                element: lazyRoute(VDemoPage),
            },
            {
                path: 'share/:id',
                element: lazyRoute(ShareToVideoRedirect),
            },
            {
                path: 'foryou',
                element: lazyRoute(ForDemoPage),
            },
            {
                path: 'for-demo',
                element: <Navigate to="/foryou" replace />,
            },
            {
                path: 'v-demo/:id/:episode?',
                element: lazyRoute(VDemoPage),
            },
            {
                path: 'for-you',
                element: <Navigate to="/foryou" replace />,
            },
        ],
    },
    {
        path: '/page',
        element: <Outlet />,
        errorElement: <ErrorBoundary />,
        children: [
            /** 仅访问 `/page` 无子路径时 Outlet 为空会黑屏；落到首页 */
            {
                index: true,
                element: <Navigate to="/" replace />,
            },
            {
                path: 'feedback',
                element: lazyRoute(UserFeedback),
            },
            {
                path: 'language',
                element: lazyRoute(UserLanguage),
            },
            {
                path: 'about',
                element: lazyRoute(UserAbout),
            },
            {
                path: 'text',
                element: lazyRoute(UserText),
            },
            {
                path: 'login',
                element: lazyRoute(UserLogin),
            },
            {
                path: 'ios-add-home',
                element: lazyRoute(UserIosAddHomeGuide),
            },
            {
                path: 'pay/:id',
                element: <Navigate to="/shopping" replace />,
            },
            {
                path: 'pay',
                element: lazyRoute(UserPay),
            },
            {
                path: 'checkout/:id',
                element: <LegacyCheckoutToShoppingRedirect />,
            },
            {
                path: 'search',
                element: lazyRoute(UserSearch),
            },
            {
                path: 'my-balance',
                element: lazyRoute(UserMyBalance),
            },
            {
                path: 'week-data',
                element: lazyRoute(AdminWeeklyUpdateTable),
            },
        ],
    },
    {
        path: '*',
        element: lazyRoute(NotFound),
    },
]);

/** 避免 IntlProvider 首屏 messages 为 undefined */
function getInitialIntlMessages(): TIntlMessages {
    return messagesForLocale(useRootStore.getState().locale);
}

function App() {
    const pixel = usePixel();
    const pathname = useWindowPathname();
    const rootStore = useRootStore();
    const rootShowInstallPrompt = useRootStore((state) => state.showInstallPrompt);
    const setRootShowInstallPrompt = useRootStore((state) => state.setShowInstallPrompt);
    const sessionBootstrapReady = useRootStore((state) => state.sessionBootstrapReady);
    const configStore = useConfigStore();
    const loadingStore = useLoadingStore();
    const confirmStore = useConfirmStore();
    const installPrompt = useRef<BeforeInstallPromptEvent | null>(null);
    const [checked, setChecked] = useState(false);
    const [install, setInstall] = useState(0);
    const [messages, setMessages] = useState<TIntlMessages>(getInitialIntlMessages);
    const downloadTrackedRef = useRef(false);
    /** 避免 StrictMode 双调用时旧 `loadData` 回写 config / 抢跑会话 */
    const loadDataGenerationRef = useRef(0);
    const secondaryPrefetchScheduledRef = useRef(false);

    function trackDownloadOnce() {
        if (downloadTrackedRef.current) {
            return;
        }
        downloadTrackedRef.current = true;
        pixel.track('Download');
    }

    async function handleExecuteInstall() {
        if (!installPrompt.current) {
            return;
        }
        installPrompt.current.prompt();
        const { outcome } = await installPrompt.current.userChoice;
        if (outcome === 'accepted') {
            setInstall(2);
            trackDownloadOnce();
        }
    }

    async function loadData() {
        const loadGen = ++loadDataGenerationRef.current;
        const query = new URLSearchParams(window.location.search);
        useRootStore.getState().setSessionBootstrapReady(false);

        /** 设备号尽早写入 localStorage，与 token 一样本地持久化 */
        getOrCreateDeviceUuid();
        syncAdAttributionCache();

        const tokenFromQuery = query.get('_token');
        if (tokenFromQuery) {
            localStorage.setItem('token', tokenFromQuery);
        }
        const token = tokenFromQuery || localStorage.getItem('token');

        /** 与会话接口不依赖 `config` 响应体，与 `config` 并行可显著缩短首屏可交互前总等待 */
        void (async () => {
            try {
                if (token) {
                    const ok = await refreshSessionFromStoredToken();
                    if (loadGen !== loadDataGenerationRef.current) {
                        return;
                    }
                    if (ok) {
                        useRootStore.getState().setSessionBootstrapReady(true);
                        return;
                    }
                    localStorage.removeItem('token');
                    const anon = await loginAnonymous({ toastOnError: false });
                    if (loadGen !== loadDataGenerationRef.current) {
                        return;
                    }
                    if (anon.c !== 0) {
                        return;
                    }
                    localStorage.setItem('token', anon.d['token'] as string);
                    useUserStore.getState().signin(anon.d['info'] as TData);
                    useRootStore.getState().setSessionBootstrapReady(true);
                    trackAnonymousCompleteRegistration();
                    return;
                }
                localStorage.removeItem('token');
                const anon = await loginAnonymous({ toastOnError: false });
                if (loadGen !== loadDataGenerationRef.current) {
                    return;
                }
                if (anon.c !== 0) {
                    return;
                }
                localStorage.setItem('token', anon.d['token'] as string);
                useUserStore.getState().signin(anon.d['info'] as TData);
                useRootStore.getState().setSessionBootstrapReady(true);
                trackAnonymousCompleteRegistration();
            } catch {
                /* 会话失败时保持 sessionBootstrapReady=false */
            }
        })();

        const config = await api<TData>('config', {
            loading: false,
        });

        if (loadGen !== loadDataGenerationRef.current) {
            return;
        }

        if (config.c !== 0) {
            toast.error('Initialization failed 1');
            useRootStore.getState().setSessionBootstrapReady(false);
            return;
        }

        configStore.setConfig(config.d);

        // Adjust is not connected for the current H5 flow. Keep the SDK disabled here;
        // restore this init block when Adjust attribution is officially needed again.

        syncFbAttributionCache();
        syncAdAttributionCache();
        setChecked(true);
        void initPixel(config.d);

        // auth.authStateReady().then(() => {
        //     userStore.update({
        //         avatar: auth.currentUser?.photoURL,
        //         name: auth.currentUser?.displayName,
        //     });
        // });
    }

    useEffect(() => {
        const query = new URLSearchParams(window.location.search);
        const t = query.get('_t') ?? '';
        const s = query.get('s') ?? '';
        if (t !== '') {
            localStorage.setItem('test', t);
        }
        if (s !== '') {
            localStorage.setItem('source', s);
        }
        // 关键：有些后端会按 X-Source/X-Test 做分流/开关；直接访问 /search 时若为空，可能返回空 tags。
        // 老站通常通过落地页/投放链接把 s/_t 带进来；这里补一个兜底，保证请求头稳定有值。
        if (!localStorage.getItem('source')) {
            localStorage.setItem('source', window.location.hostname || 'web');
        }
        if (!localStorage.getItem('test')) {
            localStorage.setItem('test', '');
        }
        syncFbAttributionCache();
        syncAdAttributionCache();
        loadData();

    }, []);

    useEffect(() => {
        if (rootStore.locale === 'ar') {
            document.body.style.direction = 'rtl';
        } else {
            document.body.style.direction = 'ltr';
        }
    }, []);

    useEffect(() => {
        const legacyDesktopCss = document.head.querySelector('#desktop-css');
        if (legacyDesktopCss?.parentNode) {
            legacyDesktopCss.parentNode.removeChild(legacyDesktopCss);
        }
    }, []);

    useEffect(() => {

        const listener = (event: Event) => {
            const e = event as BeforeInstallPromptEvent;
            e.preventDefault();
            installPrompt.current = e;
            setInstall(1);
        };

        window.addEventListener('beforeinstallprompt', listener);

        const installedListener = () => {
            setInstall(0);
            trackDownloadOnce();
        };

        window.addEventListener('appinstalled', installedListener);

        return () => {
            window.removeEventListener('beforeinstallprompt', listener);
            window.removeEventListener('appinstalled', installedListener);
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        void loadMessagesForLocale(rootStore.locale).then((nextMessages) => {
            if (!cancelled) {
                setMessages(nextMessages);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [rootStore.locale]);

    const skipSecondaryRoutePrefetch =
        matchPath({ path: '/video/:id/:episode?', end: true }, pathname) != null ||
        matchPath({ path: '/foryou', end: true }, pathname) != null ||
        matchPath({ path: '/for-you', end: true }, pathname) != null;

    useEffect(() => {
        /** `checked` 仅表示 config 已就绪；`stat`/`alive` 需带有效 token，须等会话 bootstrap */
        if (!checked || !sessionBootstrapReady) {
            return;
        }
        api('stat', {
            method: 'post',
            data: {
                action: 'load_duration',
                target: 0,
                remark: (((new Date()).getTime() - performance.timeOrigin) / 1000).toFixed(3),
            },
            loading: false,
        });

        let aliveTimer: number | undefined;

        const pingAlive = () => {
            api('alive', {
                method: 'post',
                loading: false,
            });
        };

        const startAlivePolling = () => {
            if (aliveTimer !== undefined) {
                return;
            }
            pingAlive();
            aliveTimer = window.setInterval(pingAlive, 30000);
        };

        const stopAlivePolling = () => {
            if (aliveTimer === undefined) {
                return;
            }
            window.clearInterval(aliveTimer);
            aliveTimer = undefined;
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                startAlivePolling();
            } else {
                stopAlivePolling();
            }
        };

        if (document.visibilityState === 'visible') {
            startAlivePolling();
        }

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            stopAlivePolling();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [checked, sessionBootstrapReady]);

    useEffect(() => {
        if (!checked || !sessionBootstrapReady) {
            return;
        }
        if (skipSecondaryRoutePrefetch) {
            return;
        }
        if (secondaryPrefetchScheduledRef.current) {
            return;
        }
        secondaryPrefetchScheduledRef.current = true;
        scheduleSecondaryUserRoutesPrefetch();
    }, [checked, sessionBootstrapReady, skipSecondaryRoutePrefetch]);

    useEffect(() => {
        if (!checked || !sessionBootstrapReady) {
            return;
        }
        const query = new URLSearchParams(window.location.search);
        const source = query.get('s');
        if (!source) {
            return;
        }
        api('stat', {
            method: 'post',
            data: {
                action: 'source',
            },
            loading: false,
        });

    }, [checked, sessionBootstrapReady]);

    const appPathSegments = pathname.toLowerCase().split('/').filter(Boolean);
    const isShoppingRoute = appPathSegments[appPathSegments.length - 1] === 'shopping';
    /** 全屏竖滑播放：勿挡底部控制条（与 `layouts/user` 中隐藏 iOS 胶囊条一致） */
    const isImmersivePlayerPath =
        matchPath({ path: '/video/:id/:episode?', end: true }, pathname) != null ||
        matchPath({ path: '/foryou', end: true }, pathname) != null ||
        matchPath({ path: '/for-you', end: true }, pathname) != null;
    // 仅在 iOS/iPad 隐藏 Chromium 安装入口；Mac 桌面允许展示并触发 PWA 安装
    const showInstallPrompt =
        install > 0 && !isIosLikeDevice() && !isShoppingRoute && !isImmersivePlayerPath;
    useEffect(() => {
        if (rootShowInstallPrompt !== showInstallPrompt) {
            setRootShowInstallPrompt(showInstallPrompt);
        }
    }, [rootShowInstallPrompt, setRootShowInstallPrompt, showInstallPrompt]);

    return <IntlProvider locale={rootStore.locale} messages={messages} defaultLocale="en">
        <div
            className={cn('root', `root-${rootStore.theme}`)}
        >
            {showInstallPrompt ? (
                <button
                    type="button"
                    className="pwa-install-open-btn fixed top-0 left-0 h-px w-px overflow-hidden opacity-0"
                    tabIndex={-1}
                    aria-hidden
                    onClick={handleExecuteInstall}
                />
            ) : null}
            {checked ? <RouterProvider router={router} /> : <InitialBootPlaceholder />}
        </div>
        <Dialog
            open={loadingStore.status}
            onOpenChange={(next) => {
                if (!next) {
                    loadingStore.hide();
                }
            }}
        >
            <DialogContent className="bg-transparent [&>button]:hidden flex flex-col justify-center items-center shadow-none outline-none" aria-describedby={undefined}>
                <DialogTitle className="hidden">loading</DialogTitle>
                <div className="w-16 h-16 flex items-center justify-center animate-[spin_1.5s_ease_infinite]">
                    <LoaderCircle className="text-white w-8 h-8" />
                </div>
            </DialogContent>
        </Dialog>
        {createPortal(<>
            <Dialog open={confirmStore.open} onOpenChange={() => confirmStore.cancel()}>
                <DialogContent>
                    <DialogTitle>
                        <FormattedMessage id="confirm" />
                    </DialogTitle>
                    <DialogDescription>
                        <FormattedMessage id="confirm_description" />
                    </DialogDescription>
                    <DialogFooter>
                        <Button className="bg-[#94a3b8] flex-1" onClick={confirmStore.cancel}>
                            <FormattedMessage id="cancel" />
                        </Button>
                        <Button className="flex-1" onClick={confirmStore.ok}>
                            <FormattedMessage id="ok" />
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Toaster position="top-center" />
        </>, document.body)}
    </IntlProvider>
}

export default App;
