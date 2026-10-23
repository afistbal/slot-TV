import type { LuckyPageData } from '@/api/lucky';

// Reference: downloaded rewards_catalog / my_daily_tasks / promo_status responses.
// Demonstration only; no wheel, comments, foreign social handles or reward mutations.
export function createLuckyDemoData(): LuckyPageData {
    return {
        coins: 45,
        promo: { enabled: true, eligible: false, reason: 'no_week', nextOpenAt: null },
        daily: { earned: 15, total: 48, restricted: false, tasks: [
            { key: 'checkin', icon: 'check-circle', title: 'lucky_task_checkin', coins: 5, earned: 5, done: true, action: 'claim' },
            { key: 'streak', icon: 'flame', title: 'lucky_task_streak', description: 'lucky_task_streak_hint', coins: 3, earned: 0, done: false, action: 'go', to: '/foryou' },
            { key: 'share', icon: 'share', title: 'lucky_task_share', coins: 10, earned: 10, done: true, action: 'go', to: '/foryou' },
            { key: 'rating', icon: 'star', title: 'lucky_task_rating', description: 'lucky_task_rating_hint', coins: 15, earned: 0, done: false, action: 'go', to: '/lucky?rate=1' },
            { key: 'watch', icon: 'play', title: 'lucky_task_watch', description: 'lucky_task_watch_hint', coins: 15, earned: 0, done: false, action: 'go', to: '/foryou' },
        ] },
        newcomer: { total: 90, tasks: [
            { key: 'push_on', icon: 'bell', title: 'lucky_once_push', description: 'lucky_once_push_desc', coins: 30, done: false, ready: false, action: 'push' },
            { key: 'bind_x', icon: 'user', title: 'lucky_once_bind_x', description: 'lucky_once_bind_x_desc', coins: 20, done: false, ready: false, action: 'linkx' },
            { key: 'follow_x', icon: 'external', title: 'lucky_once_follow_x', description: 'lucky_once_follow_x_desc', coins: 20, done: false, ready: false, action: 'external' },
            { key: 'join_tg', icon: 'send', title: 'lucky_once_join_tg', description: 'lucky_once_join_tg_desc', coins: 20, done: false, ready: false, action: 'telegram' },
        ] },
        rewards: [
            { key: 'checkin', icon: 'check-circle', title: 'lucky_center_checkin', description: 'lucky_center_checkin_desc', to: '/lucky#daily' },
            { key: 'streak', icon: 'flame', title: 'lucky_center_streak', description: 'lucky_center_streak_desc', to: '/foryou' },
            { key: 'invite', icon: 'user', title: 'lucky_center_invite', description: 'lucky_center_invite_desc', to: '/affiliate' },
            { key: 'share', icon: 'share', title: 'lucky_center_share', description: 'lucky_center_share_desc', to: '/foryou' },
            { key: 'rating', icon: 'star', title: 'lucky_center_rating', description: 'lucky_center_rating_desc', to: '/lucky?rate=1' },
            { key: 'level', icon: 'trending', title: 'lucky_center_level', description: 'lucky_center_level_desc', to: '/profile' },
        ],
    };
}
