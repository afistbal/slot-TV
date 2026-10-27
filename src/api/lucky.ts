import { movieCoverUrl } from '@/lib/movieCoverUrl';
import { api, formatApiFailure } from '@/api';
import { camelLuckyPayload, decodeLuckyCatalog, decodeLuckyTasks, luckyClaimableBadge } from '@/lib/luckyPageData';
import { useLuckyStore } from '@/stores/lucky';

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
    checkin?: LuckyCheckin; watchStreak?: LuckyWatchStreak;
};
export type LuckyPageResult = { data: LuckyPageData; demo: boolean; error?: string; notice?: string; pendingSchema?: boolean; rawResponses?: { tasks?: unknown; rewards?: unknown } };
export type LuckyClaimResult = { coins?: number; already?: boolean; notYet?: boolean; restricted?: boolean; xUsed?: boolean; streak?: number; milestoneCoins?: number; pending?: boolean };
export type LuckySocialActionKind = 'x-oauth' | 'x-follow' | 'telegram-bind' | 'telegram-channel';
export type LuckyTaskAction = { url: string; kind: LuckySocialActionKind };
export type LuckyRatingQuota = { left: number; reward: number };
export type LuckyRatingCandidate = { dramaId: string; title: string; coverUrl: string; epsWatched: number; myRating?: number };
export type LuckyRatingResult = number | undefined;
export type LuckyCoinType = 'watchMore' | 'shareOnce' | 'sendComment' | 'watchRate' | 'watchMovie' | 'subNotice' | 'bindX' | 'subTel' | 'checkTel';
export type LuckySocialConfig = { xUrl: string; xHandle?: string; tgChannelJoinUrl: string; tgChannel?: string; tgBotUrl: string; telegramLinked?: boolean };

// Backend implementation contracts approved by the user; these are our planned
// REST adapters, NOT purported original chunlou REST endpoints. All use POST.
export const luckyRoutes = {
    tasks: 'user/tasks', rewards: 'user/rewards', coin: 'user/coin', checkin: 'user/checkin', signin: 'user/signin',
    watchStreak: 'user/watch/streak', ratingQuota: 'user/rating/quota',
    ratingCandidates: 'movie/history', rate: 'user/rate', like: 'user/like', pushConfig: 'user/push/config',
    pushSubscribe: 'user/push/subscribe', pushUnsubscribe: 'user/push/unsubscribe', socialConfig: 'user/social/config',
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
function invalidateLucky() { taskCache = undefined; pageCache = undefined; useLuckyStore.getState().invalidate(); }
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
const session = () => typeof localStorage === 'undefined' ? '' : localStorage.getItem('token') ?? '';
export function getLuckyTasks(force = false): Promise<unknown> {
    const key = session();
    const luckyStore = useLuckyStore.getState();
    if (taskCache?.session !== key) taskCache = undefined;
    if (luckyStore.tasksSession !== key) luckyStore.clearTasks();
    if (!force && taskCache && Date.now() - taskCache.at < 30000) return Promise.resolve(taskCache.data);
    const stored = useLuckyStore.getState();
    if (!force && stored.tasks !== undefined && stored.tasksSession === key && Date.now() - stored.tasksUpdatedAt < 30000) return Promise.resolve(stored.tasks);
    if (taskFlight?.session === key) return taskFlight.promise;
    const promise = luckyRequest<unknown>(luckyRoutes.tasks, {}, true).then(data => {
        if (key === session()) {
            taskCache = { session: key, at: Date.now(), data };
            useLuckyStore.getState().setTasks(data, key, luckyClaimableBadge(data));
        }
        return data;
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
export function getCachedLuckyPage(locale = 'zh-CN'): LuckyPageResult | undefined {
    const key = session();
    const cached = pageCache?.session === key && pageCache.locale === locale ? pageCache.result : undefined;
    const stored = useLuckyStore.getState();
    if (stored.tasks === undefined || stored.tasksSession !== key) return cached;
    try {
        const tasks = decodeLuckyTasks(stored.tasks, locale);
        if (cached) return { ...cached, data: { ...cached.data, ...tasks }, rawResponses: { ...cached.rawResponses, tasks: stored.tasks } };
        return { data: { ...tasks, ...decodeLuckyCatalog(undefined, locale) }, demo: false, rawResponses: { tasks: stored.tasks } };
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
export async function getLuckyPage(createDemo: () => LuckyPageData, locale = 'zh-CN', force = false): Promise<LuckyPageResult> {
    const key = session();
    const tasksPromise = Promise.resolve().then(() => getLuckyTasks(force));
    const rewardsPromise = Promise.resolve().then(() => getLuckyRewards(force));
    const tasks = await tasksPromise.then(
        value => ({ status: 'fulfilled', value } as const),
        reason => ({ status: 'rejected', reason } as const),
    );
    const rewards = await Promise.race([
        rewardsPromise.then(
            value => ({ pending: false, result: { status: 'fulfilled', value } as const } as const),
            reason => ({ pending: false, result: { status: 'rejected', reason } as const } as const),
        ),
        pause(180).then(() => ({ pending: true } as const)),
    ]);
    if (rewards.pending) {
        void rewardsPromise.finally(() => {
            if (key === session()) useLuckyStore.getState().invalidate();
        }).catch(() => undefined);
    }
    const rawResponses: { tasks?: unknown; rewards?: unknown } = {};
    if (tasks.status === 'fulfilled') rawResponses.tasks = tasks.value;
    if (!rewards.pending && rewards.result.status === 'fulfilled') rawResponses.rewards = rewards.result.value;
    const settled = rewards.pending ? [tasks] : [tasks, rewards.result];
    const errors = settled.flatMap(result => result.status === 'rejected' ? [result.reason instanceof Error ? result.reason.message : String(result.reason)] : []);
    try {
        if (tasks.status === 'rejected') throw tasks.reason;
        const data: LuckyPageData = { ...decodeLuckyTasks(tasks.value, locale), ...decodeLuckyCatalog(rawResponses.rewards, locale) };
        const result = { data, demo: false, error: errors.join('\n') || undefined, rawResponses,
            notice: !rewards.pending && rawResponses.rewards == null ? '奖励配置暂未返回，任务进度已按真实数据展示。' : undefined };
        pageCache = { session: key, locale, result };
        return result;
    } catch (reason) {
        const message = reason instanceof Error ? reason.message : String(reason);
        return { data: withoutLuckyComments(createDemo()), demo: true, error: [...new Set([...errors, message])].join('\n'), rawResponses };
    }
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
    const types: Record<string, LuckyCoinType> = { streak: 'watchMore', share: 'shareOnce', rating: 'watchRate', watch: 'watchMovie', push_on: 'subNotice', bind_x: 'bindX', join_tg: 'subTel' };
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
    if (task.key === 'push_on') throw new Error('请在福利页“通知设置”中开启真实推送订阅');
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
export async function getLuckyPushConfig(): Promise<{ publicKey: string }> {
    const data = await luckyRequest<{ publicKey: string }>(luckyRoutes.pushConfig);
    return valid(luckyRoutes.pushConfig, data, typeof data.publicKey === 'string' && /^[A-Za-z0-9_-]+$/.test(data.publicKey));
}
export async function saveLuckyPushSubscription(subscription: PushSubscription): Promise<void> {
    const data = subscription.toJSON();
    if (!data.endpoint || !data.keys?.p256dh || !data.keys.auth) throw new Error('浏览器未返回完整推送订阅');
    await luckyRequest(luckyRoutes.pushSubscribe, { endpoint: data.endpoint, keys: { p256dh: data.keys.p256dh, auth: data.keys.auth }, userAgent: navigator.userAgent }, true);
    invalidateLucky();
}
export async function removeLuckyPushSubscription(endpoint: string): Promise<void> {
    await luckyRequest(luckyRoutes.pushUnsubscribe, { endpoint }, true);
    invalidateLucky();
}
