import { createBrowserRouter, RouterProvider, useRouteError } from "react-router"
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

import LayoutUser from './layouts/user';
import UserHome from './pages/user/Home';
import UserMyList from './pages/user/MyList';
import UserFavorite from './pages/user/Favorite';
import UserHistory from './pages/user/History';
import UserProfile from './pages/user/Profile';
import UserVideo from './pages/user/Video';
import UserAirwallex from './pages/user/Airwallex';
import UserTest from './pages/user/Test';

import UserFeedback from './pages/user/Feedback';
import UserLanguage from './pages/user/Language';
import UserAbout from './pages/user/About';
import UserText from './pages/user/Text';
import UserLogin from './pages/user/Login';
import UserPay from './pages/user/Pay';
import UserMembership from './pages/user/Membership';
import UserSearch from './pages/user/Search';
import UserMyBalance from './pages/user/MyBanlance';

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
]);

function App() {
    const rootStore = useRootStore();
    const configStore = useConfigStore();
    const loadingStore = useLoadingStore();
    const userStore = useUserStore();
    const confirmStore = useConfirmStore();
    const installPrompt = useRef<any>(null);
    const [checked, setChecked] = useState(false);
    const [install, setInstall] = useState(0);
    const [messages, setMessages] = useState<Record<string, string>>();

    function handleCancelInstall() {
        setInstall(0);
    }

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
                userStore.signin(result.d);
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
            let css = document.head.querySelector('#desktop-css');
            if (!css) {
                css = document.createElement('style');
                css.textContent = `
::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}

::-webkit-scrollbar-thumb {
    background-color: rgba(0, 0, 0, 0.1);
}
`;
            }
            if (!isMobile()) {
                document.documentElement.style.width = '480px';
                document.documentElement.style.marginLeft = 'auto';
                document.documentElement.style.marginRight = 'auto';
                document.documentElement.style.boxShadow = '0 0 1px #888';
                if (!document.head.querySelector('#desktop-css')) {
                    document.head.appendChild(css);
                }
            } else {
                document.documentElement.style.width = 'auto';
                document.documentElement.style.marginLeft = 'auto';
                document.documentElement.style.marginRight = 'auto';
                document.documentElement.style.boxShadow = 'none';
                css = document.head.querySelector('#desktop-css');
                if (css) {
                    document.head.removeChild(css);
                    css.remove();
                }
            }
        }

        listener();

        window.addEventListener('resize', listener);

        return () => {
            window.removeEventListener('resize', listener);
        }
    }, []);

    useEffect(() => {
        if (!checked) {
            return;
        }

        const listener = (event: any) => {
            installPrompt.current = event;
            setInstall(1);
        };

        window.addEventListener('beforeinstallprompt', listener);

        const installedListener = () => {
            setInstall(0);
        }

        window.addEventListener('appinstalled', installedListener);

        return () => {
            window.removeEventListener('beforeinstallprompt', listener);
            window.removeEventListener('appinstalled', installedListener);
        }
    }, [checked]);

    useEffect(() => {
        let locale;
        switch (rootStore.locale) {
            case 'ar':
                locale = import('./locales/ar.json');
                break;
            case 'de':
                locale = import('./locales/de.json');
                break;
            case 'id':
                locale = import('./locales/id.json');
                break;
            case 'ja':
                locale = import('./locales/ja.json');
                break;
            case 'ko':
                locale = import('./locales/ko.json');
                break;
            case 'ms':
                locale = import('./locales/ms.json');
                break;
            case 'pt':
                locale = import('./locales/pt.json');
                break;
            case 'th':
                locale = import('./locales/th.json');
                break;
            case 'tr':
                locale = import('./locales/tr.json');
                break;
            case 'vi':
                locale = import('./locales/vi.json');
                break;
            case 'zh-hans':
            case 'zh-hant':
            case 'zh':
                locale = import('./locales/zh.json');
                break;
            default:
                locale = import('./locales/en.json');
        }

        locale.then(res => {
            setMessages(res.default);
        });

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

    return <IntlProvider locale={rootStore.locale} messages={messages} defaultLocale="en">
        <div className={cn('root', `root-${rootStore.theme}`)}>
            {install > 0 && <div id="install" className="fixed bg-white shadow-2xl m-auto top-20 z-10 left-0 right-0 w-4/5 max-w-96 rounded-md flex flex-col items-start gap-2 p-4">
                <div className="text-lg text-slate-700">
                    <FormattedMessage id={install == 1 ? 'add_desktop' : 'installing'} />
                </div>
                {install == 1 && <div className="flex justify-end gap-2 w-full mt-2 text-sm">
                    <button className="bg-slate-400 px-4 py-1 rounded-md text-white cursor-pointer" onClick={handleCancelInstall}><FormattedMessage id="cancel" /></button>
                    <button className="bg-red-400 px-4 py-1 rounded-md text-white cursor-pointer" onClick={handleExecuteInstall}><FormattedMessage id="install_app" /></button>
                </div>}
            </div>}
            {checked ? <RouterProvider router={router} /> : <Loader />}
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
                        <Button className="bg-slate-400 flex-1" onClick={confirmStore.cancel}>
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
