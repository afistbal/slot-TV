import { FormattedMessage, useIntl } from 'react-intl';
import { Navigate, useNavigate } from 'react-router';
import type React from 'react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import google from '@/assets/google.svg';
import loginPcGoogle from '@/assets/icons/login-pc-google.png';
import mailPc from '@/assets/icons/login-pc-email.svg';
import bg from '@/assets/images/ec9725d0-83b2-11ee-aed2-cfe3d80f70eb.png';
import closeIcon from '@/assets/images/icon_close.webp';
import { BRAND_DISPLAY_NAME, BRAND_LOGO_SRC } from '@/constants/brand';
import { api, report, type TData } from '@/api';
import { useUserStore } from '@/stores/user';
import { useAuthPromptStore } from '@/stores/authPrompt';
import { emailVerify } from '@/utils';
import { useLoadingStore } from '@/stores/loading';
import { auth } from '@/firebase';
import usePixel from '@/hooks/usePixel';
import { LegalDocumentLink } from '@/components/LegalDocumentLink';
import { useMinWidth768 } from '@/hooks/useMinWidth768';
import { cn } from '@/lib/utils';
import {
    clearStoredAffiliateReferralCode,
    getRegistrationReferralPayload,
} from '@/lib/affiliateReferralStorage';
import { fromSourceForLogin } from '@/lib/adAttribution';
import { setIsAnonymousFromInfo } from '@/lib/clientIsAnonymous';
import '@/styles/login-reelshort.scss';
import '@/styles/login-modal-reelshort-pc.scss';

type PcLoginStep = 'providers' | 'email';
type EmailAuthMode = 'login' | 'register';
type LoginCredentialMode = 'password' | 'forgot';

type LoginVariant = 'h5' | 'pc';

function useLoginBase(
    variant: LoginVariant,
    pcOpts?: { onRequestClose: () => void; onLoginSuccess?: () => void },
) {
    const intl = useIntl();
    const pixel = usePixel();
    const userStore = useUserStore();
    const loadingStore = useLoadingStore();
    const navigate = useNavigate();
    const [emailOpen, setEmailOpen] = useState(false);
    const [pcStep, setPcStep] = useState<PcLoginStep>(variant === 'pc' ? 'email' : 'providers');
    const [emailSubmitLoading, setEmailSubmitLoading] = useState(false);
    const [registerSubmitLoading, setRegisterSubmitLoading] = useState(false);
    /** Google 弹窗 OAuth：勿用全局 loadingStore，否则与 PC 登录弹窗双开 Radix Dialog，取消弹窗后易拦截点击/无法关登录层 */
    const [oauthPopupLoading, setOauthPopupLoading] = useState(false);
    const [email, setEmail] = useState(localStorage.getItem('email') ?? '');
    const [emailAuthMode, setEmailAuthMode] = useState<EmailAuthMode>('login');
    const [registerPassword, setRegisterPassword] = useState('');
    const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginCredentialMode, setLoginCredentialMode] = useState<LoginCredentialMode>('password');
    const [emailCode, setEmailCode] = useState('');
    const [emailCodeSending, setEmailCodeSending] = useState(false);
    const [passwordResetLoading, setPasswordResetLoading] = useState(false);
    const [resetPassword, setResetPassword] = useState('');
    const [resetPasswordConfirm, setResetPasswordConfirm] = useState('');
    const [mailCodeExpireAt, setMailCodeExpireAt] = useState(() => Number(localStorage.getItem('mail-code-expire') ?? 0));
    const [countdownNow, setCountdownNow] = useState(Date.now());

    const emailCodeSeconds = Math.max(0, Math.ceil((mailCodeExpireAt - countdownNow) / 1000));

    useEffect(() => {
        if (mailCodeExpireAt <= Date.now()) return;
        setCountdownNow(Date.now());
        const timer = window.setInterval(() => setCountdownNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [mailCodeExpireAt]);

    const isPcVariant = variant === 'pc';
    const profilePathAfterLogin = isPcVariant ? '/profile?tab=topup' : '/profile';

    /** PC：`PcLoginDialog` 由父级 state 控制；登录成功若已在 `/profile?tab=topup`，仅 navigate 不会关弹窗 */
    function closePcLoginModal() {
        if (isPcVariant && pcOpts) {
            pcOpts.onRequestClose();
        }
    }

    function finishLogin() {
        // Another login entry may have left the shared prompt open behind this dialog.
        useAuthPromptStore.getState().close();
        if (isPcVariant && pcOpts?.onLoginSuccess) {
            pcOpts.onLoginSuccess();
            return;
        }
        closePcLoginModal();
        navigate(profilePathAfterLogin, { replace: true, state: {} });
    }

    function handleToggleEmailLogin() {
        setEmailAuthMode('login');
        setLoginCredentialMode('password');
        if (isPcVariant) {
            setPcStep('email');
        } else {
            setEmailOpen(!emailOpen);
        }
    }

    function handleOpenEmailRegister() {
        setEmailAuthMode('register');
        if (isPcVariant) {
            setPcStep('email');
        } else {
            setEmailOpen(true);
        }
    }

    function completeEmailAccount(result: { d: { [key: string]: unknown } }, method: 'email' | 'register') {
        const token = String(result.d['token'] ?? '').trim();
        const info = result.d['info'];
        if (!token || info == null || typeof info !== 'object' || Array.isArray(info)) {
            toast.error(intl.formatMessage({ id: 'login_failed' }, { eason: 'Invalid response' }));
            return false;
        }
        localStorage.setItem('token', token);
        localStorage.setItem('email', email.trim());
        localStorage.setItem('login-method', 'email');
        localStorage.removeItem('user-avatar');
        const accountInfo = info as { [key: string]: unknown };
        setIsAnonymousFromInfo(accountInfo);
        userStore.signin(accountInfo);
        pixel.track(method === 'register' ? 'CompleteRegistration' : 'emailLogin');
        setEmailOpen(false);
        setPcStep('email');
        finishLogin();
        return true;
    }

    async function handleRegister() {
        const normalizedEmail = email.trim().toLowerCase();
        if (!emailVerify(normalizedEmail)) return toast.error(intl.formatMessage({ id: 'invalid_email' }));
        if (!/^\d{6}$/.test(emailCode.trim())) {
            return toast.error(intl.formatMessage({ id: 'invalid_email_code' }));
        }
        if (registerPassword.length < 6) {
            return toast.error(intl.formatMessage({ id: 'register_password_invalid', defaultMessage: '密码至少需要 6 位' }));
        }
        if (registerPassword !== registerPasswordConfirm) {
            return toast.error(intl.formatMessage({ id: 'register_password_mismatch', defaultMessage: '两次输入的密码不一致' }));
        }
        if (registerSubmitLoading) return;

        setRegisterSubmitLoading(true);
        try {
            const result = await api<{ [key: string]: unknown }>('login/email', {
                method: 'post',
                loading: false,
                data: {
                    email: normalizedEmail,
                    code: emailCode.trim(),
                    password: registerPassword,
                    password2: registerPasswordConfirm,
                    ...getRegistrationReferralPayload(),
                    ...fromSourceForLogin(),
                },
            });
            if (result.c !== 0) return;
            if (completeEmailAccount(result, 'register')) {
                clearStoredAffiliateReferralCode();
                toast.success(intl.formatMessage({ id: 'register_success', defaultMessage: '注册成功' }));
            }
        } finally {
            setRegisterSubmitLoading(false);
        }
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
        void e;
    }

    function handlePcDialogOutside(e: Event) {
        void e;
    }

    async function handleSubmit() {
        const account = email.trim();
        if (!account) {
            return toast.error(intl.formatMessage({ id: 'account_required', defaultMessage: '请输入账号' }));
        }
        if (loginPassword.length < 6) {
            return toast.error(intl.formatMessage({ id: 'register_password_invalid', defaultMessage: '密码至少需要 6 位' }));
        }
        if (emailSubmitLoading) return;

        setEmailSubmitLoading(true);
        try {
            const result = await api<{ [key: string]: unknown }>('login/email', {
                method: 'post',
                data: {
                    email: account,
                    password: loginPassword,
                    anonymous_id: '',
                    ...fromSourceForLogin(),
                },
                loading: false,
            });
            if (result.c !== 0) return;
            if (completeEmailAccount(result, 'email')) toast.success(intl.formatMessage({ id: 'login_success' }));
        } finally {
            setEmailSubmitLoading(false);
        }
    }

    function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
        setEmail(e.currentTarget.value);
    }

    function handleRegisterPasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
        setRegisterPassword(e.currentTarget.value);
    }

    function handleRegisterPasswordConfirmChange(e: React.ChangeEvent<HTMLInputElement>) {
        setRegisterPasswordConfirm(e.currentTarget.value);
    }

    function handleLoginPasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
        setLoginPassword(e.currentTarget.value);
    }

    function handleResetPasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
        setResetPassword(e.currentTarget.value);
    }

    function handleResetPasswordConfirmChange(e: React.ChangeEvent<HTMLInputElement>) {
        setResetPasswordConfirm(e.currentTarget.value);
    }

    function handleEmailCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
        setEmailCode(e.currentTarget.value.replace(/\D/g, '').slice(0, 6));
    }

    function handleForgotPassword() {
        setLoginCredentialMode('forgot');
    }

    async function handleResetPassword() {
        const normalizedEmail = email.trim().toLowerCase();
        if (!emailVerify(normalizedEmail)) {
            return toast.error(intl.formatMessage({ id: 'invalid_email' }));
        }
        if (!/^\d{6}$/.test(emailCode.trim())) {
            return toast.error(intl.formatMessage({ id: 'invalid_email_code' }));
        }
        if (resetPassword.length < 6) {
            return toast.error(intl.formatMessage({ id: 'register_password_invalid', defaultMessage: '密码至少需要 6 位' }));
        }
        if (resetPassword !== resetPasswordConfirm) {
            return toast.error(intl.formatMessage({ id: 'register_password_mismatch', defaultMessage: '两次输入的密码不一致' }));
        }
        if (passwordResetLoading) return;

        setPasswordResetLoading(true);
        try {
            const result = await api('forget/password', {
                method: 'post',
                loading: false,
                data: {
                    email: normalizedEmail,
                    code: emailCode.trim(),
                    password: resetPassword,
                },
            });
            if (result.c !== 0) return;

            toast.success(intl.formatMessage({
                id: 'password_reset_success',
                defaultMessage: '密码重置成功，请使用新密码登录',
            }));
            setLoginCredentialMode('password');
            setLoginPassword('');
            setEmailCode('');
            setResetPassword('');
            setResetPasswordConfirm('');
        } finally {
            setPasswordResetLoading(false);
        }
    }

    async function handleSendEmailCode() {
        if (emailCodeSending || emailCodeSeconds > 0) return;
        const normalizedEmail = email.trim().toLowerCase();
        if (!emailVerify(normalizedEmail)) {
            return toast.error(intl.formatMessage({ id: 'invalid_email' }));
        }

        setEmailCodeSending(true);
        try {
            const result = await api('login/email/code', {
                method: 'post',
                data: {
                    email: normalizedEmail,
                    scene: emailAuthMode === 'register' ? 'register' : 'reset_password',
                },
                loading: false,
            });
            if (result.c !== 0) return;

            const expireAt = Date.now() + 60_000;
            localStorage.setItem('mail-code-expire', String(expireAt));
            setCountdownNow(Date.now());
            setMailCodeExpireAt(expireAt);
            toast.success(intl.formatMessage({ id: 'email_code_sended' }));
        } finally {
            setEmailCodeSending(false);
        }
    }

    async function handleGoogleSignin() {
        try {
            loadingStore.show();
            const flutter = (window as unknown as {
                flutter_inappwebview?: { callHandler: (name: string, ...args: unknown[]) => Promise<unknown> };
            }).flutter_inappwebview;
            if (!flutter) {
                loadingStore.hide();
                return;
            }
            await flutter.callHandler('googleSignin');
            const detail: {
                uid: string;
                avatar: string;
                email: string;
                name: string;
                anonymous: boolean;
            } = await flutter.callHandler('currentUser') as {
                uid: string;
                avatar: string;
                email: string;
                name: string;
                anonymous: boolean;
            };
            if (!detail.uid) {
                loadingStore.hide();
                return;
            }
            const result = await api('login/uid', {
                method: 'post',
                data: {
                    uid: detail.uid,
                    anonymous_id: '',
                    ...fromSourceForLogin(),
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
            setIsAnonymousFromInfo(info);
            userStore.signin(info);
            toast.success(
                intl.formatMessage({
                    id: 'login_success',
                }),
            );
            loadingStore.hide();
            pixel.track('GoogleLogin');
            finishLogin();
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
                    anonymous_id: '',
                    ...fromSourceForLogin(),
                },
                loading: false,
            });
            if (result2.c !== 0) {
                return;
            }
            if (result2.d == null || typeof result2.d !== 'object') {
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
            setIsAnonymousFromInfo(info);
            userStore.signin(info);
            toast.success(
                intl.formatMessage({
                    id: 'login_success',
                }),
            );
            pixel.track('GoogleLogin');
            finishLogin();
        } catch (error: unknown) {
            const code =
                typeof error === 'object' &&
                error !== null &&
                'code' in error &&
                typeof (error as { code: unknown }).code === 'string'
                    ? (error as { code: string }).code
                    : '';
            const userDismissedPopup =
                code === 'auth/popup-closed-by-user' ||
                code === 'auth/cancelled-popup-request';

            if (!userDismissedPopup) {
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
            }
            /** 弹窗取消/关闭或 OAuth 失败：不清理已有业务 token，避免误登出当前游客/已登录会话 */
        } finally {
            setOauthPopupLoading(false);
        }
    }

    return {
        intl,
        email,
        setEmail,
        emailAuthMode,
        setEmailAuthMode,
        registerPassword,
        registerPasswordConfirm,
        loginPassword,
        loginCredentialMode,
        setLoginCredentialMode,
        emailCode,
        emailCodeSeconds,
        emailCodeSending,
        passwordResetLoading,
        resetPassword,
        resetPasswordConfirm,
        emailOpen,
        setEmailOpen,
        pcStep,
        setPcStep,
        handleToggleEmailLogin,
        handleOpenEmailRegister,
        handleDialogOpenChange,
        handlePcDialogEscape,
        handlePcDialogOutside,
        handleSubmit,
        emailSubmitLoading,
        registerSubmitLoading,
        oauthPopupLoading,
        handleEmailChange,
        handleRegisterPasswordChange,
        handleRegisterPasswordConfirmChange,
        handleLoginPasswordChange,
        handleResetPasswordChange,
        handleResetPasswordConfirmChange,
        handleEmailCodeChange,
        handleForgotPassword,
        handleResetPassword,
        handleSendEmailCode,
        handleRegister,
        handleGoogleSignin,
        handleGoogleSigninPopup,
    };
}

export function PcLoginDialog({
    open,
    onOpenChange,
    onLoginSuccess,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onLoginSuccess?: () => void;
}) {
    const onRequestClose = () => onOpenChange(false);
    const {
        intl,
        email,
        emailAuthMode,
        setEmailAuthMode,
        registerPassword,
        registerPasswordConfirm,
        loginPassword,
        loginCredentialMode,
        setLoginCredentialMode,
        emailCode,
        emailCodeSeconds,
        emailCodeSending,
        passwordResetLoading,
        resetPassword,
        resetPasswordConfirm,
        pcStep,
        handleToggleEmailLogin,
        handleOpenEmailRegister,
        handleDialogOpenChange,
        handlePcDialogEscape,
        handlePcDialogOutside,
        handleSubmit,
        emailSubmitLoading,
        registerSubmitLoading,
        oauthPopupLoading,
        handleEmailChange,
        handleRegisterPasswordChange,
        handleRegisterPasswordConfirmChange,
        handleLoginPasswordChange,
        handleResetPasswordChange,
        handleResetPasswordConfirmChange,
        handleEmailCodeChange,
        handleForgotPassword,
        handleResetPassword,
        handleSendEmailCode,
        handleRegister,
        handleGoogleSignin,
        handleGoogleSigninPopup,
    } = useLoginBase('pc', { onRequestClose, onLoginSuccess });
    const isForgotPassword = emailAuthMode === 'login' && loginCredentialMode === 'forgot';

    const protocolBlock = (
        <div className="LoginModal_protocol__jVDhl">
            <FormattedMessage
                id="protocol"
                values={{
                    tos: (parts: React.ReactNode[]) => (
                        <LegalDocumentLink title="terms_of_service" className="underline">
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
                contentPreset="plain"
                overlayClassName="rs-login-modal__overlay"
                className={cn(
                    'rs-login-modal__dialog rs-login-modal LoginModal_login_modal__oygOe',
                    isForgotPassword && 'rs-login-modal__dialog--forgot',
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
                                <button
                                    type="button"
                                    id="register"
                                    className="LoginModal_login_btn_item__FxNs7 LoginModal_login_btn_item__FxNs7--register"
                                    onClick={handleOpenEmailRegister}
                                >
                                    <div className="LoginModal_login_icon__Huj9u">
                                        <img src={mailPc} alt="" />
                                    </div>
                                    <div className="LoginModal_login_text__3ZrIq">
                                        <FormattedMessage id="register" defaultMessage="注册账号" />
                                    </div>
                                </button>
                            </div>
                            {protocolBlock}
                        </>
                    ) : (
                        <>
                            <h2 className={cn('rs-login-modal__auth-title', isForgotPassword && 'is-forgot')}>
                                {emailAuthMode === 'register'
                                    ? <FormattedMessage id="register" defaultMessage="注册" />
                                    : isForgotPassword
                                        ? <FormattedMessage id="forgot_password_title" defaultMessage="忘记密码" />
                                        : <FormattedMessage id="login" />}
                            </h2>
                            {isForgotPassword ? (
                                <p className="rs-login-modal__auth-subtitle">
                                    <FormattedMessage id="forgot_password_subtitle" defaultMessage="使用邮箱验证码验证身份并设置新密码" />
                                </p>
                            ) : null}
                            <div className="rs-login-modal__email-fields">
                                {isForgotPassword ? (
                                    <div className="rs-login-modal__reset-section-title">
                                        <FormattedMessage id="reset_verify_email" defaultMessage="验证邮箱" />
                                    </div>
                                ) : null}
                                <div className="rs-login-modal__email-field">
                                    <input
                                        className="rs-login-modal__email-input"
                                        type={emailAuthMode === 'login' && loginCredentialMode === 'password' ? 'text' : 'email'}
                                        value={email}
                                        onChange={handleEmailChange}
                                        autoComplete={emailAuthMode === 'login' && loginCredentialMode === 'password' ? 'username' : 'email'}
                                        placeholder={intl.formatMessage(emailAuthMode === 'login' && loginCredentialMode === 'password'
                                            ? { id: 'account_placeholder', defaultMessage: '请输入邮箱或账号' }
                                            : { id: 'email_placeholder' })}
                                        maxLength={30}
                                    />
                                </div>
                                {emailAuthMode === 'register' ? (
                                    <div className="rs-login-modal__email-field rs-login-modal__code-field">
                                        <input
                                            className="rs-login-modal__email-input"
                                            type="text"
                                            inputMode="numeric"
                                            value={emailCode}
                                            onChange={handleEmailCodeChange}
                                            autoComplete="one-time-code"
                                            placeholder={intl.formatMessage({ id: 'code_placeholder' })}
                                            maxLength={6}
                                        />
                                        <button type="button" className="rs-login-modal__email-send" onClick={() => void handleSendEmailCode()} disabled={emailCodeSending || emailCodeSeconds > 0}>
                                            {emailCodeSending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : emailCodeSeconds > 0 ? `${emailCodeSeconds}s` : <FormattedMessage id="send_code" />}
                                        </button>
                                    </div>
                                ) : null}
                                {isForgotPassword ? (
                                    <>
                                        <div className="rs-login-modal__email-field rs-login-modal__code-field">
                                            <input
                                                className="rs-login-modal__email-input"
                                                type="text"
                                                inputMode="numeric"
                                                value={emailCode}
                                                onChange={handleEmailCodeChange}
                                                autoComplete="one-time-code"
                                                placeholder={intl.formatMessage({ id: 'code_placeholder' })}
                                                maxLength={6}
                                            />
                                            <button type="button" className="rs-login-modal__email-send" onClick={() => void handleSendEmailCode()} disabled={emailCodeSending || emailCodeSeconds > 0}>
                                                {emailCodeSending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : emailCodeSeconds > 0 ? `${emailCodeSeconds}s` : <FormattedMessage id="send_code" />}
                                            </button>
                                        </div>
                                        <div className="rs-login-modal__reset-section-title rs-login-modal__reset-section-title--password">
                                            <FormattedMessage id="reset_set_password" defaultMessage="设置新密码" />
                                        </div>
                                        <div className="rs-login-modal__email-field">
                                            <input
                                                className="rs-login-modal__email-input"
                                                type="password"
                                                value={resetPassword}
                                                onChange={handleResetPasswordChange}
                                                autoComplete="new-password"
                                                placeholder={intl.formatMessage({ id: 'reset_password_placeholder', defaultMessage: '请输入新密码（至少 6 位）' })}
                                                maxLength={72}
                                            />
                                        </div>
                                        <div className="rs-login-modal__email-field">
                                            <input
                                                className="rs-login-modal__email-input"
                                                type="password"
                                                value={resetPasswordConfirm}
                                                onChange={handleResetPasswordConfirmChange}
                                                autoComplete="new-password"
                                                placeholder={intl.formatMessage({ id: 'reset_password_confirm_placeholder', defaultMessage: '请再次输入新密码' })}
                                                maxLength={72}
                                            />
                                        </div>
                                    </>
                                ) : null}
                                {emailAuthMode === 'login' ? (
                                    loginCredentialMode === 'forgot' ? null : (
                                        <div className="rs-login-modal__email-field">
                                            <input
                                                className="rs-login-modal__email-input"
                                                type="password"
                                                value={loginPassword}
                                                onChange={handleLoginPasswordChange}
                                                autoComplete="current-password"
                                                placeholder={intl.formatMessage({ id: 'password_placeholder', defaultMessage: '请输入密码' })}
                                                maxLength={72}
                                            />
                                        </div>
                                    )
                                ) : (
                                    <div className="rs-login-modal__email-field">
                                        <input
                                            className="rs-login-modal__email-input"
                                            type="password"
                                            value={registerPassword}
                                            onChange={handleRegisterPasswordChange}
                                            autoComplete="new-password"
                                            placeholder={intl.formatMessage({ id: 'register_password_placeholder', defaultMessage: '请输入密码（至少 6 位）' })}
                                            maxLength={72}
                                        />
                                    </div>
                                )}
                                {emailAuthMode === 'register' ? (
                                    <div className="rs-login-modal__email-field">
                                        <input
                                            className="rs-login-modal__email-input"
                                            type="password"
                                            value={registerPasswordConfirm}
                                            onChange={handleRegisterPasswordConfirmChange}
                                            autoComplete="new-password"
                                            placeholder={intl.formatMessage({ id: 'register_password_confirm_placeholder', defaultMessage: '请再次输入密码' })}
                                            maxLength={72}
                                        />
                                    </div>
                                ) : null}
                            </div>
                            {emailAuthMode === 'login' && !isForgotPassword ? (
                                <div className="rs-login-modal__login-links">
                                    <button type="button" onClick={handleForgotPassword}>
                                        <FormattedMessage id="forgot_password" defaultMessage="忘记密码？" />
                                    </button>
                                </div>
                            ) : null}
                            <button
                                type="button"
                                className="rs-login-modal__email-submit inline-flex items-center justify-center gap-2"
                                disabled={emailSubmitLoading || registerSubmitLoading || passwordResetLoading}
                                aria-busy={emailSubmitLoading || registerSubmitLoading || passwordResetLoading}
                                onClick={() => void (isForgotPassword ? handleResetPassword() : emailAuthMode === 'login' ? handleSubmit() : handleRegister())}
                            >
                                {emailSubmitLoading || registerSubmitLoading || passwordResetLoading ? (
                                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                                ) : null}
                                {emailAuthMode === 'register'
                                    ? <FormattedMessage id="register" defaultMessage="注册" />
                                    : isForgotPassword
                                        ? <FormattedMessage id="reset_password" defaultMessage="重置密码" />
                                        : <FormattedMessage id="login" />}
                            </button>
                            {!isForgotPassword ? (
                                <>
                                    <div className="rs-login-modal__or"><span>{intl.formatMessage({ id: 'or', defaultMessage: '或' })}</span></div>
                                    <button
                                        type="button"
                                        className={cn(
                                            'LoginModal_login_btn_item__FxNs7 LoginModal_login_btn_item__FxNs7--google rs-login-modal__google-below',
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
                                        <div className="LoginModal_login_icon__Huj9u"><img src={loginPcGoogle} alt="" /></div>
                                        <div className="LoginModal_login_text__3ZrIq"><FormattedMessage id="login_google" /></div>
                                    </button>
                                    {protocolBlock}
                                </>
                            ) : null}
                            <div className="rs-login-modal__account-switch">
                                {emailAuthMode === 'register'
                                    ? <><FormattedMessage id="already_have_account" defaultMessage="已有账号？" /> <button type="button" onClick={() => { setEmailAuthMode('login'); setLoginCredentialMode('password'); }}><FormattedMessage id="login" /></button></>
                                    : isForgotPassword
                                        ? <><FormattedMessage id="remembered_password" defaultMessage="想起密码了？" /> <button type="button" onClick={() => setLoginCredentialMode('password')}><FormattedMessage id="back_to_login" defaultMessage="返回登录" /></button></>
                                        : <><FormattedMessage id="no_account" defaultMessage="还没有账号？" /> <button type="button" onClick={() => setEmailAuthMode('register')}><FormattedMessage id="register" defaultMessage="注册" /></button></>}
                            </div>
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
        emailAuthMode,
        setEmailAuthMode,
        registerPassword,
        registerPasswordConfirm,
        loginPassword,
        loginCredentialMode,
        setLoginCredentialMode,
        emailCode,
        emailCodeSeconds,
        emailCodeSending,
        passwordResetLoading,
        resetPassword,
        resetPasswordConfirm,
        handleSubmit,
        emailSubmitLoading,
        registerSubmitLoading,
        oauthPopupLoading,
        handleEmailChange,
        handleRegisterPasswordChange,
        handleRegisterPasswordConfirmChange,
        handleLoginPasswordChange,
        handleResetPasswordChange,
        handleResetPasswordConfirmChange,
        handleEmailCodeChange,
        handleForgotPassword,
        handleResetPassword,
        handleSendEmailCode,
        handleRegister,
        handleGoogleSignin,
        handleGoogleSigninPopup,
    } = useLoginBase('h5');
    const isForgotPassword = emailAuthMode === 'login' && loginCredentialMode === 'forgot';

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
                    <h1 className={cn('rs-login__authTitle', isForgotPassword && 'is-forgot')}>
                        {emailAuthMode === 'register'
                            ? <FormattedMessage id="register" defaultMessage="注册" />
                            : isForgotPassword
                                ? <FormattedMessage id="forgot_password_title" defaultMessage="忘记密码" />
                                : <FormattedMessage id="login" />}
                    </h1>
                    {isForgotPassword ? (
                        <p className="rs-login__authSubtitle">
                            <FormattedMessage id="forgot_password_subtitle" defaultMessage="使用邮箱验证码验证身份并设置新密码" />
                        </p>
                    ) : null}

                    <div className="rs-login__inlineAuth">
                        {isForgotPassword ? (
                            <div className="rs-login__resetSectionTitle">
                                <FormattedMessage id="reset_verify_email" defaultMessage="验证邮箱" />
                            </div>
                        ) : null}
                        <div className="rs-login__drawerField">
                            <input
                                onChange={handleEmailChange}
                                value={email}
                                type={emailAuthMode === 'login' && loginCredentialMode === 'password' ? 'text' : 'email'}
                                autoComplete={emailAuthMode === 'login' && loginCredentialMode === 'password' ? 'username' : 'email'}
                                autoFocus
                                maxLength={30}
                                className="rs-login__drawerInput"
                                placeholder={intl.formatMessage(emailAuthMode === 'login' && loginCredentialMode === 'password'
                                    ? { id: 'account_placeholder', defaultMessage: '请输入邮箱或账号' }
                                    : { id: 'email_placeholder' })}
                            />
                        </div>
                        {emailAuthMode === 'register' ? (
                            <div className="rs-login__drawerField rs-login__codeField">
                                <input
                                    onChange={handleEmailCodeChange}
                                    value={emailCode}
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    maxLength={6}
                                    className="rs-login__drawerInput"
                                    placeholder={intl.formatMessage({ id: 'code_placeholder' })}
                                />
                                <button type="button" className="rs-login__drawerSend" onClick={() => void handleSendEmailCode()} disabled={emailCodeSending || emailCodeSeconds > 0}>
                                    {emailCodeSending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : emailCodeSeconds > 0 ? `${emailCodeSeconds}s` : <FormattedMessage id="send_code" />}
                                </button>
                            </div>
                        ) : null}
                        {isForgotPassword ? (
                            <>
                                <div className="rs-login__drawerField rs-login__codeField">
                                    <input
                                        onChange={handleEmailCodeChange}
                                        value={emailCode}
                                        type="text"
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                        maxLength={6}
                                        className="rs-login__drawerInput"
                                        placeholder={intl.formatMessage({ id: 'code_placeholder' })}
                                    />
                                    <button type="button" className="rs-login__drawerSend" onClick={() => void handleSendEmailCode()} disabled={emailCodeSending || emailCodeSeconds > 0}>
                                        {emailCodeSending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : emailCodeSeconds > 0 ? `${emailCodeSeconds}s` : <FormattedMessage id="send_code" />}
                                    </button>
                                </div>
                                <div className="rs-login__resetSectionTitle rs-login__resetSectionTitle--password">
                                    <FormattedMessage id="reset_set_password" defaultMessage="设置新密码" />
                                </div>
                                <div className="rs-login__drawerField">
                                    <input
                                        onChange={handleResetPasswordChange}
                                        value={resetPassword}
                                        type="password"
                                        autoComplete="new-password"
                                        maxLength={72}
                                        className="rs-login__drawerInput"
                                        placeholder={intl.formatMessage({ id: 'reset_password_placeholder', defaultMessage: '请输入新密码（至少 6 位）' })}
                                    />
                                </div>
                                <div className="rs-login__drawerField">
                                    <input
                                        onChange={handleResetPasswordConfirmChange}
                                        value={resetPasswordConfirm}
                                        type="password"
                                        autoComplete="new-password"
                                        maxLength={72}
                                        className="rs-login__drawerInput"
                                        placeholder={intl.formatMessage({ id: 'reset_password_confirm_placeholder', defaultMessage: '请再次输入新密码' })}
                                    />
                                </div>
                            </>
                        ) : null}
                        {isForgotPassword ? null : (
                            <div className="rs-login__drawerField">
                                <input
                                    onChange={emailAuthMode === 'login' ? handleLoginPasswordChange : handleRegisterPasswordChange}
                                    value={emailAuthMode === 'login' ? loginPassword : registerPassword}
                                    type="password"
                                    autoComplete={emailAuthMode === 'login' ? 'current-password' : 'new-password'}
                                    maxLength={72}
                                    className="rs-login__drawerInput"
                                    placeholder={intl.formatMessage({ id: emailAuthMode === 'login' ? 'password_placeholder' : 'register_password_placeholder', defaultMessage: emailAuthMode === 'login' ? '请输入密码' : '请输入密码（至少 6 位）' })}
                                />
                            </div>
                        )}
                        {emailAuthMode === 'register' ? (
                            <div className="rs-login__drawerField">
                                <input onChange={handleRegisterPasswordConfirmChange} value={registerPasswordConfirm} type="password" autoComplete="new-password" maxLength={72} className="rs-login__drawerInput" placeholder="请再次输入密码" />
                            </div>
                        ) : null}
                        {emailAuthMode === 'login' && !isForgotPassword ? (
                            <div className="rs-login__loginLinks">
                                <button type="button" onClick={handleForgotPassword}>
                                    <FormattedMessage id="forgot_password" defaultMessage="忘记密码？" />
                                </button>
                            </div>
                        ) : null}
                        <Button className="rs-login__submit" onClick={() => void (isForgotPassword ? handleResetPassword() : emailAuthMode === 'login' ? handleSubmit() : handleRegister())} disabled={emailSubmitLoading || registerSubmitLoading || passwordResetLoading}>
                            {emailSubmitLoading || registerSubmitLoading || passwordResetLoading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
                            {emailAuthMode === 'register'
                                ? <FormattedMessage id="register" defaultMessage="注册" />
                                : isForgotPassword
                                    ? <FormattedMessage id="reset_password" defaultMessage="重置密码" />
                                    : <FormattedMessage id="login" />}
                        </Button>
                        {!isForgotPassword ? (
                            <>
                                <div className="rs-login__divider"><span>或</span></div>
                                <div
                                    id="google"
                                    className={cn(
                                        'LoginPage_login_btn_item__OkeV1 rs-login__btn',
                                        oauthPopupLoading && 'pointer-events-none opacity-60',
                                    )}
                                    role="button"
                                    tabIndex={oauthPopupLoading ? -1 : 0}
                                    onClick={() => {
                                        if (oauthPopupLoading) return;
                                        if ((window as unknown as { flutter_inappwebview?: unknown }).flutter_inappwebview !== undefined) {
                                            void handleGoogleSignin();
                                        } else {
                                            void handleGoogleSigninPopup();
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (oauthPopupLoading) return;
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            if ((window as unknown as { flutter_inappwebview?: unknown }).flutter_inappwebview !== undefined) {
                                                void handleGoogleSignin();
                                            } else {
                                                void handleGoogleSigninPopup();
                                            }
                                        }
                                    }}
                                >
                                    <div className="LoginPage_login_icon__XK3jz"><img src={google} alt="" /></div>
                                    <div className="LoginPage_login_text__NWSSM"><FormattedMessage id="login_google" /></div>
                                </div>
                            </>
                        ) : null}
                    </div>

                    {!isForgotPassword ? <div className="LoginPage_protocol__aQxLZ rs-login__protocol">
                        <FormattedMessage
                            id="protocol"
                            values={{
                                tos: (parts: React.ReactNode[]) => (
                                    <LegalDocumentLink title="terms_of_service" className="underline">
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
                    </div> : null}
                    <div className="rs-login__accountSwitch">
                        {emailAuthMode === 'register'
                            ? <><FormattedMessage id="already_have_account" defaultMessage="已有账号？" /> <button type="button" onClick={() => { setEmailAuthMode('login'); setLoginCredentialMode('password'); }}><FormattedMessage id="login" /></button></>
                            : isForgotPassword
                                ? <><FormattedMessage id="remembered_password" defaultMessage="想起密码了？" /> <button type="button" onClick={() => setLoginCredentialMode('password')}><FormattedMessage id="back_to_login" defaultMessage="返回登录" /></button></>
                                : <><FormattedMessage id="no_account" defaultMessage="还没有账号？" /> <button type="button" onClick={() => setEmailAuthMode('register')}><FormattedMessage id="register" defaultMessage="注册" /></button></>}
                    </div>
                </div>
            </div>
        </div>
    );
}
