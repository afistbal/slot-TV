import { createBrowserRouter, Navigate, RouterProvider, useRouteError } from "react-router"
import { FormattedMessage, IntlProvider } from 'react-intl';
import { useEffect, useRef, useState } from "react";
import { Toaster } from "./components/ui/sonner";
import { useLoadingStore } from "./stores/loading";
import { LoaderCircle } from "lucide-react";
import { createPortal } from "react-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "./components/ui/dialog";
import { api, report, type TData } from "./api";
import { useUserStore } from "./stores/user";
import { useConfigStore } from "./stores/config";
import isMobile from 'is-mobile';
import { useRootStore } from "./stores/root";
import { cn } from "./lib/utils";
import { Button } from "./components/ui/button";
import { useConfirmStore } from "./stores/confirm";
import { toast } from "sonner";
import Adjust from '@adjustcom/adjust-web-sdk';
import {init as initPixel} from './hooks/usePixel';
import enMessages from './locales/en.json';
import zhMessages from './locales/zh.json';

import LayoutUser from './layouts/user';
import UserHome from './pages/user/Home';
import UserMyList from './pages/user/MyList';
import UserFavorite from './pages/user/Favorite';
import UserHistory from './pages/user/History';
import UserProfile from './pages/user/Profile';
import UserVideo from './pages/user/Video';
import UserAirwallex from './pages/user/Airwallex';
import UserTest from './pages/user/Test';
import UserShelf from './pages/user/Shelf';
import UserEpisodes from './pages/user/Episodes';

import UserFeedback from './pages/user/Feedback';
import UserLanguage from './pages/user/Language';
import UserAbout from './pages/user/About';
import UserText from './pages/user/Text';
import UserLogin from './pages/user/Login';
import UserPay from './pages/user/Pay';
import UserMembership from './pages/user/Membership';
import UserSearch from './pages/user/Search';
import UserMyBalance from './pages/user/MyBanlance';
import UserDetail from './pages/user/UserDetail';
import UserRadixRc from './pages/user/RadixRc';

import LayoutAdmin from './layouts/admin';
import AdminHome from './pages/admin/Home';
import AdminManagement from './pages/admin/Management';
import AdminMovieDetail from './pages/admin/MovieDetail';
import AdminMagnet from './pages/admin/Magnet';
import AdminMovie from './pages/admin/Movie';
import AdminUser from './pages/admin/User';
import AdminUserDetail from './pages/admin/UserDetail';
import AdminSettings from './pages/admin/Settings';
import AdminAnalysis from './pages/admin/Analysis';
import AdminOrders from './pages/admin/Order';
import AdminOrderDetail from './pages/admin/OrderDetail';
import AdminActivityLog from './pages/admin/ActivityLog';
import Loader from "./components/Loader";
import NotFound from './pages/NotFound';

/** config/登录完成前全屏占位 */
function InitialBootLoading() {
    return (
        <div className="fixed inset-0 z-10 flex bg-app-canvas">
            <Loader color="light" />
        </div>
    );
}

/** Chromium `beforeinstallprompt`（部分 TS lib 未声明） */
interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function ErrorBoundary() {
    const error = useRouteError();

    useEffect(() => {
        report(JSON.stringify(error));
    }, []);

    return <div className="p-4 w-full">
        <h1 className="text-2xl">Oops! Something went wrong.</h1>
        <pre className="mt-4 select-all whitespace-pre-wrap">
            {JSON.stringify(error, null, 2)}
        </pre>
        <div className="flex justify-center mt-4">
            <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-md bg-red-400 text-white cursor-pointer">Reload</button>
        </div>
    </div>;
}

const router = createBrowserRouter([
    {
        path: '/',
        element: <LayoutUser />,
        errorElement: <ErrorBoundary />,
        children: [
            {
                index: true,
                element: <UserHome />,
            },
            {
                path: 'search',
                element: <UserSearch />,
            },
            {
                path: ':locale/search',
                element: <UserSearch />,
            },
            {
                path: 'shelf/:slug',
                element: <UserShelf />,
            },
            {
                path: ':locale/shelf/:slug',
                element: <UserShelf />,
            },
            {
                path: 'shelf/:slug/:page',
                element: <UserShelf />,
            },
            {
                path: ':locale/shelf/:slug/:page',
                element: <UserShelf />,
            },
            {
                path: 'episodes/:slug',
                element: <UserEpisodes />,
            },
            {
                path: ':locale/episodes/:slug',
                element: <UserEpisodes />,
            },
            {
                path: 'shopping',
                element: <UserRadixRc />,
            },
            {
                path: ':locale/shopping',
                element: <UserRadixRc />,
            },
            {
                path: 'my-list',
                element: <UserMyList />,
                children: [
                    {
                        index: true,
                        element: <UserFavorite />,
                    },
                    {
                        path: 'history',
                        element: <UserHistory />,
                    },
                ]
            },
            {
                path: 'profile',
                element: <UserProfile />,
            },
            {
                path: 'user/detail',
                element: <UserDetail />,
            },
            {
                path: 'radix-rc',
                element: <Navigate to="/shopping" replace />,
            },

        ],
    },
    {
        path: '/',
        errorElement: <ErrorBoundary />,
        children: [
            {
                path: 'video/:id/:index?',
                element: <UserVideo />,
            },
            {
                path: 'airwallex/:id',
                element: <UserAirwallex />,
            },
            {
                path: 'test',
                element: <UserTest />,
            },
        ],
    },
    {
        path: '/page',
        errorElement: <ErrorBoundary />,
        children: [
            {
                path: 'feedback',
                element: <UserFeedback />,
            },
            {
                path: 'language',
                element: <UserLanguage />,
            },
            {
                path: 'about',
                element: <UserAbout />,
            },
            {
                path: 'text',
                element: <UserText />,
            },
            {
                path: 'login',
                element: <UserLogin />,
            },
            {
                path: 'pay',
                element: <UserPay />,
            },
            {
                path: 'membership',
                element: <UserMembership />,
            },
            {
                path: 'search',
                element: <UserSearch />,
            },
            {
                path: 'my-balance',
                element: <UserMyBalance />,
            },
        ],
    },
    {
        path: '/z',
        element:
            <LayoutAdmin />
        ,
        errorElement: <ErrorBoundary />,
        children: [
            {
                index: true,
                element:
                    <AdminHome />
                ,
            },
            {
                path: 'management',
                element:
                    <AdminManagement />
                ,
            },
        ],
    },
    {
        path: '/z/page',
        errorElement: <ErrorBoundary />,
        children: [
            {
                path: 'movie',
                element:
                    <AdminMovie />
                ,
            },
            {
                path: 'movie/detail/:id?',
                element:
                    <AdminMovieDetail />
                ,
            },
            {
                path: 'magnet',
                element:
                    <AdminMagnet />
                ,
            },
            {
                path: 'user',
                element:
                    <AdminUser />,
            },
            {
                path: 'user/:id?',
                element:
                    <AdminUserDetail />,
            },
            {
                path: 'settings',
                element:
                    <AdminSettings />,
            },
            {
                path: 'analysis',
                element:
                    <AdminAnalysis />,
            },
            {
                path: 'orders',
                element: <AdminOrders />,
            },
            {
                path: 'order/:id?',
                element: <AdminOrderDetail />,
            },
            {
                path: 'user-activity/:id',
                element: <AdminActivityLog />,
            },
        ],
    },
    {
        path: '*',
        element: <NotFound />,
    },
]);

type TIntlMessages = Record<string, string>;

/** 避免 IntlProvider 首屏 messages 为 undefined（异步 import 未完成时整表缺失会报 MISSING_TRANSLATION） */
function syncMessagesForLocale(code: string): TIntlMessages {
    const c = code.toLowerCase();
    if (
        c === 'zh' ||
        c === 'zh-hans' ||
        c === 'zh-hant' ||
        c === 'zh-tw' ||
        c === 'zh-cn'
    ) {
        return zhMessages as TIntlMessages;
    }
    return enMessages as TIntlMessages;
}

function getInitialIntlMessages(): TIntlMessages {
    return syncMessagesForLocale(useRootStore.getState().locale);
}

function App() {
    const rootStore = useRootStore();
    const configStore = useConfigStore();
    const loadingStore = useLoadingStore();
    const userStore = useUserStore();
    const confirmStore = useConfirmStore();
    const installPrompt = useRef<BeforeInstallPromptEvent | null>(null);
    const [checked, setChecked] = useState(false);
    const [install, setInstall] = useState(0);
    const [messages, setMessages] = useState<TIntlMessages>(getInitialIntlMessages);

    async function handleExecuteInstall() {
        if (!installPrompt.current) {
            return;
        }
        installPrompt.current.prompt();
        const { outcome } = await installPrompt.current.userChoice;
        if (outcome === 'accepted') {
            setInstall(2);
        }
    }

    async function loadData() {
        const query = new URLSearchParams(window.location.search);
        const token = query.get('_token') || localStorage.getItem('token');
        const config = await api<TData>('config', {
            loading: false,
        });

        if (config.c !== 0) {
            toast.error('Initialization failed 1');
            return;
        }

        configStore.setConfig(config.d);

        const adjustConfig = config.d['adjust'] as Record<string, unknown>;
        Adjust.initSdk({
            appToken: adjustConfig['token'] as string,
            environment: adjustConfig['environment'] as 'production' | 'sandbox',
            logLevel: adjustConfig['log_level'] as Adjust.LogLevel,
        });

        await initPixel(config.d);

        if (token) {
            await api<TData>('login/token', {
                method: 'post',
                data: {
                    token,
                },
                loading: false,
            }).then((result) => {
                if (result.c !== 0) {
                    localStorage.removeItem('token');
                    return;
                }
                localStorage.setItem('token', token);
                const raw = result.d as TData;
                // login/token 可能与 login/anonymous 一致为 { info }，也可能直接下发用户扁平字段
                const info = (raw['info'] as TData | undefined) ?? raw;
                userStore.signin(info);
                setChecked(true);
            });
        } else {
            // const credential = await signInAnonymously(auth);
            // await api('login/uid', {
            //     method: 'post',
            //     data: {
            //         uid: credential.user.uid,
            //     },
            //     loading: false,
            // }).then(result => {
            //     localStorage.setItem('token', result.d['token'] as string);
            //     const info = result.d['info'] as TData;
            //     info['name'] = credential.user.displayName;
            //     info['avatar'] = credential.user.photoURL;
            //     info['email'] = credential.user.email;
            //     info['anonymous'] = credential.user.isAnonymous ? 1 : 0;
            //     userStore.signin(info);
            // });
            await api<TData>('login/anonymous', {
                loading: false,
            }).then(result => {
                if (result.c !== 0) {
                    return;
                }
                localStorage.setItem('token', result.d['token'] as string);
                userStore.signin(result.d['info'] as TData);
                setChecked(true);
            });
        }

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
        const listener = () => {
            if (!isMobile()) {
                document.documentElement.style.width = '480px';
                document.documentElement.style.marginLeft = 'auto';
                document.documentElement.style.marginRight = 'auto';
                document.documentElement.style.boxShadow = '0 0 1px #888';
            } else {
                document.documentElement.style.width = 'auto';
                document.documentElement.style.marginLeft = 'auto';
                document.documentElement.style.marginRight = 'auto';
                document.documentElement.style.boxShadow = 'none';
            }
            const legacyDesktopCss = document.head.querySelector('#desktop-css');
            if (legacyDesktopCss?.parentNode) {
                legacyDesktopCss.parentNode.removeChild(legacyDesktopCss);
            }
        }

        listener();

        window.addEventListener('resize', listener);

        return () => {
            window.removeEventListener('resize', listener);
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
        };

        window.addEventListener('appinstalled', installedListener);

        return () => {
            window.removeEventListener('beforeinstallprompt', listener);
            window.removeEventListener('appinstalled', installedListener);
        };
    }, []);

    useEffect(() => {
        const applyModule = (res: unknown) => {
            const mod = res as { default?: TIntlMessages };
            setMessages(mod.default ?? (res as TIntlMessages));
        };

        switch (rootStore.locale) {
            case 'zh-hans':
            case 'zh-hant':
            case 'zh-TW':
            case 'zh-CN':
            case 'zh-tw':
            case 'zh-cn':
            case 'zh':
                // 与顶部静态 import 共用同一份，避免 dev 下再发 en.json?import / zh.json?import 重复请求
                setMessages(zhMessages as TIntlMessages);
                return;
            case 'en':
                setMessages(enMessages as TIntlMessages);
                return;
            case 'ar':
                void import('./locales/ar.json').then(applyModule);
                return;
            case 'de':
                void import('./locales/de.json').then(applyModule);
                return;
            case 'id':
                void import('./locales/id.json').then(applyModule);
                return;
            case 'ja':
                void import('./locales/ja.json').then(applyModule);
                return;
            case 'ko':
                void import('./locales/ko.json').then(applyModule);
                return;
            case 'ms':
                void import('./locales/ms.json').then(applyModule);
                return;
            case 'pt':
                void import('./locales/pt.json').then(applyModule);
                return;
            case 'th':
                void import('./locales/th.json').then(applyModule);
                return;
            case 'tr':
                void import('./locales/tr.json').then(applyModule);
                return;
            case 'vi':
                void import('./locales/vi.json').then(applyModule);
                return;
            default:
                setMessages(enMessages as TIntlMessages);
        }
    }, [rootStore.locale]);

    useEffect(() => {
        if (!checked) {
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
        const timer = window.setInterval(() => {
            api('alive', {
                method: 'post',
                loading: false,
            });
        }, 30000);

        return () => {
            window.clearInterval(timer);
        }
    }, [checked]);

    useEffect(() => {
        if (!checked) {
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

    }, [checked]);

    const showInstallPrompt = install > 0;

    return <IntlProvider locale={rootStore.locale} messages={messages} defaultLocale="en">
        <div
            className={cn('root', `root-${rootStore.theme}`)}
            style={showInstallPrompt ? { paddingBottom: '60px' } : undefined}
        >
            {install > 0 && (
                <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center">
                    <div
                        id="install"
                        className="pwa-install w-full max-w-[480px]"
                    >
                        <div className="pwa-install__left">
                            <div className="pwa-install__logoWrap">
                                <img
                                    alt="logo"
                                    src="/logo.png"
                                    className="pwa-install__logo"
                                    loading="lazy"
                                />
                            </div>
                            <div className="pwa-install__text">
                                <FormattedMessage id="add_desktop" />
                            </div>
                        </div>
                        <button
                            type="button"
                            className="pwa-install__btn pwa-install-open-btn"
                            onClick={handleExecuteInstall}
                        >
                            <FormattedMessage id="pwa_open" />
                        </button>
                    </div>
                </div>
            )}
            {checked ? <RouterProvider router={router} /> : <InitialBootLoading />}
        </div>
        <Dialog open={loadingStore.status}>
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
