import { ttclidForPayCreate } from '@/lib/adAttribution';
import { fbAttributionForPayCreate } from '@/lib/fbAttribution';
import { reportPayLog } from '@/lib/payLog';

export type PayCreateRequest = {
    payment: number;
    product_id: number;
    redirect: string;
};

/** 组装 `pay/create` POST body（附带缓存中的 fbp / fbc / ttclid） */
export function buildPayCreateData(data: PayCreateRequest): Record<string, unknown> {
    return {
        ...data,
        ...fbAttributionForPayCreate(),
        ...ttclidForPayCreate(),
    };
}

/** `pay/create` 成功后仅调用 1 次 log（不带 request 三要素） */
export function reportPayCreateSessionLog(eventId?: string) {
    if (!eventId) {
        return;
    }
    void reportPayLog({
        event: 'InitiateCheckout',
        eventId,
    });
}
