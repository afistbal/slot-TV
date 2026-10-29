export type LuckySpinMode = 'free' | 'paid' | 'ten' | 'gift' | 'ticket';
export type LuckyWheelSlot = { kind: string; v?: number; mult?: number };
export type LuckyWheelState = {
    enabled: boolean; eligible: boolean; peak: boolean; freeNeedsWatch: boolean;
    freeLeft: number; freeMax: number; giftSpins: number; tickets: number;
    paidMax: number; paidUsed: number; tenMax: number; tenUsed: number; tenPriceMult: number;
    coins: number; bets: number[]; faceFree: LuckyWheelSlot[]; faceTicket: LuckyWheelSlot[];
    facePaid: Record<string, LuckyWheelSlot[]>;
    peakEndsAt: string | null; endsAt: string | null; nextOpenAt: string | null;
    luckLevel: number; capCoins: number; winnersCoupon: number;
    giftSpinsPerTopup: number; luckPerTopup: number; freeGuaranteeCoupon: boolean;
    coupons: LuckyCoupon[]; prizes: LuckyPrizeRecord[];
};
export type LuckySpinDraw = { slotIdx: number; prizeKind: string; prizeValue: number };
export type LuckyCoupon = { id: string; pct: number; cap: number; expiresAt: string | null };
export type LuckyPrizeRecord = { id: string; prizeKind: string; prizeValue: number; createdAt: string | null };

const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const amount = (value: unknown) => typeof value === 'number' || typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
const count = (value: unknown) => Number.isSafeInteger(amount(value)) && amount(value) >= 0 ? amount(value) : 0;
const slots = (value: unknown): LuckyWheelSlot[] => {
    if (!Array.isArray(value) || value.length < 2 || value.length > 24) return [];
    if (value.some(raw => typeof object(raw).kind !== 'string')) return [];
    return value.map(raw => {
        const row = object(raw);
        return { kind: String(row.kind), ...(row.v != null ? { v: count(row.v) } : {}), ...(Number.isFinite(amount(row.mult)) && amount(row.mult) >= 0 ? { mult: amount(row.mult) } : {}) };
    });
};

/** Receives the project's camelized user/tasks.promo; no benchmark amounts become live defaults. */
export function decodeLuckyWheel(value: unknown): LuckyWheelState {
    const data = object(value);
    const bets = Array.isArray(data.bets) ? [...new Set(data.bets.map(count).filter(n => n > 0))].sort((a, b) => a - b) : [];
    return {
        enabled: data.enabled === true, eligible: data.eligible === true, peak: data.peak !== false,
        freeNeedsWatch: data.freeNeedsWatch === true,
        freeLeft: count(data.freeLeft), freeMax: count(data.freeMax), giftSpins: count(data.giftSpins), tickets: count(data.tickets),
        paidMax: count(data.paidMax), paidUsed: count(data.paidUsed), tenMax: count(data.tenMax), tenUsed: count(data.tenUsed),
        tenPriceMult: Number.isFinite(amount(data.tenPriceMult)) && amount(data.tenPriceMult) > 0 ? amount(data.tenPriceMult) : 0,
        coins: count(data.coins), bets, faceFree: slots(data.faceFree), faceTicket: slots(data.faceTicket),
        facePaid: Object.fromEntries(Object.entries(object(data.facePaid)).map(([bet, face]) => [bet, slots(face)])),
        peakEndsAt: typeof data.peakEndsAt === 'string' ? data.peakEndsAt : null,
        endsAt: typeof data.endsAt === 'string' ? data.endsAt : null,
        nextOpenAt: typeof data.nextOpenAt === 'string' ? data.nextOpenAt : null,
        luckLevel: count(data.luckLevel), capCoins: count(data.capCoins), winnersCoupon: count(data.winnersCoupon),
        giftSpinsPerTopup: count(data.giftSpinsPerTopup), luckPerTopup: count(data.luckPerTopup), freeGuaranteeCoupon: data.freeGuaranteeCoupon === true,
        coupons: (Array.isArray(data.coupons) ? data.coupons : data.coupon ? [data.coupon] : []).map(object).filter(row => row.id != null).map(row => ({ id: String(row.id), pct: count(row.pct), cap: count(row.cap), expiresAt: typeof row.expiresAt === 'string' ? row.expiresAt : null })),
        prizes: (Array.isArray(data.prizes) ? data.prizes : []).map(object).filter(row => row.id != null && typeof row.prizeKind === 'string').map(row => ({ id: String(row.id), prizeKind: String(row.prizeKind), prizeValue: count(row.prizeValue), createdAt: typeof row.createdAt === 'string' ? row.createdAt : null })),
    };
}

export function isLuckyWheelVisible(promo: { enabled: boolean; eligible: boolean }): boolean {
    return promo.enabled && promo.eligible;
}

/** Exact benchmark segment palette, including the final amber segment for odd pools. */
export function luckyWheelSegmentColor(index: number, total: number): string {
    return total % 2 === 1 && index === total - 1 ? '#b98c2a' : index % 2 ? '#e8c268' : '#1b1e22';
}

/** Matches the benchmark's priority, including the off-peak ticket-only phase. */
export function luckyWheelAction(state: LuckyWheelState, bet: number): LuckySpinMode | 'watch' | 'topup' | 'done' {
    if (!state.enabled || !state.eligible) return 'done';
    if (!state.peak) return state.tickets > 0 ? 'ticket' : 'done';
    if (state.freeLeft > 0) return state.freeNeedsWatch ? 'watch' : 'free';
    if (state.giftSpins > 0) return 'gift';
    if (state.paidUsed >= state.paidMax || !state.bets.includes(bet)) return state.tickets > 0 ? 'ticket' : 'done';
    if (state.coins < bet) return 'topup';
    return 'paid';
}

export function luckyWheelSlots(state: LuckyWheelState, mode: string, bet: number): LuckyWheelSlot[] {
    if (mode === 'ticket') return state.faceTicket;
    if (mode === 'free' || mode === 'watch') return state.faceFree;
    return state.facePaid[String(mode === 'gift' ? 50 : bet)] ?? [];
}

export function luckyPrizeLabel(kind: string, value: number, traditional = false): string {
    if (kind === 'coins') return `${value} ${traditional ? '金幣' : '金币'}`;
    if (kind === 'bonus_pct') return `${value}% ${traditional ? '儲值加贈' : '充值加赠'}`;
    if (kind === 'vip_day') return `VIP ${value} ${traditional ? '天' : '天'}`;
    if (kind === 'drama_ep') return `${traditional ? '解鎖' : '解锁'} ${value} 集`;
    if (kind === 'luck') return `${traditional ? '好運值' : '好运值'} +${value}`;
    return traditional ? '獎勵' : '奖励';
}
