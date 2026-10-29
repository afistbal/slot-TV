export type InviteMilestone = { n: number; coins: number };
export type InviteTask = {
    reward: number;
    payers: number;
    gatePayers: number;
    invitedCents: number;
    gateNetUsdCents: number;
    accountDays: number;
    gateAccountDays: number;
};
export type InviteInfo = {
    referralCode: string;
    invitedCount: number;
    settledCount: number;
    earnedCoins: number;
    pendingCoins: number;
    hasEarnedCoins: boolean;
    hasPendingCoins: boolean;
    depositRewardCoins: number | null;
    registerReward: number | null;
    task: InviteTask | null;
    affiliateState: 'in_progress' | 'active' | null;
    rewardMode: 'coins' | 'cash';
    config: {
        signupInviter: number;
        signupInvitee: number;
        purchasePct: number;
        dailyInviteCap: number;
        milestones: InviteMilestone[];
    };
};

const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const amount = (value: unknown): number => {
    if (typeof value !== 'number' && typeof value !== 'string') return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};
const count = (value: unknown) => Math.floor(amount(value));
const field = (value: Record<string, unknown>, camel: string, snake: string) => value[camel] ?? value[snake];

/** Missing backend values stay at zero; benchmark amounts are never used as defaults. */
export function normalizeInviteInfo(value: unknown): InviteInfo {
    const root = object(value);
    const nested = root.affiliate ?? root.eligibility ?? root.data;
    const data = nested !== null && typeof nested === 'object' && !Array.isArray(nested) ? object(nested) : root;
    const config = object(data.config);
    const milestones = new Map<number, InviteMilestone>();
    if (Array.isArray(config.milestones)) {
        for (const raw of config.milestones) {
            const row = object(raw);
            const n = count(row.n), coins = count(row.coins);
            if (n > 0 && coins > 0 && !milestones.has(n)) milestones.set(n, { n, coins });
        }
    }
    const code = field(data, 'referralCode', 'referral_code');
    const depositRate = field(data, 'inviteDepositRate', 'invite_deposit_rate');
    const hasTask = ['inviteTaskReward', 'invite_task_reward', 'gatePayers', 'gate_payers', 'gateNetUsdCents', 'gate_net_usd_cents', 'gateAccountDays', 'gate_account_days']
        .some(key => data[key] !== undefined && data[key] !== null);
    return {
        referralCode: typeof code === 'string' ? code.trim() : '',
        invitedCount: count(field(data, 'invitedCount', 'invited_count')),
        settledCount: count(field(data, 'settledCount', 'settled_count')),
        earnedCoins: count(field(data, 'earnedCoins', 'earned_coins')),
        pendingCoins: count(field(data, 'pendingCoins', 'pending_coins')),
        hasEarnedCoins: field(data, 'earnedCoins', 'earned_coins') != null,
        hasPendingCoins: field(data, 'pendingCoins', 'pending_coins') != null,
        depositRewardCoins: field(data, 'inviteDepositReward', 'invite_deposit_reward') == null ? null : count(field(data, 'inviteDepositReward', 'invite_deposit_reward')),
        registerReward: field(data, 'registerReward', 'register_reward') == null ? null : count(field(data, 'registerReward', 'register_reward')),
        task: hasTask ? {
            reward: count(field(data, 'inviteTaskReward', 'invite_task_reward')),
            payers: count(data.payers ?? data.payer_count),
            gatePayers: count(field(data, 'gatePayers', 'gate_payers')),
            invitedCents: count(field(data, 'invitedCents', 'invited_cents')),
            gateNetUsdCents: count(field(data, 'gateNetUsdCents', 'gate_net_usd_cents')),
            accountDays: count(field(data, 'accountDays', 'account_days')),
            gateAccountDays: count(field(data, 'gateAccountDays', 'gate_account_days')),
        } : null,
        affiliateState: data.state === 'active' || data.state === 'in_progress' ? data.state : null,
        rewardMode: field(data, 'rewardMode', 'reward_mode') === 'cash' ? 'cash' : 'coins',
        config: {
            signupInviter: count(field(data, 'onceInviteReward', 'once_invite_reward') ?? field(config, 'signupInviter', 'signup_inviter')),
            signupInvitee: count(field(config, 'signupInvitee', 'signup_invitee')),
            purchasePct: Math.min(100, depositRate == null ? amount(field(config, 'purchasePct', 'purchase_pct')) : Number((amount(depositRate) * 100).toFixed(6))),
            dailyInviteCap: count(field(config, 'dailyInviteCap', 'daily_invite_cap')),
            milestones: [...milestones.values()].sort((a, b) => a.n - b.n),
        },
    };
}

/** Eligibility is separate from payment; meeting every gate never implies coins were paid. */
export function inviteTaskProgress(task: InviteTask) {
    const gates = [
        { current: task.payers, target: task.gatePayers },
        { current: task.invitedCents, target: task.gateNetUsdCents },
        { current: task.accountDays, target: task.gateAccountDays },
    ].filter(gate => gate.target > 0);
    const complete = gates.length > 0 && gates.every(gate => gate.current >= gate.target);
    return { complete, percent: gates.length ? Math.floor(Math.min(...gates.map(gate => Math.min(1, gate.current / gate.target))) * 100) : 0 };
}

export function nextInviteMilestone(info: InviteInfo) {
    const next = info.config.milestones.find(row => row.n > info.settledCount);
    const complete = info.config.milestones.length > 0 && !next;
    const target = next?.n ?? (complete ? info.config.milestones[info.config.milestones.length - 1].n : 0);
    return {
        target, coins: next?.coins ?? 0, left: Math.max(0, target - info.settledCount), complete,
        percent: target > 0 ? Math.min(100, Math.round(info.settledCount / target * 100)) : 0,
    };
}
