import { api, formatApiFailure, type IResult } from '@/api';

export type AffiliateState = 'in_progress' | 'active';

export type AffiliateEligibility = {
    state: AffiliateState;
    payers: number;
    gatePayers: number;
    invitedCount: number;
    /** 名下用户充值净额，单位为人民币分。 */
    invitedCents: number;
    /** 金额门槛，后端保留此字段名；单位为人民币分。 */
    gateNetUsdCents: number;
    referralCode?: string;
    referralUrl?: string;
};

export type AffiliateEarning = {
    id: string;
    orderDate: string;
    amountCents: number;
    entryStatus: 'pending' | 'available' | 'reversed';
    availableAt: string | null;
};

export type AffiliateSummary = {
    status: 'active';
    activatedAt: string;
    shareBps: number;
    referralCode: string;
    referralUrl: string;
    invitedCount: number;
    totalEarnedCents: number;
    pendingCents: number;
    availableCents: number;
    reversedCents: number;
    paidOutCents: number;
    earnings: AffiliateEarning[];
};

export type AffiliateFunnel = {
    holdDays: number;
    summary: {
        totalClicks: number;
        totalDevices: number;
        totalSignups: number;
        totalPayers: number;
        totalCommissionMicros: number;
    };
    daily: Array<{
        dt: string;
        clicks: number;
        devices: number;
        signups: number;
        payers: number;
        commissionMicros: number;
    }>;
};

export type AffiliateStatistics = {
    /** 推广收入区域。 */
    income: AffiliateSummary;
    /** 最近 30 天推广统计区域。 */
    stat: AffiliateFunnel;
};

export type AffiliateReferralClaim = {
    claimed: boolean;
    restricted: boolean;
    rewardMode: 'cash' | 'coins';
    inviteeCoins: number;
};

type AffiliateMethod = 'POST';
const AFFILIATE_DEVICE_ID_KEY = 'affiliate-referral-device-id';

/** 推广归因使用独立、随机并持久化的 UUID，不发送浏览器硬件指纹。 */
export function getOrCreateAffiliateDeviceId(): string {
    const cached = localStorage.getItem(AFFILIATE_DEVICE_ID_KEY)?.trim();
    if (cached) return cached;
    const deviceId = typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
            const random = crypto.getRandomValues(new Uint8Array(1))[0] & 15;
            const value = character === 'x' ? random : (random & 3) | 8;
            return value.toString(16);
        });
    localStorage.setItem(AFFILIATE_DEVICE_ID_KEY, deviceId);
    return deviceId;
}

export class AffiliateApiError extends Error {
    readonly method: AffiliateMethod;
    readonly endpoint: string;
    readonly httpStatus: number;
    readonly backendMessage: string;

    constructor(method: AffiliateMethod, path: string, result: IResult<unknown>) {
        const endpoint = `/api/${path}`;
        const httpStatus = result.httpStatus ?? 0;
        const backendMessage = result.m?.trim() || '接口未返回错误文案';
        super(formatApiFailure(method, path, result));
        this.name = 'AffiliateApiError';
        this.method = method;
        this.endpoint = endpoint;
        this.httpStatus = httpStatus;
        this.backendMessage = backendMessage;
    }
}

async function affiliateRequest<T>(
    method: AffiliateMethod,
    path: string,
    data?: Record<string, unknown>,
): Promise<T> {
    const result = await api<T>(path, {
        method: 'post',
        data,
        loading: false,
        toastOnError: false,
    });
    if (result.c !== 0) {
        throw new AffiliateApiError(method, path, result as IResult<unknown>);
    }
    return result.d;
}

export function getAffiliateEligibility(): Promise<AffiliateEligibility> {
    return affiliateRequest('POST', 'user/affiliate');
}

export function getAffiliateStatistics(): Promise<AffiliateStatistics> {
    return affiliateRequest('POST', 'user/stat', {});
}

export function claimAffiliateReferral(data: {
    code: string;
    deviceId: string;
}): Promise<AffiliateReferralClaim> {
    return affiliateRequest('POST', 'affiliate/referral/claim', data);
}

export function affiliateErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
