import type { LuckyPageData, LuckyRewardCard, LuckyTask } from '@/api/lucky';

type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
const count = (value: unknown): number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
const finite = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const w = (locale: string, cn: string, tw = cn) => locale === 'zh-TW' ? tw : cn;
const hiddenNewcomerTaskKeys = new Set(['bind_x', 'follow_x', 'join_tg']);

// The actual user/tasks payload observed in our page uses the original snake_case
// keys. Accept its CamelCase equivalent without renaming task key VALUES.
export function camelLuckyPayload(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(camelLuckyPayload);
    if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase()), camelLuckyPayload(child)]));
    return value;
}

export function decodeLuckyTasks(value: unknown, locale = 'zh-CN'): Pick<LuckyPageData, 'daily' | 'newcomer'> {
    const data = object(camelLuckyPayload(value));
    if (!Array.isArray(data.tasks) || !Array.isArray(data.once) || !Number.isSafeInteger(data.total) || !Number.isSafeInteger(data.earned) || !Number.isSafeInteger(data.onceTotal)
        || Number(data.total) < 0 || Number(data.earned) < 0 || Number(data.onceTotal) < 0) throw new Error('POST /api/user/tasks：任务返回结构无效');
    const raw = data.tasks.map(object);
    const removed = raw.filter(row => /comment/i.test(String(row.key)));
    const byKey = new Map(raw.map(row => [String(row.key), row]));
    const tasks: LuckyTask[] = [];
    const definitions: Array<[string, LuckyTask['icon'], string]> = [
        ['checkin', 'check-circle', 'lucky_task_checkin'], ['streak', 'flame', 'lucky_task_streak'],
        ['share', 'share', 'lucky_task_share'], ['rating', 'star', 'lucky_task_rating'], ['watch', 'play', 'lucky_task_watch'],
    ];
    for (const [key, icon, title] of definitions) {
        const row = byKey.get(key);
        if (!row || count(row.cap) <= 0 && count(row.earned) <= 0) continue;
        const done = row.done === true;
        let description = '';
        if (!done && key === 'checkin') description = row.needsWatch === true ? w(locale, '先观看剧集再领取', '先觀看劇集再領取') : count(row.milestone) > 0 ? w(locale, `里程碑额外 +${count(row.milestone)} 币`, `里程碑額外 +${count(row.milestone)} 幣`) : '';
        if (!done && key === 'streak' && count(row.minSec) > 0) description = w(locale, `看够 ${count(row.minSec)} 秒`, `看夠 ${count(row.minSec)} 秒`);
        if (!done && key === 'rating' && count(row.left) > 0) description = w(locale, `还可评 ${count(row.left)} 部`, `還可評 ${count(row.left)} 部`);
        const ready = row.ready === true;
        if (!done && key === 'watch' && !ready) {
            const remaining = Math.max(0, count(row.need) - count(row.sec));
            if (remaining > 0) description = w(locale, `还差 ${Math.ceil(remaining / 60)} 分钟`, `還差 ${Math.ceil(remaining / 60)} 分鐘`);
        }
        tasks.push({ key, icon, title, coins: count(row.cap), earned: count(row.earned), done, ready,
            description: description || undefined, action: key === 'checkin' && row.needsWatch !== true || ready ? 'claim' : 'go',
            to: key === 'rating' ? '/lucky?rate=1' : '/foryou' });
    }
    const onceRows = data.once.map(object);
    const once = new Map(onceRows.map(row => [String(row.key), row]));
    const newcomers: LuckyTask[] = [];
    const onceDefinitions: Array<[string, LuckyTask['icon'], string, string, LuckyTask['action']]> = [
        ['push_on', 'bell', 'lucky_once_push', 'lucky_once_push_desc', 'push'],
        ['join_tg', 'send', 'lucky_once_join_tg', 'lucky_once_join_tg_desc', 'telegram'],
    ];
    for (const [key, icon, title, description, action] of onceDefinitions) {
        if (hiddenNewcomerTaskKeys.has(key)) continue;
        const row = once.get(key);
        if (!row || count(row.coins) <= 0) continue;
        newcomers.push({ key, icon, title, description, coins: count(row.coins), done: row.done === true,
            ready: row.ready === true, xUsed: row.xUsed === true, action: row.ready === true ? 'claim' : action });
    }
    return {
        daily: { earned: Math.max(0, count(data.earned) - removed.reduce((sum, row) => sum + count(row.earned), 0)),
            total: Math.max(0, count(data.total) - removed.reduce((sum, row) => sum + count(row.cap), 0)), restricted: data.restricted === true, tasks },
        newcomer: { total: Math.max(0, count(data.onceTotal) - onceRows.filter(row => /comment/i.test(String(row.key)) || hiddenNewcomerTaskKeys.has(String(row.key))).reduce((sum, row) => sum + count(row.coins), 0)), tasks: newcomers },
    };
}

export function luckyClaimableBadge(value: unknown): number | null {
    const data = object(camelLuckyPayload(value));
    if (!Array.isArray(data.tasks)) return null;
    if (data.restricted === true) return 0;
    const daily = data.tasks.map(object).filter(row => {
        if (row.done === true || count(row.cap) <= 0) return false;
        if (row.key === 'checkin') return row.needsWatch !== true;
        return row.ready === true;
    }).length;
    const newcomer = list(data.once).map(object).filter(row => !hiddenNewcomerTaskKeys.has(String(row.key)) && row.done !== true && row.ready === true && row.xUsed !== true && count(row.coins) > 0).length;
    return daily + newcomer;
}

// Backward-compatible export for existing callers while the badge now counts
// every task that can actually be claimed, not only check-in.
export const luckyCheckinBadge = luckyClaimableBadge;

export function decodeLuckyCatalog(value: unknown, locale = 'zh-CN'): Pick<LuckyPageData, 'promo' | 'rewards'> {
    const catalog = object(camelLuckyPayload(value));
    const promo = object(catalog.promo);
    const rewards: LuckyRewardCard[] = [];
    const checkin = object(catalog.checkin);
    const checkinRewards = list(checkin.rewards).filter((n): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0);
    if (checkinRewards.length) {
        const milestones = object(checkin.milestones);
        const days = Math.max(0, ...Object.keys(milestones).map(Number).filter(Number.isFinite));
        const extra = days > 0 ? w(locale, `，签满 ${days} 天再送 ${count(milestones[String(days)])} 币`, `，簽滿 ${days} 天再送 ${count(milestones[String(days)])} 幣`) : '';
        rewards.push({ key: 'checkin', icon: 'check-circle', title: 'lucky_center_checkin', description: w(locale, `每天 ${Math.min(...checkinRewards)}–${Math.max(...checkinRewards)} 币${extra}`, `每天 ${Math.min(...checkinRewards)}–${Math.max(...checkinRewards)} 幣${extra}`), to: '/lucky#daily' });
    }
    const streak = object(catalog.watchStreak);
    if (streak.enabled !== false && Object.keys(object(streak.rewards)).length) {
        const milestones = object(streak.rewards);
        const days = Math.max(0, ...Object.keys(milestones).map(Number).filter(Number.isFinite));
        rewards.push({ key: 'streak', icon: 'flame', title: 'lucky_center_streak', description: w(locale, `每天 +${count(streak.dailyBase)} 币，连看 ${days} 天最高再送 ${count(milestones[String(days)])} 币`, `每天 +${count(streak.dailyBase)} 幣，連看 ${days} 天最高再送 ${count(milestones[String(days)])} 幣`), to: '/foryou' });
    }
    const referral = object(catalog.referral);
    if (referral.enabled !== false && typeof referral.signupInviter === 'number') rewards.push({ key: 'invite', icon: 'user', title: 'lucky_center_invite', description: w(locale, `好友注册你得 ${count(referral.signupInviter)} 币，好友充值再得 ${finite(referral.purchasePct)}%`, `好友註冊你得 ${count(referral.signupInviter)} 幣，好友儲值再得 ${finite(referral.purchasePct)}%`), to: '/affiliate' });
    if (typeof referral.dailyShare === 'number') rewards.push({ key: 'share', icon: 'share', title: 'lucky_center_share', description: w(locale, `每天 +${count(referral.dailyShare)} 币`, `每天 +${count(referral.dailyShare)} 幣`), to: '/foryou' });
    const rating = object(catalog.rating);
    if (typeof rating.reward === 'number') rewards.push({ key: 'rating', icon: 'star', title: 'lucky_center_rating', description: w(locale, `看过的剧可评分，每部 +${count(rating.reward)} 币，每天最多 ${count(rating.dailyCap)} 部`, `看過的劇可評分，每部 +${count(rating.reward)} 幣，每天最多 ${count(rating.dailyCap)} 部`), to: '/profile?tab=history' });
    const levels = object(catalog.levels);
    if (Object.keys(levels).length) rewards.push({ key: 'level', icon: 'trending', title: 'lucky_center_level', description: w(locale, `升到 Lv${Math.max(0, ...Object.keys(levels).map(Number).filter(Number.isFinite))} 累计送 ${Object.values(levels).reduce<number>((sum, value) => sum + count(value), 0)} 币`, `升到 Lv${Math.max(0, ...Object.keys(levels).map(Number).filter(Number.isFinite))} 累計送 ${Object.values(levels).reduce<number>((sum, value) => sum + count(value), 0)} 幣`), to: '/profile' });
    return { promo: { enabled: promo.enabled === true, eligible: false, reason: value == null ? 'unconfigured' : 'catalog_only', nextOpenAt: typeof promo.nextOpenAt === 'string' ? promo.nextOpenAt : null }, rewards };
}
