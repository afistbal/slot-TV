import { fbAttributionForPayCreate, reportFbLog } from '@/lib/fbAttribution';

export type PayCreateRequest = {
    payment: number;
    product_id: number;
    redirect: string;
};

/** 组装 `pay/create` POST body（附带缓存中的 _fbp / _fbc） */
export function buildPayCreateData(data: PayCreateRequest): Record<string, unknown> {
    return {
        ...data,
        ...fbAttributionForPayCreate(),
    };
}

/** `pay/create` 成功后：log `InitiateCheckout` */
export function reportPayCreateFbLog(sn: string | undefined | null) {
    const eventId = typeof sn === 'string' ? sn.trim() : '';
    if (!eventId) {
        return;
    }
    void reportFbLog('InitiateCheckout', eventId);
}
