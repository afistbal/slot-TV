import { Page } from "@/layouts/user";
import { FormattedMessage, useIntl } from "react-intl";
// import facebook from '@/assets/facebook.svg';
import google from '@/assets/google.svg';
import mail from '@/assets/email.svg';
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Mail, Shield, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, report, type TData } from "@/api";
import { useUserStore } from "@/stores/user";
import { emailVerify } from "@/utils";
import { useLoadingStore } from "@/stores/loading";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "@/firebase";
import usePixel from "@/hooks/usePixel";

export default function Component() {
    const intl = useIntl();
    const pixel = usePixel();
    const userStore = useUserStore();
    const loadingStore = useLoadingStore();
    const [emailOpen, setEmailOpen] = useState(false);
    const [time, setTime] = useState(0);
    const [email, setEmail] = useState(localStorage.getItem('email') ?? '');
    const [code, setCode] = useState('');

    function handleToggleEmailLogin() {
        setEmailOpen(!emailOpen);
    }

    async function handleSubmit() {
        if (!emailVerify(email)) {
            return toast.error(intl.formatMessage({
                id: 'invalid_email',
            }));
        }

        if (!/[0-9]{6}/.test(code.trim())) {
            return toast.error(intl.formatMessage({
                id: 'invalid_email_code',
            }));
        }

        loadingStore.show();

        const result = await api<{ [key: string]: unknown }>('login/email', {
            method: 'post',
            data: {
                email: email.trim(),
                code: code.trim(),
            },
            loading: false,
        });

        if (result.c !== 0) {
            loadingStore.hide();
            return;
        }

        /* @ts-ignore */
        if (window.flutter_inappwebview) {
            /* @ts-ignore */
            const signin = await window.flutter_inappwebview.callHandler('emailSignIn', email.trim(), (result.d['info'] as TData)['password'], result.d['is_new']);
            if (signin !== 'success') {
                toast.error(intl.formatMessage({
                    id: 'login_failed',

                }, {
                    'eason': signin,
                }));
                localStorage.removeItem('token');
                loadingStore.hide();
                return;
            }
        }

        toast.success(intl.formatMessage({
            id: 'login_success',
        }));

        setEmailOpen(false);
        localStorage.setItem('token', result.d['token'] as string);
        localStorage.setItem('email', email.trim());
        localStorage.setItem('login-method', 'email');
        userStore.signin(result.d['info'] as { [key: string]: unknown });
        pixel.track('Register');

        loadingStore.hide();
    }

    async function handleSendCode() {
        if (time > 0) {
            return;
        }

        if (!emailVerify(email)) {
            return toast.error(intl.formatMessage({
                id: 'invalid_email',
            }));
        }

        let result = await api('login/email/code', {
            method: 'post',
            data: {
                email: email.trim(),
            },
        });

        if (result.c !== 0) {
            localStorage.removeItem('token');
            return;
        }

        toast.success(intl.formatMessage({
            id: 'email_code_sended',
        }))

        let currentTime = 60;
        setTime(currentTime);
        localStorage.setItem('mail-code-expire', ((new Date).getTime() + 60000).toString());
        const timer = window.setInterval(() => {
            if (currentTime === 0) {
                window.clearInterval(timer);
            }
            currentTime -= 1;
            setTime(currentTime);
        }, 1000);
    }

    function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
        setEmail(e.currentTarget.value);
    }

    function handleCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
        setCode(e.currentTarget.value);
    }

    async function handleLogout() {
        loadingStore.show();
        /* @ts-ignore */
        if (window.flutter_inappwebview) {
            /* @ts-ignore */
            await window.flutter_inappwebview.callHandler('logout');
            /* @ts-ignore */
            await window.flutter_inappwebview.callHandler('currentUser').then((detail: { uid: string, avatar: string, email: string, name: string, anonymous: boolean, }) => {
                api('login/uid', {
                    method: 'post',
                    data: {
                        uid: detail.uid,
                    },
                    loading: false,
                }).then(result => {
                    localStorage.setItem('token', result.d['token'] as string);
                    const info = result.d['info'] as TData;
                    info['name'] = detail.name ? detail.name : 'No Name';
                    info['avatar'] = detail.avatar;
                    info['email'] = detail.email;
                    info['anonymous'] = detail.anonymous ? 1 : 0;
                    userStore.signin(info);
                }).finally(() => {
                    loadingStore.hide();
                })
            });
        } else {
            await auth.signOut();
            // const credential = await signInAnonymously(auth);

            // api('login/uid', {
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
            // }).finally(() => {
            //     loadingStore.hide();
            // });
            await api<TData>('login/anonymous', {
                loading: false,
            }).then(result => {
                if (result.c !== 0) {
                    localStorage.removeItem('token');
                    return;
                }
                localStorage.setItem('token', result.d['token'] as string);
                userStore.signin(result.d['info'] as TData);
            }).finally(() => {
                loadingStore.hide();
            });
        }
    }

    async function handleGoogleSignin() {
        try {
            loadingStore.show();
            /* @ts-ignore */
            await window.flutter_inappwebview.callHandler('googleSignin');
            /* @ts-ignore */
            let detail: { uid: string, avatar: string, email: string, name: string, anonymous: boolean, } = await window.flutter_inappwebview.callHandler('currentUser');
            if (!detail.uid) {
                loadingStore.hide();
                return;
            }
            let result = await api('login/uid', {
                method: 'post',
                data: {
                    uid: detail.uid,
                },
                loading: false,
            });

            if (result.c !== 0) {
                loadingStore.hide();
                localStorage.removeItem('token');
                return;
            }

            localStorage.setItem('token', result.d['token'] as string);
            localStorage.setItem('login-method', 'google');
            const info = result.d['info'] as TData;
            info['name'] = detail.name ? detail.name : 'No Name';
            info['avatar'] = detail.avatar;
            info['email'] = detail.email;
            info['anonymous'] = detail.anonymous ? 1 : 0;
            userStore.signin(info);
            loadingStore.hide();
            pixel.track('Register');
        } catch (e) {
            loadingStore.hide();
        }

    }

    async function handleGoogleSigninPopup() {
        try {
            loadingStore.show();
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);

            const credential = GoogleAuthProvider.credentialFromResult(result);
            if (!credential) {
                report('google login failed A');
                toast.error(intl.formatMessage({
                    id: 'login_failed',
                }, {
                    eason: 'A'
                }));
                localStorage.removeItem('token');
                return;
            }

            if (!result.user) {
                report('google login failed B');
                toast.error(intl.formatMessage({
                    id: 'login_failed',
                }, {
                    eason: 'B'
                }));
                localStorage.removeItem('token');
                return;
            }

            api('login/uid', {
                method: 'post',
                data: {
                    uid: result.user.uid,
                    anonymous: result.user.isAnonymous ? 1 : 0,
                    name: result.user.displayName || '',
                    email: result.user.email,
                    provider: 'google',
                },
                loading: false,
            }).then(result2 => {
                localStorage.setItem('token', result2.d['token'] as string);
                const info = result2.d['info'] as TData;
                info['name'] = result.user.displayName || 'No Name';
                info['avatar'] = result.user.photoURL || '';
                info['email'] = result.user.email || '';
                info['anonymous'] = result.user.isAnonymous ? 1 : 0;
                userStore.signin(info);
            });

        } catch (error) {
            const e = (error as Error);
            report(JSON.stringify(e));
            toast.error(intl.formatMessage({
                id: 'login_failed',
            }, {
                eason: e.message,
            }));
            localStorage.removeItem('token');
        } finally {
            loadingStore.hide();
        }
    }

    function handleCopyId() {
        navigator.clipboard.writeText(userStore.info!['unique_id'] as string);
        toast.success(intl.formatMessage({ id: 'copied' }));
    }

    useEffect(() => {
        const expire = (parseInt(localStorage.getItem('mail-code-expire') || '0', 10) || 0);
        const now = new Date().getTime();
        let timer = 0;
        if (expire > now) {
            let current = Math.ceil((expire - now) / 1000);
            setTime(current);
            timer = window.setInterval(() => {
                if (current === 0) {
                    window.clearInterval(timer);
                }
                current -= 1;
                setTime(current);
            }, 1000);
        }

        return () => {
            window.clearInterval(timer);
        };
    }, []);

    return <Page title={userStore.signed && userStore.info!['anonymous'] !== 1 ? 'account_infomation' : 'login'}>
        {userStore.signed && userStore.info!['anonymous'] !== 1 ? <>
            <div className="m-4 rounded-md bg-white">
                <div className="flex gap-2 justify-between items-center p-4 border-t border-muted" onClick={handleCopyId}>
                    <div className="flex gap-1 text-gray-600 items-center">
                        <div className="text-md"><FormattedMessage id="user_id" /></div>
                    </div>
                    <div>{userStore.info!['unique_id'] as string}</div>
                </div>
                <div className="flex gap-2 justify-between items-center p-4">
                    <div className="flex gap-1 text-gray-600 items-center">
                        <div className="text-md"><FormattedMessage id="user_name" /></div>
                    </div>
                    <div>{userStore.info!['name'] as string}</div>
                </div>
                <div className="flex gap-2 justify-between items-center p-4 border-t border-muted">
                    <div className="flex gap-1 text-gray-600 items-center">
                        <div className="text-md"><FormattedMessage id="user_type" /></div>
                    </div>
                    <div><FormattedMessage id={`vip_${userStore.info!['vip'] as number}`} /></div>
                </div>
            </div>
            <div className="p-4 flex flex-col gap-4">
                <Button onClick={handleLogout} className="bg-slate-500"><FormattedMessage id="logout" /></Button>
            </div>
        </> : <div className="p-8 w-full h-full">
            <div className="p-4 text-2xl font-bold text-center pb-8 text-slate-700"><FormattedMessage id="domain" /></div>
            <div className="flex gap-4 flex-col">
                {/* <div className="h-15 rounded-full border flex justify-center items-center text-lg gap-2 bg-gray-300 text-gray-400">
                    <img src={facebook} className="w-6 h-6" />
                    <FormattedMessage id="login_facebook" />
                </div> */}
                <div className="h-15 rounded-full bg-gray-50 border flex justify-center items-center text-lg gap-2" onClick={(window as any).flutter_inappwebview !== undefined ? handleGoogleSignin : handleGoogleSigninPopup}>
                    <img src={google} className="w-6 h-6" />
                    <FormattedMessage id="login_google" />
                </div>
                <div className="h-15 rounded-full bg-gray-50 border flex justify-center items-center text-lg gap-2" onClick={handleToggleEmailLogin}>
                    <img src={mail} className="w-6 h-6" />
                    <FormattedMessage id="login_email" />
                </div>
            </div>
        </div>}
        <Drawer open={emailOpen} onOpenChange={handleToggleEmailLogin}>
            <DrawerContent className="bg-linear-to-b from-[#ffe9d1] to-white" aria-describedby="login">
                <DrawerTitle className="flex items-center gap-4 px-4 pt-4 mb-4">
                    <div className="flex-1 text-lg text-ellipsis overflow-hidden text-nowrap font-bold">
                        <FormattedMessage id="login_email" />
                    </div>
                    <div onClick={handleToggleEmailLogin}>
                        <X />
                    </div>
                </DrawerTitle>
                <div className="border-t p-8 flex flex-col gap-4">
                    <div className="h-15 rounded-full bg-gray-50 border flex justify-center items-center text-lg gap-2 px-5">
                        <Mail className="w-6 h-6 shrink-0 text-slate-500" />
                        <input onChange={handleEmailChange} value={email} type="email" autoFocus maxLength={30} className="w-full h-full outline-none border-none px-2" placeholder={intl.formatMessage({ id: 'email_placeholder' })} />
                    </div>
                    <div className="h-15 rounded-full bg-gray-50 border flex justify-center items-center text-lg gap-2 pl-5">
                        <Shield className="w-6 h-6 shrink-0 text-slate-500" />
                        <input onChange={handleCodeChange} value={code} type="number" maxLength={6} className="w-full h-full outline-none border-none px-2" placeholder={intl.formatMessage({ id: 'code_placeholder' })} />
                        <div className="shrink-0 text-red-400 h-full flex items-center justify-center px-5" onClick={handleSendCode} onMouseDown={e => e.preventDefault()}>
                            {time > 0 ? `${time.toString().padStart(2, '0')}s` : <FormattedMessage id="send_code" />}
                        </div>
                    </div>
                </div>
                <div className="p-8 pt-0">
                    <Button onClick={handleSubmit}><FormattedMessage id="login" /></Button>
                </div>
            </DrawerContent>
        </Drawer>
    </Page>;
}