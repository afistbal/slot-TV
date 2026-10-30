import type { LuckyPageData, LuckyRewardCard, LuckyTask } from '@/api/lucky';
import { decodeLuckyWheel } from '@/lib/luckyWheel';

type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
const numeric = (value: unknown): number => typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
const isCount = (value: unknown): boolean => {
    const parsed = numeric(value);
    return Number.isSafeInteger(parsed) && parsed >= 0;
};
const count = (value: unknown): number => {
    const parsed = numeric(value);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
};
const finite = (value: unknown): number => {
    const parsed = numeric(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};
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
    if (!Array.isArray(data.tasks) || !Array.isArray(data.once) || !isCount(data.total) || !isCount(data.earned) || !isCount(data.onceTotal)) throw new Error('POST /api/user/tasks：任务返回结构无效');
    const raw = data.tasks.map(object);
    const byKey = new Map(raw.map(row => [String(row.key), row]));
    const tasks: LuckyTask[] = [];
    const definitions: Array<[string, LuckyTask['icon'], string]> = [
        ['checkin', 'check-circle', 'lucky_task_checkin'], ['streak', 'flame', 'lucky_task_streak'],
        ['share', 'share', 'lucky_task_share'], ['rating', 'star', 'lucky_task_rating'], ['watch', 'play', 'lucky_task_watch'],
    ];
    for (const [key, icon, title] of definitions) {
        const row = byKey.get(key);
        if (!row || count(row.cap) <= 0 && count(row.earned) <= 0) continue;
        const backendDone = row.done === true;
        const earned = count(row.earned);
        const usesEarnedClaimState = key === 'streak' || key === 'watch';
        // 追剧、视频任务的 done 表示任务已完成、可以领取；earned > 0 才表示已经领取。
        // 其他任务继续沿用各自现有的后端状态定义。
        const claimed = usesEarnedClaimState ? earned > 0 : backendDone;
        let description = '';
        if (!backendDone && key === 'checkin') description = row.needsWatch === true ? w(locale, '先观看剧集再领取', '先觀看劇集再領取') : count(row.milestone) > 0 ? w(locale, `里程碑额外 +${count(row.milestone)} 币`, `里程碑額外 +${count(row.milestone)} 幣`) : '';
        if (!backendDone && key === 'streak' && count(row.minSec) > 0) description = w(locale, `看够 ${count(row.minSec)} 秒`, `看夠 ${count(row.minSec)} 秒`);
        if (!backendDone && key === 'rating' && count(row.left) > 0) description = w(locale, `还可评 ${count(row.left)} 部`, `還可評 ${count(row.left)} 部`);
        const ready = row.ready === true;
        if (!backendDone && key === 'watch' && !ready) {
            const remaining = Math.max(0, count(row.need) - count(row.sec));
            if (remaining > 0) description = w(locale, `还差 ${Math.ceil(remaining / 60)} 分钟`, `還差 ${Math.ceil(remaining / 60)} 分鐘`);
        }
        const claimable = usesEarnedClaimState ? backendDone && !claimed : key === 'checkin' ? row.needsWatch !== true : false;
        tasks.push({ key, icon, title, coins: count(row.cap), earned, done: claimed, ready: usesEarnedClaimState ? claimable : ready,
            description: description || undefined, action: claimable ? 'claim' : 'go',
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
            ready: row.ready === true, xUsed: row.xUsed === true, action: key !== 'push_on' && row.ready === true ? 'claim' : action });
    }
    // A task can report credited coins before the aggregate catches up. Keep
    // the summary at least as high as the actual visible task credits, without
    // counting claimable rewards or adding the aggregate a second time.
    const creditedTaskCoins = tasks.reduce((sum, task) => sum + (task.earned ?? 0), 0);
    // The backend owns daily aggregates; hiding a task does not mean its cap
    // or credits were included in those aggregates. Do not subtract them again.
    const summaryCoins = count(data.earned);
    return {
        daily: { earned: Math.max(creditedTaskCoins, summaryCoins),
            total: count(data.total), restricted: data.restricted === true, tasks },
        // once_total may be zero or include disabled social tasks. This caption
        // describes the displayed tasks, including rewards already claimed.
        newcomer: { total: newcomers.reduce((sum, task) => sum + task.coins, 0), tasks: newcomers },
    };
}

export function luckyClaimableBadge(value: unknown): number | null {
    const data = object(camelLuckyPayload(value));
    if (!Array.isArray(data.tasks)) return null;
    if (data.restricted === true) return 0;
    const checkin = data.tasks.map(object).find(row => row.key === 'checkin');
    return checkin && checkin.done !== true && count(checkin.cap) > 0 && checkin.needsWatch !== true ? 1 : 0;
}

// The benchmark header badge is a compact welfare reminder, not a count of
// every ready task. Keep check-in badge behavior independent of the wheel.
export const luckyCheckinBadge = luckyClaimableBadge;

/** Welfare cards come only from user/rewards; user/tasks never supplies display amounts here. */
export function decodeLuckyTaskContent(value: unknown, locale = 'zh-CN'): Pick<LuckyPageData, 'promo' | 'rewards' | 'wheel'> {
    const data = object(camelLuckyPayload(value));
    const catalog = object(data.rewards ?? data.catalog ?? data);
    const promo = object(data.promo);
    const reward = (key: string) => list(data.rewards).map(object).find(row => row.key === key) ?? {};
    const configured = (key: string, legacy: unknown) => {
        const row = reward(key);
        return Object.keys(row).length ? row : object(legacy);
    };
    const checkin = configured('checkin', catalog.checkin);
    const checkinRewards = list(checkin.rewards).filter(isCount).map(count);
    const min = checkinRewards.length ? Math.min(...checkinRewards) : 0;
    const max = checkinRewards.length ? Math.max(...checkinRewards) : 0;
    const milestone = (value: unknown) => {
        const rows = object(value);
        const day = Math.max(0, ...Object.keys(rows).map(Number).filter(n => Number.isSafeInteger(n) && n >= 0));
        return { day, coins: count(rows[String(day)]) };
    };
    const checkinExtra = milestone(checkin.milestones);
    const streak = configured('streak', catalog.watchStreak);
    const streakExtra = milestone(streak.milestones ?? streak.rewards);
    const referral = object(catalog.referral);
    const invite = configured('invite', referral);
    const share = configured('share', referral);
    const rating = configured('rating', catalog.rating);
    const rewards: LuckyRewardCard[] = [
        { key: 'checkin', icon: 'check-circle', title: 'lucky_center_checkin', description: w(locale, '每天 ' + min + '–' + max + ' 币，签满 ' + checkinExtra.day + ' 天再送 ' + checkinExtra.coins + ' 币', '每天 ' + min + '–' + max + ' 幣，簽滿 ' + checkinExtra.day + ' 天再送 ' + checkinExtra.coins + ' 幣'), to: '/lucky#daily' },
        { key: 'streak', icon: 'flame', title: 'lucky_center_streak', description: w(locale, '每天 +' + count(streak.cap ?? streak.dailyBase) + ' 币，连看 ' + streakExtra.day + ' 天最高再送 ' + streakExtra.coins + ' 币', '每天 +' + count(streak.cap ?? streak.dailyBase) + ' 幣，連看 ' + streakExtra.day + ' 天最高再送 ' + streakExtra.coins + ' 幣'), to: '/foryou' },
        { key: 'invite', icon: 'user', title: 'lucky_center_invite', description: w(locale, '邀请好友可得 ' + count(invite.cap ?? invite.signupInviter) + ' 币，好友充值再得 ' + finite(invite.purchasePct) + '%', '邀請好友可得 ' + count(invite.cap ?? invite.signupInviter) + ' 幣，好友儲值再得 ' + finite(invite.purchasePct) + '%'), to: '/affiliate' },
        { key: 'share', icon: 'share', title: 'lucky_center_share', description: w(locale, '每天 +' + count(share.cap ?? share.dailyShare) + ' 币', '每天 +' + count(share.cap ?? share.dailyShare) + ' 幣'), to: '/foryou' },
        { key: 'rating', icon: 'star', title: 'lucky_center_rating', description: w(locale, '看过的剧可评分，每部 +' + count(rating.cap ?? rating.reward) + ' 币，每天最多 ' + count(rating.count ?? rating.dailyCap) + ' 部', '看過的劇可評分，每部 +' + count(rating.cap ?? rating.reward) + ' 幣，每天最多 ' + count(rating.count ?? rating.dailyCap) + ' 部'), to: '/lucky?rate=1' },
    ];
    return {
        promo: { enabled: promo.enabled === true, eligible: promo.eligible === true, reason: typeof promo.reason === 'string' ? promo.reason : 'unconfigured', nextOpenAt: typeof promo.nextOpenAt === 'string' ? promo.nextOpenAt : null },
        rewards, wheel: decodeLuckyWheel(promo),
    };
}

/** Legacy decoder retained for callers outside the welfare page. */
export function decodeLuckyCatalog(value: unknown, locale = 'zh-CN') {
    return decodeLuckyTaskContent({ rewards: value }, locale);
}
