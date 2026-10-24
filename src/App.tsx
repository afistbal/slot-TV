import {
    createBrowserRouter,
    matchPath,
    Navigate,
    Outlet,
    RouterProvider,
    useNavigate,
    useRouteError,
} from "react-router";
import { FormattedMessage, IntlProvider } from 'react-intl';
import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState, type ComponentType, type ErrorInfo, type ReactNode } from "react";
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
import usePixel from './hooks/usePixel';
import { syncAdAttributionCache } from './lib/adAttribution';
import { syncFbAttributionCache } from './lib/fbAttribution';
import { useWindowPathname } from './hooks/useWindowPathname';
import {
    describeChunkLoadError,
    isChunkLoadError,
    markAppBootReady,
    repairPwaAndReload,
    reloadAfterChunkLoadError,
} from './lib/pwaChunkRecovery';
import { loadMessagesForLocale, messagesForLocale, type TIntlMessages } from './lib/messagesForLocale';
import { ReelShortBasicsSpin } from "./components/ReelShortBasicsSpin";
import { PcLoginDialog } from './pages/user/Login';

import { isIosLikeDevice } from "./lib/isIosLikeDevice";
import { installUserRouteIntentPrefetch, scheduleSecondaryUserRoutesPrefetch } from "./lib/prefetchSecondaryUserRoutes";
import { BRAND_DISPLAY_NAME } from "./constants/brand";
import { syncLuckyPushSubscription } from './lib/luckyPushSubscription';

const YOGO_GROUP_IFRAME_SRC = 'https://mnby97.cc/assets/js/group.html?p=vE8hIfgY';

/** Chromium `beforeinstallprompt`（部分 TS lib 未声明）。 */
interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

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

function YogoGroupIframe({ enabled }: { enabled: boolean }) {
    if (!enabled) {
        return null;
    }

    return (
        <iframe
            src={YOGO_GROUP_IFRAME_SRC}
            title=""
            aria-hidden
            tabIndex={-1}
            style={{
                position: 'absolute',
                left: '-9999px',
                top: '-9999px',
                width: '1px',
                height: '1px',
                border: 0,
            }}
        />
    );
}

function RouteLazyFallback() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const timer = window.setTimeout(() => setVisible(true), 180);
        return () => window.clearTimeout(timer);
    }, []);

    if (!visible) return null;

    return (
        <div className="flex h-full min-h-0 w-full items-center justify-center bg-app-canvas" aria-live="polite">
            <ReelShortBasicsSpin visible variant="inline" withOverlay={false} />
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
const DramaDetail = lazy(() => import('./pages/user/DramaDetail'));
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
const CreatorProgram = lazy(() => import('./pages/user/CreatorProgram'));
const AffiliateProgram = lazy(() => import('./pages/user/AffiliateProgram'));
const Lucky = lazy(() => import('./pages/user/Lucky'));
const ForDemoPage = lazy(() => import('./pages/user/ForDemo'));
const VDemoPage = lazy(() => import('./pages/user/VDemo'));
const AdminWeeklyUpdateTable = lazy(() => import('./pages/admin/WeeklyUpdateTable'));
const NotFound = lazy(() => import('./pages/NotFound'));

function lazyRoute(Component: ComponentType, fallback: ReactNode = <RouteLazyFallback />) {
    return (
        <Suspense fallback={fallback}>
            <Component />
        </Suspense>
    );
}

function RequireAccountRoute({ children }: { children: ReactNode }) {
    const navigate = useNavigate();
    const sessionReady = useRootStore((state) => state.sessionBootstrapReady);
    const signed = useUserStore((state) => state.signed);
    const anonymous = useUserStore((state) => state.isAnonymous());

    if (!sessionReady) return <InitialBootPlaceholder />;
    if (signed && !anonymous) return children;

    return (
        <div className="fixed inset-0 bg-app-canvas">
            <PcLoginDialog
                open
                onLoginSuccess={() => undefined}
                onOpenChange={(next) => {
                    if (!next) navigate('/', { replace: true });
                }}
            />
        </div>
    );
}

function retryWithFreshDocument(): void {
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('_app_repair', String(Date.now()));
    window.location.replace(nextUrl.toString());
}

function ApplicationErrorView({ error }: { error: unknown }) {
    const errorText = describeChunkLoadError(error);
    const chunkLoadFailed = isChunkLoadError(error);
    const [recovering, setRecovering] = useState(chunkLoadFailed);
    const [repairing, setRepairing] = useState(false);
    const isChinese = /^zh(?:-|$)/i.test(navigator.language || '');

    useEffect(() => {
        if (chunkLoadFailed) {
            setRecovering(reloadAfterChunkLoadError(error));
            return;
        }
        report(errorText);
    }, [chunkLoadFailed, error, errorText]);

    if (recovering) {
        return <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black px-6 text-white">
            <div className="max-w-sm text-center" role="status" aria-live="polite">
                <LoaderCircle className="mx-auto mb-5 h-8 w-8 animate-spin" />
                <h1 className="text-xl font-semibold">
                    {isChinese ? '正在更新应用' : 'Updating the app'}
                </h1>
                <p className="mt-2 text-sm text-white/70">
                    {isChinese ? '马上就好，请稍候。' : 'This should only take a moment.'}
                </p>
            </div>
        </div>;
    }

    const handleRepair = async () => {
        if (repairing) return;
        setRepairing(true);
        await repairPwaAndReload();
    };

    return <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black px-6 text-white">
        <div className="w-full max-w-sm text-center" role="alert">
            <h1 className="text-xl font-semibold">
                {isChinese ? '应用暂时无法加载' : 'The app could not be loaded'}
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/70">
                {navigator.onLine
                    ? (isChinese ? '请重试；如果问题仍然存在，可以修复应用缓存。' : 'Try again. If the problem continues, repair the app cache.')
                    : (isChinese ? '请检查网络连接，恢复后再重试。' : 'Check your connection, then try again.')}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                    type="button"
                    onClick={retryWithFreshDocument}
                    className="min-h-11 rounded-full bg-white px-6 font-semibold text-black"
                >
                    {isChinese ? '重试' : 'Try again'}
                </button>
                <button
                    type="button"
                    disabled={repairing}
                    onClick={() => void handleRepair()}
                    className="min-h-11 rounded-full border border-white/35 px-6 font-semibold text-white disabled:opacity-50"
                >
                    {repairing
                        ? (isChinese ? '正在修复…' : 'Repairing…')
                        : (isChinese ? '修复应用' : 'Repair app')}
                </button>
            </div>
            {import.meta.env.DEV ? (
                <pre className="mt-6 max-h-40 overflow-auto whitespace-pre-wrap text-left text-xs text-white/50">
                    {errorText}
                </pre>
            ) : null}
        </div>
    </div>;
}

function RouteErrorBoundary() {
    return <ApplicationErrorView error={useRouteError()} />;
}

interface RootErrorBoundaryState {
    error: unknown;
    hasError: boolean;
}

export class RootErrorBoundary extends Component<{ children: ReactNode }, RootErrorBoundaryState> {
    state: RootErrorBoundaryState = { error: null, hasError: false };

    static getDerivedStateFromError(error: unknown): RootErrorBoundaryState {
        return { error, hasError: true };
    }

    componentDidCatch(error: unknown, info: ErrorInfo): void {
        markAppBootReady();
        if (import.meta.env.DEV) {
            console.error('Uncaught application error', error, info.componentStack);
        }
    }

    render() {
        if (this.state.hasError) {
            return <ApplicationErrorView error={this.state.error} />;
        }
        return this.props.children;
    }
}

const router = createBrowserRouter([
    {
        path: '/',
        element: lazyRoute(LayoutUser),
        errorElement: <RouteErrorBoundary />,
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
                path: 'drama/:id',
                element: lazyRoute(DramaDetail),
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
                element: <RequireAccountRoute>{lazyRoute(UserRadixRc)}</RequireAccountRoute>,
            },
            {
                path: ':locale/shopping',
                element: <RequireAccountRoute>{lazyRoute(UserRadixRc)}</RequireAccountRoute>,
            },
            {
                path: 'my-list',
                element: <RequireAccountRoute>{lazyRoute(UserMyList)}</RequireAccountRoute>,
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
                path: 'creator',
                /** 创作者入口保留当前页面壳，分包下载期间不再显示居中的“载入中”占位框。 */
                element: <RequireAccountRoute>{lazyRoute(CreatorProgram, null)}</RequireAccountRoute>,
            },
            {
                path: 'affiliate',
                element: <RequireAccountRoute>{lazyRoute(AffiliateProgram)}</RequireAccountRoute>,
            },
            {
                path: 'lucky',
                element: <RequireAccountRoute>{lazyRoute(Lucky)}</RequireAccountRoute>,
            },
            {
                path: ':locale/lucky',
                element: <RequireAccountRoute>{lazyRoute(Lucky)}</RequireAccountRoute>,
            },
            {
                path: 'wallet',
                element: <RequireAccountRoute>{lazyRoute(UserWallet)}</RequireAccountRoute>,
            },
            {
                path: ':locale/wallet',
                element: <RequireAccountRoute>{lazyRoute(UserWallet)}</RequireAccountRoute>,
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
        errorElement: <RouteErrorBoundary />,
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
                element: <RequireAccountRoute>{lazyRoute(UserSearch)}</RequireAccountRoute>,
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

function AppContent() {
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

    useEffect(() => {
        markAppBootReady();
        return installUserRouteIntentPrefetch();
    }, []);

    useEffect(() => {
        if (!checked || !sessionBootstrapReady || !localStorage.getItem('token')) return;

        let cancelled = false;
        const syncPush = () => {
            if (cancelled || !navigator.onLine) return;
            void syncLuckyPushSubscription().catch(() => undefined);
        };

        syncPush();
        window.addEventListener('yogo:push-subscription-changed', syncPush);
        window.addEventListener('online', syncPush);
        return () => {
            cancelled = true;
            window.removeEventListener('yogo:push-subscription-changed', syncPush);
            window.removeEventListener('online', syncPush);
        };
    }, [checked, sessionBootstrapReady]);

    const trackDownloadOnce = useCallback(() => {
        if (downloadTrackedRef.current) return;
        downloadTrackedRef.current = true;
        pixel.track('Download');
    }, [pixel]);

    async function handleExecuteInstall() {
        const promptEvent = installPrompt.current;
        if (!promptEvent) return;
        await promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        installPrompt.current = null;
        setInstall(0);
        if (outcome === 'accepted') {
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
        if (!checked) return;
        const code = new URLSearchParams(window.location.search).get('ref')?.trim();
        if (!code || code === 'PREVIEW') return;
        localStorage.setItem('affiliate-referral-code', code);
    }, [checked, pathname]);

    useEffect(() => {
        document.body.style.direction = 'ltr';
    }, []);

    useEffect(() => {
        const listener = (event: Event) => {
            const promptEvent = event as BeforeInstallPromptEvent;
            promptEvent.preventDefault();
            installPrompt.current = promptEvent;
            setInstall(1);
        };
        const installedListener = () => {
            installPrompt.current = null;
            setInstall(0);
            trackDownloadOnce();
        };

        window.addEventListener('beforeinstallprompt', listener);
        window.addEventListener('appinstalled', installedListener);
        return () => {
            window.removeEventListener('beforeinstallprompt', listener);
            window.removeEventListener('appinstalled', installedListener);
        };
    }, [trackDownloadOnce]);

    useEffect(() => {
        const legacyDesktopCss = document.head.querySelector('#desktop-css');
        if (legacyDesktopCss?.parentNode) {
            legacyDesktopCss.parentNode.removeChild(legacyDesktopCss);
        }
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

        const ALIVE_WATCH_SECONDS = 30;
        const SAMPLE_INTERVAL_MS = 1000;
        let watchedSeconds = 0;
        let lastSampleAt = performance.now();
        let lastVideoTimes = new WeakMap<HTMLVideoElement, number>();

        const pingAlive = () => {
            void api('alive', {
                method: 'post',
                loading: false,
                toastOnError: false,
            });
        };

        const isVisiblePlayingVideo = (video: HTMLVideoElement) => {
            if (video.paused || video.ended || video.seeking || video.playbackRate <= 0
                || video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) return false;
            const nativeVideo = video as HTMLVideoElement & { webkitDisplayingFullscreen?: boolean };
            if (document.pictureInPictureElement === video || document.fullscreenElement === video
                || nativeVideo.webkitDisplayingFullscreen === true) return true;
            const style = window.getComputedStyle(video);
            if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
            const rect = video.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0
                && rect.left < window.innerWidth && rect.top < window.innerHeight;
        };

        const sampleWatchTime = () => {
            const now = performance.now();
            // Do not let a throttled/background timer turn a long gap into watch time.
            const elapsedSeconds = Math.min((now - lastSampleAt) / 1000, SAMPLE_INTERVAL_MS / 1000 * 1.5);
            lastSampleAt = now;
            if (document.visibilityState !== 'visible') return;

            let videoAdvanced = false;
            for (const video of document.querySelectorAll<HTMLVideoElement>('video')) {
                if (!isVisiblePlayingVideo(video)) continue;
                const currentTime = video.currentTime;
                const previousTime = lastVideoTimes.get(video);
                lastVideoTimes.set(video, currentTime);
                if (previousTime !== undefined && currentTime > previousTime) videoAdvanced = true;
            }

            if (!videoAdvanced) return;
            watchedSeconds += elapsedSeconds;
            if (watchedSeconds < ALIVE_WATCH_SECONDS) return;
            watchedSeconds -= ALIVE_WATCH_SECONDS;
            pingAlive();
        };

        const handleVisibilityChange = () => {
            lastSampleAt = performance.now();
            lastVideoTimes = new WeakMap<HTMLVideoElement, number>();
        };

        const aliveTimer = window.setInterval(sampleWatchTime, SAMPLE_INTERVAL_MS);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.clearInterval(aliveTimer);
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
    const isImmersivePlayerPath =
        matchPath({ path: '/video/:id/:episode?', end: true }, pathname) != null ||
        matchPath({ path: '/foryou', end: true }, pathname) != null ||
        matchPath({ path: '/for-you', end: true }, pathname) != null;
    const showInstallPrompt =
        install > 0 &&
        import.meta.env.VITE_PLATFORM !== 'tiktok' &&
        !isIosLikeDevice() &&
        !isShoppingRoute &&
        !isImmersivePlayerPath;
    const showYogoGroupIframe =
        BRAND_DISPLAY_NAME === 'YogoShort' &&
        configStore.config['ios_iframe'] === true;

    useEffect(() => {
        if (rootShowInstallPrompt !== showInstallPrompt) {
            setRootShowInstallPrompt(showInstallPrompt);
        }
    }, [rootShowInstallPrompt, setRootShowInstallPrompt, showInstallPrompt]);

    return <IntlProvider locale={rootStore.locale} messages={messages} defaultLocale="zh-CN">
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
            <YogoGroupIframe enabled={showYogoGroupIframe} />
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

function App() {
    return <AppContent />;
}

export default App;
