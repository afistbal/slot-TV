import { useCallback, useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { claimLuckyTask, finishLuckyExternalTask, getCachedLuckyPage, getLuckyPage, getLuckyTaskAction, type LuckyPageData, type LuckySocialActionKind, type LuckyTask } from '@/api/lucky';
import { LuckyAccountDialogs } from '@/components/LuckyAccountDialogs';
import { LuckyRatingSheet } from '@/components/LuckyRatingSheet';
import { LuckyIcon } from '@/components/LuckyIcon';
import { ReelShortFooter } from '@/components/ReelShortFooter';
import { ReelShortTopNav } from '@/components/ReelShortTopNav';
import { createLuckyDemoData } from '@/data/luckyDemo';
import { enableLuckyPushSubscription, type LuckyPushProgress } from '@/lib/luckyPushSubscription';
import { useRootStore } from '@/stores/root';
import { useLuckyStore } from '@/stores/lucky';
import '@/styles/lucky.scss';

const SOCIAL_TASK_STORAGE_KEY = 'lucky:pending-social-task';
const SOCIAL_TASK_MAX_AGE_MS = 30 * 60 * 1000;
type PendingSocialTask = { key: 'bind_x' | 'follow_x' | 'join_tg'; kind: LuckySocialActionKind; startedAt: number };

function readPendingSocialTask(): PendingSocialTask | null {
    try {
        const value = JSON.parse(sessionStorage.getItem(SOCIAL_TASK_STORAGE_KEY) ?? 'null') as Partial<PendingSocialTask> | null;
        if (!value || !['bind_x', 'follow_x', 'join_tg'].includes(value.key ?? '')
            || !['x-oauth', 'x-follow', 'telegram-bind', 'telegram-channel'].includes(value.kind ?? '')
            || typeof value.startedAt !== 'number' || Date.now() - value.startedAt > SOCIAL_TASK_MAX_AGE_MS) {
            sessionStorage.removeItem(SOCIAL_TASK_STORAGE_KEY);
            return null;
        }
        return value as PendingSocialTask;
    } catch {
        sessionStorage.removeItem(SOCIAL_TASK_STORAGE_KEY);
        return null;
    }
}

function rememberPendingSocialTask(task: PendingSocialTask): void {
    sessionStorage.setItem(SOCIAL_TASK_STORAGE_KEY, JSON.stringify(task));
}

function clearPendingSocialTask(): void {
    sessionStorage.removeItem(SOCIAL_TASK_STORAGE_KEY);
}

function xOAuthReturnUrl(): string {
    return new URL('/lucky', window.location.origin).href;
}

function TaskRows({ rows, busy, onAction, label }: { rows: LuckyTask[]; busy: string; onAction: (task: LuckyTask) => void; label: (text: string) => string }) {
    return <ul className="lucky-task-grid">{rows.map((task) => <li key={task.key} className={`lucky-task${task.done ? ' lucky-task--done' : ''}`}>
        <span className="lucky-task__icon"><LuckyIcon name={task.done ? 'check' : task.icon} size={15} /></span>
        <span className="lucky-task__copy"><strong>{label(task.title)}</strong><small><b>+{task.done ? task.earned ?? task.coins : task.coins}</b>{task.description ? ` · ${label(task.description)}` : ''}</small></span>
        {task.xUsed ? <span /> : task.done ? <span className="lucky-task__done">{label('lucky_claimed')}</span> : <button type="button" className={`lucky-task__button${task.action === 'claim' ? ' is-claim' : ''}`} disabled={Boolean(busy)} onClick={() => onAction(task)}>{busy === task.key ? label('lucky_claiming') : label(task.action === 'claim' ? 'lucky_claim' : 'lucky_go')}</button>}
    </li>)}</ul>;
}

export default function Lucky() {
    const intl = useIntl();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const preview = searchParams.get('demo') === '1';
    const [ratingOpen, setRatingOpen] = useState(searchParams.has('rate'));
    useEffect(() => { if (searchParams.has('rate')) setRatingOpen(true); }, [searchParams]);
    const sessionReady = useRootStore((store) => store.sessionBootstrapReady);
    const scrollRef = useRef<HTMLDivElement>(null);
    const dailyRef = useRef<HTMLElement>(null);
    const busyRef = useRef(false);
    const checkingSocialTask = useRef(false);
    const activeRef = useRef(true);
    const loadSequenceRef = useRef(0);
    const initialResultRef = useRef(preview ? undefined : getCachedLuckyPage(intl.locale));
    const initialResult = initialResultRef.current;
    const initialData = preview ? createLuckyDemoData() : initialResult?.data ?? null;
    const dataRef = useRef<LuckyPageData | null>(initialData);
    const [data, setData] = useState<LuckyPageData | null>(initialData);
    const [loading, setLoading] = useState(!preview && !initialResult);
    const [accountDialog, setAccountDialog] = useState<'level' | null>(null);
    const revision = useLuckyStore(store => store.revision);
    const progressError = useLuckyStore(store => store.progressError);
    const [taskError, setTaskError] = useState('');
    const [demo, setDemo] = useState(preview || Boolean(initialResult?.demo));
    const [busy, setBusy] = useState('');
    const [pushProgress, setPushProgress] = useState<LuckyPushProgress | null>(null);
    const label = useCallback((text: string) => Object.prototype.hasOwnProperty.call(intl.messages, text) ? intl.formatMessage({ id: text }) : text, [intl]);
    const w = useCallback((cn: string, tw = cn) => intl.locale === 'zh-TW' ? tw : cn, [intl.locale]);

    const load = useCallback(async (silent = false, force = false) => {
        const loadSequence = ++loadSequenceRef.current;
        const sessionToken = localStorage.getItem('token');
        if (preview) { const next = createLuckyDemoData(); dataRef.current = next; setData(next); setDemo(true); setLoading(false); return; }
        if (!silent && !dataRef.current) setLoading(true);
        const result = await getLuckyPage(createLuckyDemoData, intl.locale, force);
        if (!activeRef.current || loadSequence !== loadSequenceRef.current || sessionToken !== localStorage.getItem('token')) return;
        dataRef.current = result.data; setData(result.data); setDemo(result.demo); setLoading(false);
    }, [preview, intl.locale]);

    useEffect(() => {
        activeRef.current = true;
        if (preview) void load(Boolean(dataRef.current));
        else if (sessionReady) {
            // Share the layout's in-flight request / fresh snapshot. Claims and
            // other task changes invalidate the cache or explicitly force load.
            void load(Boolean(dataRef.current));
        }
        return () => { activeRef.current = false; };
    }, [load, preview, sessionReady, revision]);
    useEffect(() => {
        async function onReturn() {
            if (document.visibilityState !== 'visible' || checkingSocialTask.current) return;
            const pending = readPendingSocialTask();
            if (!pending) return;
            checkingSocialTask.current = true;
            setBusy(pending.key);
            setTaskError('');
            try {
                await finishLuckyExternalTask(pending.key);
                if (!activeRef.current) return;
                if (pending.kind === 'x-oauth') toast.info(w('X 账号绑定状态已刷新', 'X 帳號綁定狀態已重新整理'));
                if (pending.kind === 'x-follow') toast.info(w('正在核验 X 关注状态', '正在核驗 X 關注狀態'));
                if (pending.kind === 'telegram-bind') toast.info(w('Telegram 账号绑定后，请再次点击任务加入频道', 'Telegram 帳號綁定後，請再次點擊任務加入頻道'));
                if (pending.kind === 'telegram-channel') toast.info(w('正在核验 Telegram 频道成员身份', '正在核驗 Telegram 頻道成員身分'));
                await load(true);
            } catch (reason) {
                const message = reason instanceof Error ? reason.message : String(reason);
                if (activeRef.current) setTaskError(message);
            } finally {
                clearPendingSocialTask();
                checkingSocialTask.current = false;
                if (activeRef.current) setBusy('');
            }
        }
        document.addEventListener('visibilitychange', onReturn);
        window.addEventListener('focus', onReturn);
        void onReturn();
        return () => { document.removeEventListener('visibilitychange', onReturn); window.removeEventListener('focus', onReturn); };
    }, [load, w]);

    function visit(to: string) {
        if (to === '/lucky#daily') { dailyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
        if (to.startsWith('/lucky?rate=')) { setRatingOpen(true); return; }
        if (to.startsWith('/') && !to.startsWith('//')) navigate(to);
    }

    async function handleTask(task: LuckyTask) {
        if (task.done || busyRef.current) return;
        if (task.key === 'rating') { setRatingOpen(true); return; }
        if (task.action === 'go' && task.to) { visit(task.to); return; }
        if (demo) { toast.info(w('演示模式仅预览，不提交任务或发放真实奖励。', '示範模式僅供預覽，不提交任務或發放真實獎勵。')); return; }
        busyRef.current = true; setBusy(task.key); setTaskError('');
        let popup: Window | null = null;
        try {
            if (task.key === 'push_on' && !task.ready) {
                await enableLuckyPushSubscription(undefined, setPushProgress);
                setPushProgress(null);
                toast.success(w('推送通知已开启，请领取新手奖励', '推送通知已開啟，請領取新手獎勵'));
                await load(true, true);
            } else if (task.action === 'claim') {
                const result = await claimLuckyTask(task);
                if (result.restricted) throw new Error(w('当前账号暂不能领取奖励', '目前帳號暫不能領取獎勵'));
                if (result.notYet) throw new Error(w('任务尚未完成，请完成后再领取', '任務尚未完成，請完成後再領取'));
                if (result.xUsed) throw new Error(w('该 X 账号已领取过奖励', '此 X 帳號已領取過獎勵'));
                if (result.already) toast.info(label('lucky_claimed'));
                else {
                    toast.success(result.coins === undefined ? w('领取成功', '領取成功') : intl.formatMessage({ id: 'lucky_claim_success' }, { coins: result.coins }));
                    if ((result.milestoneCoins ?? 0) > 0) toast.success(w(`里程碑额外奖励 +${result.milestoneCoins} 币`, `里程碑額外獎勵 +${result.milestoneCoins} 幣`));
                }
                // The claim response is only the result of this attempt. Pull the
                // authoritative task state again before updating labels/badges.
                await load(true, true);
            } else {
                // X OAuth follows the source site's same-tab account-link flow. X follow and
                // Telegram keep this page open so focus/visibility can trigger server verification.
                if (task.key !== 'bind_x') {
                    popup = window.open('about:blank', '_blank');
                    if (popup) popup.opener = null;
                }
                const result = await getLuckyTaskAction(task, xOAuthReturnUrl());
                const url = new URL(result.url);
                if (url.protocol !== 'https:') throw new Error(w('任务链接必须使用 HTTPS', '任務連結必須使用 HTTPS'));
                rememberPendingSocialTask({ key: task.key as PendingSocialTask['key'], kind: result.kind, startedAt: Date.now() });
                if (result.kind === 'x-oauth') {
                    window.location.assign(url.href);
                    return;
                }
                if (!popup) {
                    clearPendingSocialTask();
                    throw new Error(w('请允许弹窗后重试', '請允許彈窗後重試'));
                }
                popup.location.replace(url.href); popup = null;
            }
        } catch (reason) {
            popup?.close();
            const message = reason instanceof Error ? reason.message : String(reason);
            setTaskError(message); toast.error(message);
        } finally { busyRef.current = false; if (activeRef.current) { setBusy(''); setPushProgress(null); } }
    }

    const left = data ? Math.max(0, data.daily.total - data.daily.earned) : 0;
    const progress = data && data.daily.total > 0 ? Math.min(100, Math.max(0, data.daily.earned / data.daily.total * 100)) : 0;
    const closed = data?.promo.reason === 'no_week' || data?.promo.reason === 'unconfigured';

    return <div className="lucky-page"><div className="lucky-page__scroll" ref={scrollRef}>
        <ReelShortTopNav scrollParentRef={scrollRef} showPrimaryNav />
        <main className="lucky-page__main">
            {loading && !data ? <div className="lucky-loading" role="status" aria-label={label('loading')}><span /><span /><span /></div> : data ? <>
                {data.checkin && !data.checkin.today && !data.checkin.restricted && data.daily.tasks.some(task => task.key === 'checkin') ? <div className="lucky-checkin-strip"><span>{w('今天签到领', '今天簽到領')} +{data.daily.tasks.find(task => task.key === 'checkin')?.coins ?? 0} 币</span><button type="button" className="lucky-task__button is-claim" disabled={Boolean(busy) || demo} onClick={() => { const task = data.daily.tasks.find(item => item.key === 'checkin'); if (task) void handleTask(task); }}>签到领币</button></div> : null}
                <section className="lucky-closed lucky-panel">
                    <span className="lucky-closed__icon"><LuckyIcon name="sparkle" size={24} /></span>
                    <h1>{closed ? w('幸运充值日暂未开启', '幸運充值日暫未開啟') : w('福利中心')}</h1>
                    <p>{closed ? w('开启时站内信通知你，日常福利照常领', '開啟時站內信通知你，日常福利照常領') : label('lucky_subtitle')}</p>
                    {closed && data.promo.nextOpenAt ? <small>{w('下次开启：', '下次開啟：')}{new Date(data.promo.nextOpenAt).toLocaleString(intl.locale)}</small> : null}
                </section>
                <section id="daily" ref={dailyRef} className="lucky-daily lucky-panel">
                    <h2 className="lucky-section-title"><LuckyIcon name="gift" size={18} />{label('lucky_daily_title')}</h2>
                    {taskError ? <p className="lucky-task-error" role="alert">{taskError}</p> : null}
                    {pushProgress ? <p role="status">{pushProgress === 'permission' ? w('请在浏览器提示中允许通知', '請在瀏覽器提示中允許通知') : pushProgress === 'connection' ? w('正在连接通知服务…', '正在連接通知服務…') : w('正在保存通知设置…', '正在儲存通知設定…')}</p> : null}
                    {progressError ? <p className="lucky-task-error" role="alert">{progressError}</p> : null}
                    {data.watchStreak ? <p className="lucky-streak-status">连续追剧 {data.watchStreak.currentStreak} 天 · 最长 {data.watchStreak.bestStreak} 天{data.watchStreak.nextAnchor ? ` · 下个里程碑 ${data.watchStreak.nextAnchor} 天 +${data.watchStreak.nextAnchorReward} 币` : ''}</p> : null}
                    {data.daily.restricted ? <p className="lucky-restricted">{w('当前账号暂不参与奖励，仍可正常观看', '目前帳號暫不參與獎勵，仍可正常觀看')}</p> : <>
                        <div className="lucky-daily__score"><strong>{data.daily.earned.toLocaleString()}<span> / {data.daily.total.toLocaleString()}</span></strong><small>{left === 0 ? label('lucky_all_done') : intl.formatMessage({ id: 'lucky_left' }, { coins: left })}</small></div>
                        <div className="lucky-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><span style={{ width: `${progress}%` }} /></div>
                        <TaskRows rows={data.daily.tasks} busy={busy} onAction={(task) => void handleTask(task)} label={label} />
                        {data.newcomer.tasks.length ? <div className="lucky-newcomer"><div className="lucky-newcomer__head"><h3>{label('lucky_newcomer_title')}</h3><span>{intl.formatMessage({ id: 'lucky_newcomer_once' }, { coins: data.newcomer.total })}</span></div><TaskRows rows={data.newcomer.tasks} busy={busy} onAction={(task) => void handleTask(task)} label={label} /></div> : null}
                    </>}
                </section>
                {data.rewards.length ? <section className="lucky-center lucky-panel"><div className="lucky-center__head"><h2>{label('lucky_center_title')}</h2><LuckyIcon name="gift" size={22} /></div><div className="lucky-center__grid">{data.rewards.map((card) => <button key={card.key} type="button" onClick={() => card.key === 'level' ? setAccountDialog('level') : visit(card.to)}><span className="lucky-center__icon"><LuckyIcon name={card.icon} size={18} /></span><strong>{label(card.title)}</strong><p>{label(card.description)}</p><em>{label('lucky_complete')}<LuckyIcon name="chevron-right" size={12} /></em></button>)}</div></section> : null}
            </> : null}
        </main>
        <ReelShortFooter dockAboveBottomTab />
    </div><LuckyRatingSheet open={ratingOpen} demo={demo || loading || !data} onClose={() => setRatingOpen(false)} onRated={() => void load(true, true)} /><LuckyAccountDialogs kind={accountDialog} demo={demo || loading || !data} onClose={() => setAccountDialog(null)} /></div>;
}
