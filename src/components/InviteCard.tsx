import { useId, useState } from 'react';
import { useIntl } from 'react-intl';
import { ArrowUpRight, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useInviteInfo } from '@/hooks/useInviteInfo';
import { useRequireAccount } from '@/hooks/useRequireAccount';
import { useUserStore } from '@/stores/user';
import { getUserUidForDisplay } from '@/lib/formatUserUniqueIdForDisplay';
import { buildAffiliateShareUrl } from '@/lib/shareUrls';
import { inviteTaskProgress, nextInviteMilestone } from '@/lib/inviteData';
import { openSharePoster } from '@/stores/sharePoster';
import '@/styles/invite-card.scss';

export function InviteCard({ className = '', affiliate = false }: { className?: string; affiliate?: boolean }) {
    const intl = useIntl();
    const { data, loading } = useInviteInfo();
    const requireAccount = useRequireAccount();
    const uid = useUserStore(state => getUserUidForDisplay(state.info));
    const signed = useUserStore(state => state.signed && !state.isAnonymous());
    const [rulesOpen, setRulesOpen] = useState(false);
    const id = useId();
    const t = (key: string, values?: Record<string, number | string>) => intl.formatMessage({ id: key }, values);
    const link = signed ? buildAffiliateShareUrl(data.referralCode || uid) : '';
    const next = nextInviteMilestone(data);
    const task = data.task;
    const taskProgress = task ? inviteTaskProgress(task) : null;
    const config = data.config;
    const num = (value: number) => intl.formatNumber(value);
    const money = (cents: number) => intl.formatNumber(cents / 100, { style: 'currency', currency: 'CNY' });

    async function copy() {
        if (!requireAccount() || !link) return;
        try {
            if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
            await navigator.clipboard.writeText(link);
            toast.success(t('invite_link_copied'));
        } catch {
            const input = document.getElementById(`${id}-link`) as HTMLInputElement | null;
            input?.focus(); input?.select();
            toast.info(t('invite_copy_manually'));
        }
    }

    function sharePoster() {
        if (!requireAccount() || !link) return;
        openSharePoster({ url: link, title: t('invite_card_title'), inviteCode: data.referralCode || uid });
    }

    return <section className={`invite-card ${className}`} data-affiliate={affiliate || undefined} id="invite" aria-labelledby={`${id}-title`} aria-busy={loading}>
        <h2 id={`${id}-title`}><ArrowUpRight size={16} aria-hidden />{t('invite_card_title')}</h2>
        <p className="invite-card__description">{data.registerReward !== null ? t('invite_rewards_with_register', { register: data.registerReward, inviter: config.signupInviter, pct: config.purchasePct }) : t('invite_rewards_description', { inviter: config.signupInviter, pct: config.purchasePct })}</p>
        {config.signupInvitee > 0 ? <p className="invite-card__note">{t('invite_friend_reward', { coins: config.signupInvitee })}</p> : null}
        <div className="invite-card__copy">
            <input id={`${id}-link`} readOnly aria-label={t('affiliate_your_link')} value={link} placeholder={t('invite_login_hint')} onFocus={event => event.currentTarget.select()} />
            <button type="button" className="invite-card__primary" onClick={() => void copy()}>{t('invite_copy_link')}</button>
        </div>
        {task && taskProgress ? <div className="invite-card__milestone">
            <div className="invite-card__task-heading"><strong>{t(taskProgress.complete ? 'invite_task_eligible' : task.payers >= task.gatePayers ? 'invite_task_reward' : 'invite_next_paid', { coins: task.reward, left: Math.max(0, task.gatePayers - task.payers) })}</strong><span>{t('invite_valid_progress', { count: task.payers, target: task.gatePayers })}</span></div>
            <p className="invite-card__task-row">{t('invite_deposit_progress_compact', { amount: money(task.invitedCents), target: money(task.gateNetUsdCents) })}</p>
            {task.gateAccountDays > 0 ? <p className="invite-card__task-row">{t('invite_days_progress', { days: task.accountDays, target: task.gateAccountDays })}</p> : null}
            <div className="invite-card__progress" role="progressbar" aria-label={t('invite_progress_label')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={taskProgress.percent}><span style={{ width: `${taskProgress.percent}%` }} /></div>
        </div> : <div className="invite-card__milestone">
            <div><strong>{next.complete ? t('invite_milestones_complete') : t('invite_next_milestone', { left: next.left, coins: next.coins })}</strong><span>{t('invite_valid_progress', { count: data.settledCount, target: next.target })}</span></div>
            <div className="invite-card__progress" role="progressbar" aria-label={t('invite_progress_label')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={next.percent}><span style={{ width: `${next.percent}%` }} /></div>
        </div>}
        <div className="invite-card__stats" aria-live="polite">
            <span><b>{num(data.invitedCount)}</b>{t('invite_invited_count')}</span>
            {data.hasEarnedCoins ? <span><b>{num(data.earnedCoins)}</b>{t('invite_earned_coins')}</span> : data.depositRewardCoins !== null ? <span><b>{num(data.depositRewardCoins)}</b>{t('invite_deposit_reward_coins')}</span> : null}
            {data.hasPendingCoins && data.pendingCoins > 0 ? <span>{t('invite_pending_coins', { coins: data.pendingCoins })}</span> : null}
        </div>
        {data.rewardMode === 'cash' ? <p className="invite-card__note">{t('invite_cash_mode')}</p> : null}
        <div className="invite-card__footer">
            <button type="button" aria-expanded={rulesOpen} aria-controls={`${id}-rules`} onClick={() => setRulesOpen(value => !value)}>{t('invite_rules_title')}<ChevronDown size={14} className={rulesOpen ? 'is-open' : ''} aria-hidden /></button>
            <button type="button" onClick={sharePoster}>{t('invite_share_poster')}</button>
        </div>
        {rulesOpen ? <ol id={`${id}-rules`} className="invite-card__rules">
            <li>{t('invite_rule_inviter', { inviter: config.signupInviter })}</li>
            {data.registerReward !== null ? <li>{t('invite_register_reward', { coins: data.registerReward })}</li> : null}
            {task ? <li>{t('invite_rule_task', { amount: money(task.gateNetUsdCents), count: task.gatePayers, coins: task.reward })}</li> : config.milestones.map(row => <li key={row.n}>{t('invite_rule_milestone', { count: row.n, coins: row.coins })}</li>)}
            {task && task.gateAccountDays > 0 ? <li>{t('invite_rule_account_days', { days: task.gateAccountDays })}</li> : null}
            {config.dailyInviteCap > 0 ? <li>{t('invite_rule_cap', { cap: config.dailyInviteCap })}</li> : null}
            <li>{t('invite_rule_purchase', { pct: config.purchasePct })}</li>
            <li>{t('invite_rule_usage')}</li>
            <li>{t('invite_cash_mode')}</li>
            <li>{t('invite_rule_settlement')}</li>
        </ol> : null}
    </section>;
}
