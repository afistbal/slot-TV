import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
    Bell,
    BellRing,
    ChevronRight,
    Coins,
    FileText,
    Loader2,
    LockKeyhole,
    Mail,
    ShieldCheck,
    Trash2,
    UserRound,
} from 'lucide-react';
import { toast } from 'sonner';

import { api, formatApiFailure } from '@/api';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { AutoUnlockNextSwitch } from '@/components/AutoUnlockNextSwitch';
import { useMinWidth768 } from '@/hooks/useMinWidth768';
import {
    disableLuckyPushSubscription,
    enableLuckyPushSubscription,
    getLuckyPushStatus,
    type LuckyPushStatus,
} from '@/lib/luckyPushSubscription';
import { logoutToAnonymousSession } from '@/lib/logoutToAnonymousSession';
import { getUserUidForDisplay } from '@/lib/formatUserUniqueIdForDisplay';
import { Page } from '@/layouts/user';
import { useUserStore } from '@/stores/user';
import { PcLoginDialog } from '@/pages/user/Login';
import '@/styles/settings-reelshort.scss';

function readBoolean(value: unknown, fallback: boolean): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
        if (['1', 'true', 'yes', 'on'].includes(value.toLowerCase())) return true;
        if (['0', 'false', 'no', 'off'].includes(value.toLowerCase())) return false;
    }
    return fallback;
}

function SettingSwitch({
    checked,
    disabled,
    label,
    onClick,
}: {
    checked: boolean;
    disabled?: boolean;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            className={`rs-settings__switch${checked ? ' is-on' : ''}`}
            disabled={disabled}
            onClick={onClick}
        >
            <span />
        </button>
    );
}

export default function SettingsPage() {
    const navigate = useNavigate();
    const isPc = useMinWidth768();
    const userStore = useUserStore();
    const info = userStore.info ?? {};
    const locale = String(localStorage.getItem('locale') ?? 'zh-CN');
    const isTraditional = locale.toLowerCase().startsWith('zh-tw');
    const isChinese = locale.toLowerCase().startsWith('zh');
    const text = (cn: string, en: string, tw = cn) => isChinese ? (isTraditional ? tw : cn) : en;

    const emailOptOut = readBoolean(info.email_optout ?? info.emailOptout, false);
    const [emailNotifications, setEmailNotifications] = useState(!emailOptOut);
    const [emailBusy, setEmailBusy] = useState(false);
    const [pushStatus, setPushStatus] = useState<LuckyPushStatus>('disabled');
    const [pushLoading, setPushLoading] = useState(true);
    const [pushBusy, setPushBusy] = useState(false);
    const [resetOpen, setResetOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const uid = getUserUidForDisplay(info);
    const email = String(info.email ?? info.email_norm ?? localStorage.getItem('email') ?? '').trim();
    const pushEnabled = pushStatus === 'enabled';
    const pushDisabled = pushStatus === 'blocked' || pushStatus === 'unsupported';
    const pushStatusLabel = (() => {
        if (pushLoading) return text('检测中…', 'Checking…', '檢測中…');
        if (pushStatus === 'enabled') return text('已开启', 'Enabled', '已開啟');
        if (pushStatus === 'blocked') return text('已被浏览器禁用', 'Blocked by browser', '已被瀏覽器停用');
        if (pushStatus === 'unsupported') return text('当前浏览器不支持', 'Not supported', '目前瀏覽器不支援');
        return text('未开启', 'Off', '未開啟');
    })();

    useEffect(() => {
        let active = true;
        void getLuckyPushStatus()
            .then((status) => { if (active) setPushStatus(status); })
            .catch(() => { if (active) setPushStatus('disabled'); })
            .finally(() => { if (active) setPushLoading(false); });
        return () => { active = false; };
    }, []);

    function openPasswordReset() {
        if (email) localStorage.setItem('email', email);
        if (isPc) {
            setResetOpen(true);
            return;
        }
        navigate('/page/login?mode=reset');
    }

    async function toggleEmailNotifications() {
        if (emailBusy) return;
        const next = !emailNotifications;
        setEmailBusy(true);
        const result = await api('user/settings', {
            method: 'post',
            loading: false,
            toastOnError: false,
            data: { email_optout: !next },
        });
        setEmailBusy(false);
        if (result.c !== 0) {
            toast.error(formatApiFailure('POST', 'user/settings', result));
            return;
        }
        setEmailNotifications(next);
        userStore.update({ email_optout: !next });
        toast.success(next
            ? text('已开启邮件通知', 'Email notifications enabled', '已開啟郵件通知')
            : text('已关闭邮件通知', 'Email notifications disabled', '已關閉郵件通知'));
    }

    async function togglePush() {
        if (pushBusy || pushLoading || pushDisabled) return;
        setPushBusy(true);
        try {
            if (pushEnabled) {
                await disableLuckyPushSubscription();
                setPushStatus('disabled');
                toast.success(text('已关闭浏览器推送', 'Browser notifications disabled', '已關閉瀏覽器推送'));
            } else {
                await enableLuckyPushSubscription();
                setPushStatus('enabled');
                toast.success(text('浏览器推送已开启', 'Browser notifications enabled', '瀏覽器推送已開啟'));
            }
        } catch (reason) {
            toast.error(reason instanceof Error ? reason.message : String(reason));
            setPushStatus(await getLuckyPushStatus().catch((): LuckyPushStatus => 'disabled'));
        } finally {
            setPushBusy(false);
        }
    }

    async function deleteAccount() {
        if (deleting) return;
        setDeleting(true);
        const result = await api('user/delete', {
            method: 'post',
            loading: false,
            toastOnError: false,
        });
        if (result.c !== 0) {
            setDeleting(false);
            toast.error(formatApiFailure('POST', 'user/delete', result));
            return;
        }

        localStorage.removeItem('email');
        localStorage.removeItem('mail-code-expire');
        await logoutToAnonymousSession();
        toast.success(text('账户已删除', 'Account deleted', '帳戶已刪除'));
        navigate('/', { replace: true });
    }

    return (
        <Page title="settings" bodyClassName="rs-settings-page" constrained>
            <main className="rs-settings">
                <section className="rs-settings__card">
                    <h2><UserRound aria-hidden />{text('个人资料', 'Profile', '個人資料')}</h2>
                    <div className="rs-settings__info-row">
                        <span>{text('账号', 'Account', '帳號')}</span>
                        <strong>{email || uid || '-'}</strong>
                    </div>
                    {uid ? <div className="rs-settings__info-row"><span>UID</span><strong>{uid}</strong></div> : null}
                </section>

                <section className="rs-settings__card">
                    <h2><ShieldCheck aria-hidden />{text('账户安全', 'Account security', '帳戶安全')}</h2>
                    <div className="rs-settings__action-row">
                        <span className="rs-settings__row-icon"><LockKeyhole aria-hidden /></span>
                        <span className="rs-settings__row-copy">
                            <strong>{text('登录密码', 'Login password', '登入密碼')}</strong>
                            <small>{text('使用邮箱验证码验证身份并设置新密码', 'Verify your email and set a new password', '使用信箱驗證碼驗證身分並設定新密碼')}</small>
                        </span>
                        <button type="button" className="rs-settings__outline-button" onClick={openPasswordReset}>
                            {text('重置密码', 'Reset password', '重設密碼')}
                        </button>
                    </div>
                </section>

                <section className="rs-settings__card rs-settings__auto-payment">
                    <h2><Coins aria-hidden />{text('自动付费', 'Automatic payment', '自動付費')}</h2>
                    <AutoUnlockNextSwitch key={String(userStore.info?.id)} />
                </section>

                <section className="rs-settings__card">
                    <h2><Bell aria-hidden />{text('通知偏好', 'Notifications', '通知偏好')}</h2>
                    <div className="rs-settings__preference-row">
                        <span className="rs-settings__row-icon"><Mail aria-hidden /></span>
                        <span className="rs-settings__row-copy">
                            <strong>{text('邮件通知', 'Email notifications', '郵件通知')}</strong>
                            <small>{text('追剧更新、新剧推荐与优惠提醒；关闭后不再发送营销邮件', 'Updates, recommendations and offers; turn off to stop marketing emails', '追劇更新、新劇推薦與優惠提醒；關閉後不再傳送行銷郵件')}</small>
                        </span>
                        {emailBusy ? <Loader2 className="rs-settings__spinner" aria-hidden /> : (
                            <SettingSwitch checked={emailNotifications} label={text('邮件通知', 'Email notifications', '郵件通知')} onClick={() => void toggleEmailNotifications()} />
                        )}
                    </div>
                    <div className="rs-settings__preference-row">
                        <span className="rs-settings__row-icon"><BellRing aria-hidden /></span>
                        <span className="rs-settings__row-copy">
                            <strong>{text('浏览器推送', 'Browser notifications', '瀏覽器推送')}</strong>
                            <small>{text('追剧更新、奖励与账户消息等即时通知', 'Instant updates, rewards and account messages', '追劇更新、獎勵與帳戶訊息等即時通知')}</small>
                        </span>
                        <span className="rs-settings__push-control">
                            {pushBusy || pushLoading ? <Loader2 className="rs-settings__spinner" aria-hidden /> : (
                                <button
                                    type="button"
                                    className={`rs-settings__push-button${pushEnabled ? ' is-on' : ''}`}
                                    disabled={pushDisabled}
                                    onClick={() => void togglePush()}
                                >
                                    {pushStatusLabel}
                                </button>
                            )}
                        </span>
                    </div>
                </section>

                <section className="rs-settings__card rs-settings__privacy">
                    <h2><ShieldCheck aria-hidden />{text('隐私与数据', 'Privacy and data', '隱私與資料')}</h2>
                    <p>{text(
                        '我们仅收集账号运行所需的数据，包括观看进度、解锁与充值记录，以及用于排障和防作弊的设备与网络环境信息。',
                        'We collect only the data needed to operate your account, including watch progress, unlock and purchase records, and device data used for security and troubleshooting.',
                        '我們僅收集帳戶運作所需的資料，包括觀看進度、解鎖與儲值記錄，以及用於除錯和防作弊的裝置與網路環境資訊。',
                    )}</p>
                    <nav className="rs-settings__legal-links">
                        <Link to="/page/text?title=privacy_policy"><FileText aria-hidden /><span>{text('隐私政策', 'Privacy policy', '隱私政策')}</span><ChevronRight aria-hidden /></Link>
                        <Link to="/page/text?title=terms_of_service"><FileText aria-hidden /><span>{text('服务条款', 'Terms of service', '服務條款')}</span><ChevronRight aria-hidden /></Link>
                    </nav>
                    <div className="rs-settings__delete-row">
                        <span><strong>{text('删除账户', 'Delete account', '刪除帳戶')}</strong><small>{text('永久删除账户及全部数据', 'Permanently delete your account and all data', '永久刪除帳戶及全部資料')}</small></span>
                        <button type="button" onClick={() => setDeleteOpen(true)}><Trash2 aria-hidden />{text('删除账户', 'Delete', '刪除帳戶')}</button>
                    </div>
                </section>
            </main>

            {resetOpen ? (
                <PcLoginDialog
                    open
                    initialCredentialMode="forgot"
                    onOpenChange={setResetOpen}
                    onLoginSuccess={() => setResetOpen(false)}
                />
            ) : null}

            <Dialog open={deleteOpen} onOpenChange={(next) => { if (!deleting) setDeleteOpen(next); }}>
                <DialogContent contentPreset="plain" className="rs-settings__delete-dialog">
                    <DialogTitle>{text('确定删除账户？', 'Delete this account?', '確定刪除帳戶？')}</DialogTitle>
                    <DialogDescription>{text(
                        '账户、观看记录、余额和会员权益将被永久删除，且无法恢复。',
                        'Your account, watch history, balance and membership benefits will be permanently deleted and cannot be recovered.',
                        '帳戶、觀看記錄、餘額和會員權益將被永久刪除，且無法復原。',
                    )}</DialogDescription>
                    <div className="rs-settings__delete-actions">
                        <button type="button" onClick={() => setDeleteOpen(false)} disabled={deleting}>{text('取消', 'Cancel', '取消')}</button>
                        <button type="button" className="is-danger" onClick={() => void deleteAccount()} disabled={deleting}>
                            {deleting ? <Loader2 className="rs-settings__spinner" aria-hidden /> : <Trash2 aria-hidden />}
                            {deleting ? text('正在删除…', 'Deleting…', '正在刪除…') : text('永久删除', 'Delete permanently', '永久刪除')}
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </Page>
    );
}
