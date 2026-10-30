import { movieCoverUrl } from '@/lib/movieCoverUrl';
import { api, formatApiFailure } from '@/api';
import { camelLuckyPayload, decodeLuckyTaskContent, decodeLuckyTasks, luckyClaimableBadge } from '@/lib/luckyPageData';
import { useLuckyStore } from '@/stores/lucky';
import type { LuckySpinDraw, LuckySpinMode, LuckyWheelState } from '@/lib/luckyWheel';

export type LuckyIconName = 'bell' | 'check' | 'check-circle' | 'external' | 'flame' | 'gift' | 'play' | 'send' | 'share' | 'star' | 'trending' | 'user' | 'sparkle' | 'chevron-right' | 'close' | 'clock' | 'help-circle' | 'coin';
export type LuckyTask = { key: string; icon: LuckyIconName; title: string; description?: string; coins: number; done: boolean; earned?: number; ready?: boolean; xUsed?: boolean; action: 'claim' | 'go' | 'external' | 'push' | 'linkx' | 'telegram'; to?: string };
export type LuckyRewardCard = { key: string; icon: LuckyIconName; title: string; description: string; to: string };
export type LuckyCheckin = { today: boolean; streak: number; rewards: number[]; multiplier: number; restricted?: boolean; milestonePendingCoins?: number };
export type LuckyWatchStreak = { currentStreak: number; bestStreak: number; dailyBase: number; nextAnchor: number | null; nextAnchorReward: number };
export type LuckyLevel = { xp: number; level: number; currNeed: number; nextNeed: number | null };
export type LuckyPageData = {
    coins?: number; promo: { enabled: boolean; eligible: boolean; reason: string; nextOpenAt: string | null };
    daily: { earned: number; total: number; restricted?: boolean; tasks: LuckyTask[] };
    newcomer: { total: number; tasks: LuckyTask[] }; rewards: LuckyRewardCard[];
    checkin?: LuckyCheckin; watchStreak?: LuckyWatchStreak; wheel?: LuckyWheelState;
};
export type LuckyPageResult = { data: LuckyPageData; demo: boolean; error?: string; notice?: string; pendingSchema?: boolean; rawResponses?: { tasks?: unknown; promo?: unknown; rewards?: unknown } };
export type LuckyClaimResult = { coins?: number; already?: boolean; notYet?: boolean; restricted?: boolean; xUsed?: boolean; streak?: number; milestoneCoins?: number; pending?: boolean };
export type LuckySocialActionKind = 'x-oauth' | 'x-follow' | 'telegram-bind' | 'telegram-channel';
export type LuckyTaskAction = { url: string; kind: LuckySocialActionKind };
export type LuckyRatingQuota = { left: number; reward: number };
export type LuckyRatingCandidate = { dramaId: string; title: string; coverUrl: string; epsWatched: number; myRating?: number };
export type LuckyRatingResult = number | undefined;
export type LuckyCoinType = 'watchMore' | 'shareOnce' | 'sendComment' | 'watchRate' | 'watchMovie' | 'bindX' | 'subTel' | 'checkTel';
export type LuckySocialConfig = { xUrl: string; xHandle?: string; tgChannelJoinUrl: string; tgChannel?: string; tgBotUrl: string; telegramLinked?: boolean };

// Backend implementation contracts approved by the user; these are our planned
// REST adapters, NOT purported original chunlou REST endpoints. All use POST.
export const luckyRoutes = {
    promo: 'user/promo/status', spin: 'user/spin', tasks: 'user/tasks', rewards: 'user/rewards', coin: 'user/coin', checkin: 'user/checkin', signin: 'user/signin',
    watchStreak: 'user/watch/streak', ratingQuota: 'user/rating/quota',
    ratingCandidates: 'movie/history', rate: 'user/rate', like: 'user/like', pushConfig: 'user/push/config',
    pushSubscribe: 'user/push/subscribe', socialConfig: 'user/social/config',
    bindX: 'user/social/x/bind', checkX: 'user/social/x/check', bindTelegram: 'user/social/telegram/bind', level: 'user/level',
} as const;

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
function valid<T>(path: string, value: T, condition: boolean): T {
    if (!condition) throw new Error('POST /api/' + path + '：返回数据格式无效');
    return value;
}
async function luckyRequest<T>(path: string, data: Record<string, unknown> = {}, allowEmpty = false): Promise<T> {
    const result = await api<unknown>(path, { method: 'post', data, loading: false, toastOnError: false });
    if (result.c !== 0) throw new Error(formatApiFailure('POST', path, result));
    if (!allowEmpty && result.d == null) throw new Error('POST /api/' + path + '：返回数据为空');
    return camelLuckyPayload(result.d) as T;
}
const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
let taskGeneration = 0;
function invalidateLucky() {
    taskGeneration++;
    taskCache = undefined;
    taskFlight = undefined;
    pageCache = undefined;
    promoCache = undefined;
    promoFlight = undefined;
    useLuckyStore.getState().invalidate();
}
export function withoutLuckyComments(data: LuckyPageData): LuckyPageData {
    const comment = (row: { key: string }) => /comment/i.test(row.key);
    const removed = data.daily.tasks.filter(comment);
    return { ...data, daily: { ...data.daily, tasks: data.daily.tasks.filter(row => !comment(row)),
        total: Math.max(0, data.daily.total - removed.reduce((sum, row) => sum + row.coins, 0)),
        earned: Math.max(0, data.daily.earned - removed.reduce((sum, row) => sum + (row.earned ?? (row.done ? row.coins : 0)), 0)) },
        newcomer: { ...data.newcomer, tasks: data.newcomer.tasks.filter(row => !comment(row)), total: Math.max(0, data.newcomer.total - data.newcomer.tasks.filter(comment).reduce((sum, row) => sum + row.coins, 0)) },
        rewards: data.rewards.filter(row => !comment(row)) };
}
let taskCache: { session: string; at: number; data: unknown } | undefined;
let taskFlight: { session: string; promise: Promise<unknown> } | undefined;
let rewardsCache: { session: string; at: number; data?: unknown; error?: unknown } | undefined;
let rewardsFlight: { session: string; promise: Promise<unknown> } | undefined;
let pageCache: { session: string; locale: string; result: LuckyPageResult } | undefined;
let promoCache: { session: string; at: number; data: unknown } | undefined;
let promoFlight: { session: string; promise: Promise<unknown> } | undefined;
const session = () => typeof localStorage === 'undefined' ? '' : localStorage.getItem('token') ?? '';
// Temporarily hide the wheel: keep its implementation for later, without loading its API.
const luckyWheelTemporarilyHidden = true;
export function getLuckyTasks(force = false): Promise<unknown> {
    const key = session();
    const generation = taskGeneration;
    const luckyStore = useLuckyStore.getState();
    if (taskCache?.session !== key) taskCache = undefined;
    if (luckyStore.tasksSession !== key) luckyStore.clearTasks();
    if (!force && taskCache && Date.now() - taskCache.at < 30000) return Promise.resolve(taskCache.data);
    const stored = useLuckyStore.getState();
    if (!force && stored.tasks !== undefined && stored.tasksSession === key && Date.now() - stored.tasksUpdatedAt < 30000) return Promise.resolve(stored.tasks);
    if (taskFlight?.session === key) return taskFlight.promise;
    const promise = luckyRequest<unknown>(luckyRoutes.tasks, {}, true).then(data => {
        if (key === session()) {
            // A successful claim invalidates both completed and in-flight reads.
            // Join the new read instead of publishing a pre-claim snapshot.
            if (generation !== taskGeneration) return getLuckyTasks();
            taskCache = { session: key, at: Date.now(), data };
            useLuckyStore.getState().setTasks(data, key, luckyClaimableBadge(data));
        }
        return data;
    }).catch(error => {
        if (key === session() && generation !== taskGeneration) return getLuckyTasks();
        throw error;
    }).finally(() => { if (taskFlight?.promise === promise) taskFlight = undefined; });
    taskFlight = { session: key, promise };
    return promise;
}
export function getLuckyRewards(force = false): Promise<unknown> {
    const key = session();
    if (rewardsCache?.session !== key) rewardsCache = undefined;
    if (!force && rewardsCache && Date.now() - rewardsCache.at < 5 * 60 * 1000) {
        return rewardsCache.error === undefined ? Promise.resolve(rewardsCache.data) : Promise.reject(rewardsCache.error);
    }
    if (rewardsFlight?.session === key) return rewardsFlight.promise;
    const promise = luckyRequest<unknown>(luckyRoutes.rewards, {}, true).then(data => {
        if (key === session()) rewardsCache = { session: key, at: Date.now(), data };
        return data;
    }).catch(error => {
        if (key === session()) rewardsCache = { session: key, at: Date.now(), error };
        throw error;
    }).finally(() => { if (rewardsFlight?.promise === promise) rewardsFlight = undefined; });
    rewardsFlight = { session: key, promise };
    return promise;
}
/** The benchmark queries promo_status separately from my_daily_tasks. */
export function getLuckyPromo(force = false): Promise<unknown> {
    if (luckyWheelTemporarilyHidden) return Promise.resolve(undefined);
    const key = session(), generation = taskGeneration;
    if (!force && promoCache?.session === key && Date.now() - promoCache.at < 30000) return Promise.resolve(promoCache.data);
    if (promoFlight?.session === key) return promoFlight.promise;
    const promise = luckyRequest<unknown>(luckyRoutes.promo, {}, true).then(data => {
        if (key === session()) {
            if (generation !== taskGeneration) return getLuckyPromo();
            const value = record(data);
            if (data != null && (typeof value.enabled !== 'boolean' || typeof value.eligible !== 'boolean')) throw new Error('活动状态返回结构无效');
            promoCache = { session: key, at: Date.now(), data: value };
        }
        return data;
    }).finally(() => { if (promoFlight?.promise === promise) promoFlight = undefined; });
    promoFlight = { session: key, promise };
    return promise;
}
export function getCachedLuckyPage(locale = 'zh-CN'): LuckyPageResult | undefined {
    const key = session();
    const cached = pageCache?.session === key && pageCache.locale === locale ? pageCache.result : undefined;
    const stored = useLuckyStore.getState();
    if (stored.tasks === undefined || stored.tasksSession !== key) return cached;
    try {
        const rewards = rewardsCache?.session === key && rewardsCache.error === undefined ? rewardsCache.data : undefined;
        const content = decodeLuckyTaskContent({ rewards: rewards ?? [] }, locale);
        const promo = decodeLuckyTaskContent({ promo: promoCache?.session === key ? promoCache.data : undefined }, locale);
        const data = { ...decodeLuckyTasks(stored.tasks, locale), ...content, promo: promo.promo, wheel: promo.wheel };
        return { data, demo: false, rawResponses: { tasks: stored.tasks, rewards } };
    } catch {
        return cached;
    }
}
export async function getLuckyCheckin(): Promise<LuckyCheckin> {
    const data = await luckyRequest<LuckyCheckin>(luckyRoutes.checkin);
    return valid(luckyRoutes.checkin, data, typeof data.today === 'boolean' && isCount(data.streak) && Array.isArray(data.rewards) && data.rewards.every(isCount) && typeof data.multiplier === 'number' && Number.isFinite(data.multiplier) && data.multiplier >= 0);
}
export async function getLuckyWatchStreak(): Promise<LuckyWatchStreak> {
    const data = await luckyRequest<LuckyWatchStreak>(luckyRoutes.watchStreak);
    return valid(luckyRoutes.watchStreak, data, isCount(data.currentStreak) && isCount(data.bestStreak) && isCount(data.dailyBase) && (data.nextAnchor === null || isCount(data.nextAnchor)) && isCount(data.nextAnchorReward));
}
export async function getLuckyLevel(): Promise<LuckyLevel> {
    const raw = await luckyRequest<LuckyLevel | LuckyLevel[]>(luckyRoutes.level);
    const data = Array.isArray(raw) ? raw[0] : raw;
    return valid(luckyRoutes.level, data, Boolean(data) && isCount(data?.xp) && isCount(data?.level) && isCount(data?.currNeed) && (data?.nextNeed === null || isCount(data?.nextNeed)));
}
export async function getLuckyPage(_createDemo: () => LuckyPageData, locale = 'zh-CN', force = false): Promise<LuckyPageResult> {
    const key = session(), generation = taskGeneration;
    try {
        const [tasksResult, rewardsResult, promoResult] = await Promise.allSettled([getLuckyTasks(force), getLuckyRewards(force), getLuckyPromo(force)]);
        if (tasksResult.status === 'rejected') throw tasksResult.reason;
        const tasks = tasksResult.value;
        const rewards = rewardsResult.status === 'fulfilled' ? rewardsResult.value : undefined;
        const status = promoResult.status === 'fulfilled' ? promoResult.value : undefined;
        const promo = decodeLuckyTaskContent({ promo: status }, locale);
        const result: LuckyPageResult = { data: { ...decodeLuckyTasks(tasks, locale), ...decodeLuckyTaskContent({ rewards: rewards ?? [] }, locale), promo: promo.promo, wheel: promo.wheel }, demo: false,
            error: promoResult.status === 'rejected' ? String(promoResult.reason instanceof Error ? promoResult.reason.message : promoResult.reason) : undefined, rawResponses: { tasks, rewards, promo: status } };
        if (key === session() && generation === taskGeneration) pageCache = { session: key, locale, result };
        return result;
    } catch (reason) {
        const empty = { tasks: [], once: [], total: 0, earned: 0, once_total: 0 };
        return { data: { ...decodeLuckyTasks(empty, locale), ...decodeLuckyTaskContent(empty, locale) }, demo: true, error: reason instanceof Error ? reason.message : String(reason) };
    }
}

/** Our draw adapter preserves the benchmark promo_spin parameter names. Results are server-authoritative. */
export async function spinLuckyWheel(mode: LuckySpinMode, bet: number): Promise<LuckySpinDraw[]> {
    if (!['free', 'paid', 'ten', 'gift', 'ticket'].includes(mode) || !Number.isSafeInteger(bet) || bet < 0 || (mode === 'free' || mode === 'ticket' ? bet !== 0 : bet <= 0)) throw new Error('抽奖参数无效');
    const key = session();
    let result: Record<string, unknown>;
    try {
        result = record(await luckyRequest(luckyRoutes.spin, { p_mode: mode, p_bet: bet }));
    } catch (error) {
        if (key === session()) invalidateLucky();
        throw error;
    }
    if (key !== session()) throw new Error('账号已切换，请重新打开福利页');
    const raw = result.draws;
    // Refresh quotas/balance even if a successful response has an invalid result payload.
    invalidateLucky();
    if (!Array.isArray(raw) || raw.length !== (mode === 'ten' ? 10 : 1)) throw new Error('抽奖结果格式无效，请刷新查看最新记录');
    return raw.map(value => {
        const draw = record(value);
        if (!isCount(draw.slotIdx) || typeof draw.prizeKind !== 'string' || !isCount(draw.prizeValue)) throw new Error('抽奖结果格式无效，请刷新查看最新记录');
        return { slotIdx: draw.slotIdx, prizeKind: draw.prizeKind, prizeValue: draw.prizeValue };
    });
}

function claimResult(path: string, data: unknown): LuckyClaimResult {
    if (data == null) return {};
    const value = record(data);
    if (typeof data === 'number') return { coins: valid(path, data, isCount(data)) };
    const coins = value.coins ?? value.awarded;
    if (value.restricted === true || value.notYet === true || value.xUsed === true || value.already === true) {
        return { ...value, coins: isCount(coins) ? coins : 0 } as LuckyClaimResult;
    }
    if (coins === undefined) return { ...value } as LuckyClaimResult;
    return valid(path, { ...value, coins } as LuckyClaimResult, isCount(coins));
}
export async function getLuckyCoins(type: LuckyCoinType): Promise<LuckyClaimResult> {
    const result = claimResult(luckyRoutes.coin, await luckyRequest(luckyRoutes.coin, { type }, true));
    if (!result.notYet && !result.restricted && !result.xUsed && !result.pending) invalidateLucky();
    return result;
}
export async function claimLuckySignin(): Promise<LuckyClaimResult> {
    const result = claimResult(luckyRoutes.signin, await luckyRequest(luckyRoutes.signin, {}, true));
    if (!result.notYet && !result.restricted && !result.xUsed && !result.pending) invalidateLucky();
    return result;
}
export async function checkLuckyX(): Promise<{ ready: boolean; queued?: boolean }> {
    const value = await luckyRequest<{ ready: boolean; queued?: boolean }>(luckyRoutes.checkX);
    return valid(luckyRoutes.checkX, value, typeof value.ready === 'boolean' && (value.queued === undefined || typeof value.queued === 'boolean'));
}
export async function claimLuckyTask(task: Pick<LuckyTask, 'key'>): Promise<LuckyClaimResult> {
    if (task.key === 'checkin') return claimLuckySignin();
    if (task.key === 'push_on') throw new Error('推送奖励由订阅接口自动发放，请使用开启通知操作');
    const types: Record<string, LuckyCoinType> = { streak: 'watchMore', share: 'shareOnce', rating: 'watchRate', watch: 'watchMovie', bind_x: 'bindX', join_tg: 'subTel' };
    const type = types[task.key];
    if (!type) throw new Error(task.key === 'follow_x' ? '关注 X 暂未提供对应的领奖 type，不能当作绑定 X 领奖' : '该任务不能直接领取奖励');
    return getLuckyCoins(type);
}
export async function claimLuckyDailyShare(): Promise<number | undefined> {
    const result = await getLuckyCoins('shareOnce');
    if (result.notYet || result.restricted || result.xUsed) throw new Error('分享奖励暂不可领取');
    return result.coins;
}
export function luckyHttpsUrl(value: unknown, label: string): string {
    if (typeof value !== 'string' || !value) throw new Error(label + '尚未配置');
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error(label + '必须使用 HTTPS');
    return url.href;
}
export async function getLuckySocialConfig(): Promise<LuckySocialConfig> {
    const data = record(await luckyRequest<unknown>(luckyRoutes.socialConfig));
    return {
        xUrl: typeof data.xUrl === 'string' ? data.xUrl : '',
        xHandle: typeof data.xHandle === 'string' ? data.xHandle : undefined,
        tgChannelJoinUrl: typeof data.tgChannelJoinUrl === 'string' ? data.tgChannelJoinUrl : '',
        tgChannel: typeof data.tgChannel === 'string' ? data.tgChannel : undefined,
        tgBotUrl: typeof data.tgBotUrl === 'string' ? data.tgBotUrl : '',
        telegramLinked: data.telegramLinked === true,
    };
}
function luckySocialReturnUrl(value?: string): string {
    const fallback = typeof window === 'undefined' ? 'https://localhost/lucky' : new URL('/lucky', window.location.origin).href;
    const url = new URL(value || fallback);
    if (typeof window !== 'undefined' && url.origin !== window.location.origin) throw new Error('X 授权返回地址必须与当前站点同源');
    return url.href;
}
export async function getLuckyTaskAction(task: Pick<LuckyTask, 'key'>, returnUrl?: string): Promise<LuckyTaskAction> {
    if (task.key === 'push_on') throw new Error('请在福利页完成“开启推送通知”任务');
    if (task.key === 'bind_x') {
        const value = await luckyRequest<{ url: string }>(luckyRoutes.bindX, { redirectTo: luckySocialReturnUrl(returnUrl) });
        return { url: luckyHttpsUrl(value.url, 'X 授权地址'), kind: 'x-oauth' };
    }
    const config = await getLuckySocialConfig();
    if (task.key === 'follow_x') return { url: luckyHttpsUrl(config.xUrl, '官方 X 地址'), kind: 'x-follow' };
    if (task.key === 'join_tg') {
        if (config.telegramLinked) return { url: luckyHttpsUrl(config.tgChannelJoinUrl, 'Telegram 频道地址'), kind: 'telegram-channel' };
        const token = await luckyRequest<string>(luckyRoutes.bindTelegram);
        if (typeof token !== 'string' || !token) throw new Error('Telegram 绑定 token 返回无效');
        const url = new URL(luckyHttpsUrl(config.tgBotUrl, 'Telegram 机器人地址'));
        url.searchParams.set('start', 'bind_' + token);
        return { url: url.href, kind: 'telegram-bind' };
    }
    throw new Error('不支持的福利任务');
}
export async function finishLuckyExternalTask(key: string): Promise<void> {
    if (key === 'follow_x') { const state = await checkLuckyX(); if (state.queued) await pause(3000); }
    if (key === 'join_tg') { await pause(2500); await getLuckyCoins('checkTel'); }
    await getLuckyTasks(true);
}
export async function getLuckyRatingQuota(): Promise<LuckyRatingQuota> {
    const data = await luckyRequest<LuckyRatingQuota>(luckyRoutes.ratingQuota);
    return valid(luckyRoutes.ratingQuota, data, isCount(data.left) && isCount(data.reward));
}
export async function getLuckyRatingCandidates(limit = 100, locale = 'zh-CN', staticBase = ''): Promise<LuckyRatingCandidate[]> {
    if (!Number.isInteger(limit) || limit < 1) throw new Error('limit 必须为正整数');
    const payload = await luckyRequest<unknown>(luckyRoutes.ratingCandidates, { score: 0 });
    const container = record(payload);
    const data = Array.isArray(payload) ? payload : container.data;
    if (!Array.isArray(data)) throw new Error('POST /api/' + luckyRoutes.ratingCandidates + '：返回列表格式无效');
    return data.slice(0, limit).map(raw => {
        const row = record(raw); const titles = record(row.titleI18n);
        const id = row.movieId ?? row.dramaId;
        if ((typeof id !== 'string' || !id.trim()) && (typeof id !== 'number' || !Number.isSafeInteger(id))) throw new Error('候选作品缺少 dramaId');
        const title = typeof row.title === 'string' && row.title.trim()
            ? row.title
            : titles[locale] ?? titles['zh-CN'] ?? titles.zh ?? titles.en ?? Object.values(titles)[0];
        const watched = Number(row.epsWatched ?? row.currentEpisode ?? row.episode ?? row.ep ?? row.lastEpisode ?? 0);
        if (typeof title !== 'string' || !isCount(watched)) throw new Error('候选作品缺少 title 或观看集数');
        const cover = row.coverPath ?? row.image ?? row.cover;
        const path = typeof cover === 'string' ? cover : '';
        const coverUrl = movieCoverUrl({ ...row, image: path, movie_id: id }, staticBase) ?? '';
        const currentRating = row.myRating ?? row.score ?? row.rating;
        return { dramaId: String(id), title, coverUrl, epsWatched: watched, myRating: isCount(currentRating) && currentRating <= 5 ? currentRating : 0 };
    });
}
export async function submitLuckyRating(dramaId: string, score: number): Promise<LuckyRatingResult> {
    if (!dramaId.trim()) throw new Error('dramaId 必填，必须来自当前剧');
    if (!Number.isInteger(score) || score < 1 || score > 5) throw new Error('评分必须为 1–5 的整数');
    await luckyRequest(luckyRoutes.rate, { dramaId: dramaId.trim(), score }, true);
    const result = await getLuckyCoins('watchRate');
    if (result.notYet || result.restricted || result.xUsed) throw new Error('评分已提交，评分奖励暂不可领取');
    return result.coins;
}
export async function toggleDramaLike(dramaId: number): Promise<{ liked?: boolean; count?: number }> {
    if (!Number.isSafeInteger(dramaId) || dramaId <= 0) throw new Error('dramaId 必须是当前剧的实际 ID');
    const data = record(await luckyRequest<unknown>(luckyRoutes.like, { dramaId }, true));
    const liked = data.liked ?? data.isLike;
    const count = data.count ?? data.likeCount ?? data.likes;
    return {
        ...(typeof liked === 'boolean' ? { liked } : {}),
        ...(isCount(count) ? { count } : {}),
    };
}
type LuckyPushConfig = { publicKey: string };
let pushConfigCache: { session: string; at: number; data: LuckyPushConfig } | undefined;
let pushConfigFlight: { session: string; promise: Promise<LuckyPushConfig> } | undefined;
export function getLuckyPushConfig(): Promise<LuckyPushConfig> {
    const key = session();
    if (pushConfigCache?.session === key && Date.now() - pushConfigCache.at < 5 * 60 * 1000) return Promise.resolve(pushConfigCache.data);
    if (pushConfigFlight?.session === key) return pushConfigFlight.promise;
    const promise = luckyRequest<LuckyPushConfig>(luckyRoutes.pushConfig).then(data => {
        valid(luckyRoutes.pushConfig, data, typeof data.publicKey === 'string' && /^[A-Za-z0-9_-]+$/.test(data.publicKey));
        if (session() === key) pushConfigCache = { session: key, at: Date.now(), data };
        return data;
    }).finally(() => { if (pushConfigFlight?.promise === promise) pushConfigFlight = undefined; });
    pushConfigFlight = { session: key, promise };
    return promise;
}
export async function saveLuckyPushSubscription(subscription: PushSubscription): Promise<void> {
    const data = subscription.toJSON();
    if (!data.endpoint || !data.keys?.p256dh || !data.keys.auth) throw new Error('浏览器未返回完整推送订阅');
    const result = claimResult(luckyRoutes.pushSubscribe, await luckyRequest(luckyRoutes.pushSubscribe, { endpoint: data.endpoint, keys: { p256dh: data.keys.p256dh, auth: data.keys.auth }, userAgent: navigator.userAgent }, true));
    if (result.restricted) throw new Error('当前账号暂不能开启推送奖励');
    if (result.notYet || result.pending) throw new Error('推送订阅尚未完成，请稍后重试');
    // The subscribe endpoint awards the one-time bonus itself. Refresh a ready
    // but unclaimed snapshot as well; never send a separate coin request.
    const tasks = record(useLuckyStore.getState().tasks);
    const pushTask = Array.isArray(tasks.once) ? tasks.once.map(record).find(task => task.key === 'push_on') : undefined;
    if (!Array.isArray(tasks.once) || (pushTask && pushTask.done !== true)) invalidateLucky();
}
