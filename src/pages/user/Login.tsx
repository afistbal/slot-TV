import { FormattedMessage, useIntl } from 'react-intl';
import { Navigate, useNavigate } from 'react-router';
import type React from 'react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import google from '@/assets/google.svg';
import loginPcGoogle from '@/assets/icons/login-pc-google.png';
import mail from '@/assets/email.svg';
import mailPc from '@/assets/icons/login-pc-email.svg';
import bg from '@/assets/images/ec9725d0-83b2-11ee-aed2-cfe3d80f70eb.png';
import closeIcon from '@/assets/images/icon_close.webp';
import { BRAND_DISPLAY_NAME, BRAND_LOGO_SRC } from '@/constants/brand';
import { api, report, type TData } from '@/api';
import { useUserStore } from '@/stores/user';
import { emailVerify } from '@/utils';
import { useLoadingStore } from '@/stores/loading';
import { auth } from '@/firebase';
import usePixel from '@/hooks/usePixel';
import { LegalDocumentLink } from '@/components/LegalDocumentLink';
import { useMinWidth768 } from '@/hooks/useMinWidth768';
import { cn } from '@/lib/utils';
import { getAnonymousUniIdPayload } from '@/lib/anonymousUniIdForBinding';

type PcLoginStep = 'providers' | 'email';

type LoginVariant = 'h5' | 'pc';

function useLoginBase(
    variant: LoginVariant,
    pcOpts?: { onRequestClose: () => void },
) {
    const intl = useIntl();
    const pixel = usePixel();
    const userStore = useUserStore();
    const loadingStore = useLoadingStore();
    const navigate = useNavigate();
    const [emailOpen, setEmailOpen] = useState(false);
    const [pcStep, setPcStep] = useState<PcLoginStep>('providers');
    const [time, setTime] = useState(0);
    const [sendCodeLoading, setSendCodeLoading] = useState(false);
    const [emailSubmitLoading, setEmailSubmitLoading] = useState(false);
    /** Google 弹窗 OAuth：勿用全局 loadingStore，否则与 PC 登录弹窗双开 Radix Dialog，取消弹窗后易拦截点击/无法关登录层 */
    const [oauthPopupLoading, setOauthPopupLoading] = useState(false);
    const [email, setEmail] = useState(localStorage.getItem('email') ?? '');
    const [code, setCode] = useState('');

    const isPcVariant = variant === 'pc';
    const profilePathAfterLogin = isPcVariant ? '/profile?tab=topup' : '/profile';

    /** PC：`PcLoginDialog` 由父级 state 控制；登录成功若已在 `/profile?tab=topup`，仅 navigate 不会关弹窗 */
    function closePcLoginModal() {
        if (isPcVariant && pcOpts) {
            pcOpts.onRequestClose();
        }
    }

    function handleToggleEmailLogin() {
        if (isPcVariant) {
            setPcStep('email');
        } else {
            setEmailOpen(!emailOpen);
        }
    }

    function handlePcBackToProviders() {
        setPcStep('providers');
    }

    function handleDialogOpenChange(next: boolean) {
        if (next) {
            return;
        }
        if (isPcVariant && pcOpts) {
            pcOpts.onRequestClose();
        }
    }

    function handlePcDialogEscape(e: Event) {
        if (pcStep === 'email') {
            e.preventDefault();
            setPcStep('providers');
        }
    }

    function handlePcDialogOutside(e: Event) {
        if (pcStep === 'email') {
            e.preventDefault();
            setPcStep('providers');
        }
    }

    async function handleSubmit() {
        if (!emailVerify(email)) {
            return toast.error(
                intl.formatMessage({
                    id: 'invalid_email',
                }),
            );
        }

        if (!/[0-9]{6}/.test(code.trim())) {
            return toast.error(
                intl.formatMessage({
                    id: 'invalid_email_code',
                }),
            );
        }

        if (emailSubmitLoading) {
            return;
        }

        loadingStore.show();
        setEmailSubmitLoading(true);
        try {
            const result = await api<{ [key: string]: unknown }>('login/email', {
                method: 'post',
                data: {
                    email: email.trim(),
                    code: code.trim(),
                    ...getAnonymousUniIdPayload(),
                },
                loading: false,
            });

            if (result.c !== 0) {
                return;
            }

            /* @ts-ignore */
            if (window.flutter_inappwebview) {
                /* @ts-ignore */
                const signin = await window.flutter_inappwebview.callHandler(
                    'emailSignIn',
                    email.trim(),
                    (result.d['info'] as TData)['password'],
                    result.d['is_new'],
                );
                if (signin !== 'success') {
                    toast.error(
                        intl.formatMessage(
                            {
                                id: 'login_failed',
                            },
                            {
                                eason: signin,
                            },
                        ),
                    );
                    localStorage.removeItem('token');
                    return;
                }
            }

            toast.success(
                intl.formatMessage({
                    id: 'login_success',
                }),
            );

            setEmailOpen(false);
            setPcStep('providers');
            localStorage.setItem('token', result.d['token'] as string);
            localStorage.setItem('email', email.trim());
            localStorage.setItem('login-method', 'email');
            localStorage.removeItem('user-avatar');
            userStore.signin(result.d['info'] as { [key: string]: unknown });
            pixel.track('Register');

            closePcLoginModal();
            navigate(profilePathAfterLogin, { replace: true, state: {} });
        } finally {
            setEmailSubmitLoading(false);
            loadingStore.hide();
        }
    }

    async function handleSendCode() {
        if (time > 0 || sendCodeLoading) {
            return;
        }

        if (!emailVerify(email)) {
            return toast.error(
                intl.formatMessage({
                    id: 'invalid_email',
                }),
            );
        }

        setSendCodeLoading(true);
        try {
            const result = await api('login/email/code', {
                method: 'post',
                data: {
                    email: email.trim(),
                },
                loading: false,
            });

            if (result.c !== 0) {
                localStorage.removeItem('token');
                return;
            }

            toast.success(
                intl.formatMessage({
                    id: 'email_code_sended',
                }),
            );

            let currentTime = 60;
            setTime(currentTime);
            localStorage.setItem('mail-code-expire', (new Date().getTime() + 60000).toString());
            const timer = window.setInterval(() => {
                if (currentTime === 0) {
                    window.clearInterval(timer);
                }
                currentTime -= 1;
                setTime(currentTime);
            }, 1000);
        } finally {
            setSendCodeLoading(false);
        }
    }

    function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
        setEmail(e.currentTarget.value);
    }

    function handleCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
        setCode(e.currentTarget.value);
    }

    async function handleGoogleSignin() {
        try {
            loadingStore.show();
            const flutter = (window as unknown as {
                flutter_inappwebview?: { callHandler: (name: string, ...args: unknown[]) => Promise<any> };
            }).flutter_inappwebview;
            if (!flutter) {
                loadingStore.hide();
                return;
            }
            await flutter.callHandler('googleSignin');
            let detail: {
                uid: string;
                avatar: string;
                email: string;
                name: string;
                anonymous: boolean;
            } = await flutter.callHandler('currentUser');
            if (!detail.uid) {
                loadingStore.hide();
                return;
            }
            const result = await api('login/uid', {
                method: 'post',
                data: {
                    uid: detail.uid,
                    ...getAnonymousUniIdPayload(),
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
            if (detail.avatar) {
                localStorage.setItem('user-avatar', detail.avatar);
            } else {
                localStorage.removeItem('user-avatar');
            }
            const info = result.d['info'] as TData;
            info['name'] = detail.name ? detail.name : 'No Name';
            info['avatar'] = detail.avatar;
            info['email'] = detail.email;
            info['anonymous'] = detail.anonymous ? 1 : 0;
            userStore.signin(info);
            toast.success(
                intl.formatMessage({
                    id: 'login_success',
                }),
            );
            loadingStore.hide();
            pixel.track('Register');
            closePcLoginModal();
            navigate(profilePathAfterLogin, { replace: true, state: {} });
        } catch {
            loadingStore.hide();
        }
    }

    async function handleGoogleSigninPopup() {
        if (oauthPopupLoading) {
            return;
        }
        setOauthPopupLoading(true);
        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);

            /** 仅以 `result.user` 为准：`credentialFromResult` 在部分环境下可为 null，但仍已登录 Firebase，不应拦截 `login/uid`。 */
            if (!result.user) {
                report('google login failed B');
                toast.error(
                    intl.formatMessage(
                        {
                            id: 'login_failed',
                        },
                        {
                            eason: 'B',
                        },
                    ),
                );
                localStorage.removeItem('token');
                return;
            }

            const result2 = await api('login/uid', {
                method: 'post',
                data: {
                    uid: result.user.uid,
                    anonymous: result.user.isAnonymous ? 1 : 0,
                    name: result.user.displayName || '',
                    email: result.user.email,
                    provider: 'google',
                    ...getAnonymousUniIdPayload(),
                },
                loading: false,
            });
            if (result2.c !== 0) {
                localStorage.removeItem('token');
                return;
            }
            if (result2.d == null || typeof result2.d !== 'object') {
                localStorage.removeItem('token');
                return;
            }
            const d = result2.d as { [key: string]: unknown };
            localStorage.setItem('token', d['token'] as string);
            const photo = result.user.photoURL || '';
            if (photo) {
                localStorage.setItem('user-avatar', photo);
            } else {
                localStorage.removeItem('user-avatar');
            }
            const info = d['info'] as TData;
            info['name'] = result.user.displayName || 'No Name';
            info['avatar'] = result.user.photoURL || '';
            info['email'] = result.user.email || '';
            info['anonymous'] = result.user.isAnonymous ? 1 : 0;
            userStore.signin(info);
            toast.success(
                intl.formatMessage({
                    id: 'login_success',
                }),
            );
            pixel.track('Register');
            closePcLoginModal();
            navigate(profilePathAfterLogin, { replace: true, state: {} });
        } catch (error) {
            const e = error as Error;
            report(JSON.stringify(e));
            toast.error(
                intl.formatMessage(
                    {
                        id: 'login_failed',
                    },
                    {
                        eason: e.message,
                    },
                ),
            );
            localStorage.removeItem('token');
        } finally {
            setOauthPopupLoading(false);
        }
    }

    useEffect(() => {
        const expire = parseInt(localStorage.getItem('mail-code-expire') || '0', 10) || 0;
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

    return {
        intl,
        email,
        setEmail,
        code,
        time,
        emailOpen,
        setEmailOpen,
        pcStep,
        setPcStep,
        handleToggleEmailLogin,
        handlePcBackToProviders,
        handleDialogOpenChange,
        handlePcDialogEscape,
        handlePcDialogOutside,
        handleSubmit,
        handleSendCode,
        sendCodeLoading,
        emailSubmitLoading,
        oauthPopupLoading,
        handleEmailChange,
        handleCodeChange,
        handleGoogleSignin,
        handleGoogleSigninPopup,
    };
}

export function PcLoginDialog({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const onRequestClose = () => onOpenChange(false);
    const {
        intl,
        email,
        code,
        pcStep,
        time,
        handleToggleEmailLogin,
        handlePcBackToProviders,
        handleDialogOpenChange,
        handlePcDialogEscape,
        handlePcDialogOutside,
        handleSubmit,
        handleSendCode,
        sendCodeLoading,
        emailSubmitLoading,
        oauthPopupLoading,
        handleEmailChange,
        handleCodeChange,
        handleGoogleSignin,
        handleGoogleSigninPopup,
    } = useLoginBase('pc', { onRequestClose });

    const protocolBlock = (
        <div className="LoginModal_protocol__jVDhl">
            <FormattedMessage
                id="protocol"
                values={{
                    tos: (parts: React.ReactNode[]) => (
                        <LegalDocumentLink title="user_agreement" className="underline">
                            {parts}
                        </LegalDocumentLink>
                    ),
                    pp: (parts: React.ReactNode[]) => (
                        <LegalDocumentLink title="privacy_policy" className="underline">
                            {parts}
                        </LegalDocumentLink>
                    ),
                }}
            />
        </div>
    );

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => {
                if (v) {
                    return;
                }
                handleDialogOpenChange(false);
            }}
        >
            <DialogContent
                hideCloseButton
                overlayClassName="rs-login-modal__overlay"
                className={cn(
                    'rs-login-modal__dialog rs-login-modal LoginModal_login_modal__oygOe',
                    /* 对标 ant-modal-content：460×600；窄屏 width 用 min 避免溢出 */
                    '!w-[min(460px,calc(100%-2rem))] !h-[600px] !min-h-[600px] !max-h-[600px] !max-w-[min(460px,calc(100%-2rem))] sm:!max-w-[min(460px,calc(100%-2rem))] !p-0 !box-border',
                )}
                onEscapeKeyDown={handlePcDialogEscape}
                onPointerDownOutside={handlePcDialogOutside}
            >
                <DialogTitle className="sr-only">
                    <FormattedMessage id="login" />
                </DialogTitle>
                <div
                    className={cn(
                        'LoginModal_login_body__DH86w rs-login-modal__body-panel',
                        pcStep === 'email' && 'LoginModal_login_body__DH86w--email',
                    )}
                >
                    {pcStep === 'email' ? (
                        <button
                            type="button"
                            className="rs-login-modal__email-back"
                            onClick={handlePcBackToProviders}
                        >
                            <FormattedMessage id="back" />
                        </button>
                    ) : null}
                    <button
                        type="button"
                        className="LoginModal_close_btn__KOxVA"
                        onClick={onRequestClose}
                        aria-label={intl.formatMessage({ id: 'close' })}
                    >
                        <X className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                    </button>

                    {pcStep === 'providers' ? (
                        <>
                            <div className="LoginModal_logo__ahMlI">
                                <img src={BRAND_LOGO_SRC} alt="" />
                            </div>
                            <div className="LoginModal_title__ObusB">{BRAND_DISPLAY_NAME}</div>
                            <p>
                                <FormattedMessage
                                    id="welcome_to_site"
                                    values={{ site: BRAND_DISPLAY_NAME }}
                                />
                            </p>
                            <div className="LoginModal_login_btn_box__QKb14">
                                <button
                                    type="button"
                                    id="google"
                                    className={cn(
                                        'LoginModal_login_btn_item__FxNs7 LoginModal_login_btn_item__FxNs7--google',
                                        oauthPopupLoading && 'pointer-events-none opacity-60',
                                    )}
                                    disabled={oauthPopupLoading}
                                    aria-busy={oauthPopupLoading}
                                    onClick={
                                        (window as unknown as { flutter_inappwebview?: unknown })
                                            .flutter_inappwebview !== undefined
                                            ? handleGoogleSignin
                                            : () => void handleGoogleSigninPopup()
                                    }
                                >
                                    <div className="LoginModal_login_icon__Huj9u">
                                        <img src={loginPcGoogle} alt="" />
                                    </div>
                                    <div className="LoginModal_login_text__3ZrIq">
                                        <FormattedMessage id="login_google" />
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    id="email"
                                    className="LoginModal_login_btn_item__FxNs7 LoginModal_login_btn_item__FxNs7--email"
                                    onClick={handleToggleEmailLogin}
                                >
                                    <div className="LoginModal_login_icon__Huj9u">
                                        <img src={mailPc} alt="" />
                                    </div>
                                    <div className="LoginModal_login_text__3ZrIq">
                                        <FormattedMessage id="login_email" />
                                    </div>
                                </button>
                            </div>
                            {protocolBlock}
                        </>
                    ) : (
                        <>
                            <div className="LoginModal_title__ObusB" style={{ marginBottom: 8 }}>
                                <FormattedMessage id="login_email" />
                            </div>
                            <div className="rs-login-modal__email-fields">
                                <div className="rs-login-modal__email-field">
                                    <input
                                        className="rs-login-modal__email-input"
                                        type="email"
                                        value={email}
                                        onChange={handleEmailChange}
                                        autoComplete="email"
                                        placeholder={intl.formatMessage({ id: 'email_placeholder' })}
                                        maxLength={30}
                                    />
                                </div>
                                <div className="rs-login-modal__email-field">
                                    <input
                                        className="rs-login-modal__email-input"
                                        type="text"
                                        inputMode="numeric"
                                        value={code}
                                        onChange={handleCodeChange}
                                        placeholder={intl.formatMessage({ id: 'code_placeholder' })}
                                        maxLength={6}
                                    />
                                    <span
                                        role="button"
                                        tabIndex={sendCodeLoading ? -1 : 0}
                                        className={cn(
                                            'rs-login-modal__email-send',
                                            sendCodeLoading && 'rs-login-modal__email-send--loading',
                                        )}
                                        aria-busy={sendCodeLoading}
                                        onClick={() => void handleSendCode()}
                                        onKeyDown={(e) => {
                                            if (sendCodeLoading) {
                                                return;
                                            }
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                void handleSendCode();
                                            }
                                        }}
                                    >
                                        {sendCodeLoading ? (
                                            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                                        ) : time > 0 ? (
                                            `${time.toString().padStart(2, '0')}s`
                                        ) : (
                                            intl.formatMessage({ id: 'send_code' })
                                        )}
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="rs-login-modal__email-submit inline-flex items-center justify-center gap-2"
                                disabled={emailSubmitLoading}
                                aria-busy={emailSubmitLoading}
                                onClick={() => void handleSubmit()}
                            >
                                {emailSubmitLoading ? (
                                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                                ) : null}
                                <FormattedMessage id="login" />
                            </button>
                            {protocolBlock}
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function Component() {
    const isPc = useMinWidth768();
    const navigate = useNavigate();
    const {
        intl,
        email,
        code,
        time,
        emailOpen,
        setEmailOpen,
        handleToggleEmailLogin,
        handleSubmit,
        handleSendCode,
        sendCodeLoading,
        emailSubmitLoading,
        oauthPopupLoading,
        handleEmailChange,
        handleCodeChange,
        handleGoogleSignin,
        handleGoogleSigninPopup,
    } = useLoginBase('h5');

    if (isPc) {
        return <Navigate to="/profile" replace state={{ openPcLogin: true }} />;
    }

    return (
        <div className="rs-login">
            <div className="rs-login__bg" style={{ backgroundImage: `url(${bg})` }} />
            <div className="rs-login__shade" />
            <div className="rs-login__panel">
                <button
                    type="button"
                    className="rs-login__close"
                    onClick={() => navigate(-1)}
                    aria-label="Close"
                >
                    <img src={closeIcon} alt="" />
                </button>

                <div className="LoginPage_login_body___4R_e rs-login__body">
                    <div className="LoginPage_logo__mi0_p rs-login__logoWrap">
                        <img src={BRAND_LOGO_SRC} alt="" />
                    </div>
                    <div className="LoginPage_title__cjdzC rs-login__title">{BRAND_DISPLAY_NAME}</div>
                    <p className="LoginPage_text__J0MII rs-login__subtitle">
                        <FormattedMessage id="welcome_to_site" values={{ site: BRAND_DISPLAY_NAME }} />
                    </p>

                    <div className="LoginPage_login_btn_box__mdGH7 rs-login__btns">
                        <div
                            id="google"
                            className={cn(
                                'LoginPage_login_btn_item__OkeV1 rs-login__btn',
                                oauthPopupLoading && 'pointer-events-none opacity-60',
                            )}
                            role="button"
                            tabIndex={oauthPopupLoading ? -1 : 0}
                            onClick={() => {
                                if (oauthPopupLoading) {
                                    return;
                                }
                                if (
                                    (window as unknown as { flutter_inappwebview?: unknown })
                                        .flutter_inappwebview !== undefined
                                ) {
                                    void handleGoogleSignin();
                                } else {
                                    void handleGoogleSigninPopup();
                                }
                            }}
                            onKeyDown={(e) => {
                                if (oauthPopupLoading) {
                                    return;
                                }
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    if (
                                        (window as unknown as { flutter_inappwebview?: unknown })
                                            .flutter_inappwebview !== undefined
                                    ) {
                                        void handleGoogleSignin();
                                    } else {
                                        void handleGoogleSigninPopup();
                                    }
                                }
                            }}
                        >
                            <div className="LoginPage_login_icon__XK3jz">
                                <img src={google} alt="" />
                            </div>
                            <div className="LoginPage_login_text__NWSSM">
                                <FormattedMessage id="login_google" />
                            </div>
                        </div>
                        <div
                            id="email"
                            className="LoginPage_login_btn_item__OkeV1 rs-login__btn"
                            onClick={handleToggleEmailLogin}
                        >
                            <div className="LoginPage_login_icon__XK3jz">
                                <img src={mail} alt="" />
                            </div>
                            <div className="LoginPage_login_text__NWSSM">
                                <FormattedMessage id="login_email" />
                            </div>
                        </div>
                    </div>

                    <div className="LoginPage_protocol__aQxLZ rs-login__protocol">
                        <FormattedMessage
                            id="protocol"
                            values={{
                                tos: (parts: React.ReactNode[]) => (
                                    <LegalDocumentLink title="user_agreement" className="underline">
                                        {parts}
                                    </LegalDocumentLink>
                                ),
                                pp: (parts: React.ReactNode[]) => (
                                    <LegalDocumentLink title="privacy_policy" className="underline">
                                        {parts}
                                    </LegalDocumentLink>
                                ),
                            }}
                        />
                    </div>
                </div>
                <Drawer open={emailOpen} onOpenChange={setEmailOpen}>
                    <DrawerContent className="bg-linear-to-b from-[#ffe9d1] to-white" aria-describedby="login">
                        <DrawerTitle className="flex items-center gap-4 px-4 pt-4 mb-4">
                            <div className="flex-1 text-lg text-ellipsis overflow-hidden text-nowrap font-bold">
                                <FormattedMessage id="login_email" />
                            </div>
                            <div onClick={() => setEmailOpen(false)}>
                                <X />
                            </div>
                        </DrawerTitle>
                        <div className="border-t p-8 flex flex-col gap-4">
                            <div className="rs-login__drawerField">
                                <input
                                    onChange={handleEmailChange}
                                    value={email}
                                    type="email"
                                    autoFocus
                                    maxLength={30}
                                    className="rs-login__drawerInput"
                                    placeholder={intl.formatMessage({ id: 'email_placeholder' })}
                                />
                            </div>
                            <div className="rs-login__drawerField">
                                <input
                                    onChange={handleCodeChange}
                                    value={code}
                                    type="number"
                                    maxLength={6}
                                    className="rs-login__drawerInput"
                                    placeholder={intl.formatMessage({ id: 'code_placeholder' })}
                                />
                                <div
                                    className={cn(
                                        'rs-login__drawerSend',
                                        sendCodeLoading && 'rs-login__drawerSend--loading',
                                    )}
                                    role="button"
                                    tabIndex={sendCodeLoading ? -1 : 0}
                                    aria-busy={sendCodeLoading}
                                    onClick={() => void handleSendCode()}
                                    onMouseDown={(e) => !sendCodeLoading && e.preventDefault()}
                                >
                                    {sendCodeLoading ? (
                                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                                    ) : time > 0 ? (
                                        `${time.toString().padStart(2, '0')}s`
                                    ) : (
                                        <FormattedMessage id="send_code" />
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="p-8 pt-0">
                            <Button
                                onClick={() => void handleSubmit()}
                                disabled={emailSubmitLoading}
                                aria-busy={emailSubmitLoading}
                            >
                                {emailSubmitLoading ? (
                                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                                ) : null}
                                <FormattedMessage id="login" />
                            </Button>
                        </div>
                    </DrawerContent>
                </Drawer>
            </div>
        </div>
    );
}
