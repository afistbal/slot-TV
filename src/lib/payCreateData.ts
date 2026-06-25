import { ttclidForPayCreate } from '@/lib/adAttribution';
import { fbAttributionForPayCreate } from '@/lib/fbAttribution';
import { reportPayLog } from '@/lib/payLog';

export type PayCreateRequest = {
    payment: number;
    product_id: number;
    redirect: string;
    /** 挽留优惠档位（product/offers.discount_type） */
    discount_type?: number;
};

/** 组装 `pay/create` POST body（FB 传 fbp / fbc / TT 传 ttclid，按 Pixel 渠道互斥） */
export function buildPayCreateData(data: PayCreateRequest): Record<string, unknown> {
    const payload: Record<string, unknown> = {
        ...data,
        ...fbAttributionForPayCreate(),
        ...ttclidForPayCreate(),
    };
    if (data.discount_type == null) {
        delete payload.discount_type;
    }
    return payload;
}

/** `pay/create` 成功后仅调用 1 次 log（不带 request 三要素） */
export function reportPayCreateSessionLog(eventId?: string) {
    if (!eventId) {
        return;
    }
    void reportPayLog({
        event: 'AddToCart',
        eventId,
    });
}
