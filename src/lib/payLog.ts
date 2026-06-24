import { api } from '@/api';
import {
    getStoredFbp,
    getStoredFbc,
    isFacebookAnalytics,
    syncFbAttributionCache,
    type FbLogEventName,
} from '@/lib/fbAttribution';
import { getUserUidForDisplay } from '@/lib/formatUserUniqueIdForDisplay';
import { useUserStore } from '@/stores/user';

/** 与后端约定：success=支付成功 / error=支付失败 / padding=点击三方支付按钮 */
export type PayLogStatus = 'success' | 'error' | 'padding';

export type PayLogEvent =
    | 'pay_create'
    | 'pay_complete'
    | 'AddToCart'
    | 'InitiateCheckout'
    | 'Purchase';

export type PayLogRequest = {
    url: string;
    params?: Record<string, unknown>;
    response?: unknown;
};

export type ReportPayLogInput = {
    event: PayLogEvent;
    /** padding/success/error 仅三方按钮点击后的支付流程使用；create 阶段不传 */
    status?: PayLogStatus;
    /** create 阶段不传；三方按钮点击后的 padding/success/error 才带请求三要素 */
    request?: PayLogRequest;
    /** 订单 sn / eid，FB 去重与业务关联 */
    eventId?: string;
    meta?: Record<string, unknown>;
};

const SENSITIVE_KEYS = new Set([
    'client_secret',
    'token',
    'authorization',
    'password',
]);

function sanitizeValue(key: string, value: unknown): unknown {
    if (SENSITIVE_KEYS.has(key)) {
        return '[redacted]';
    }
    if (value && typeof value === 'object') {
        return sanitizePayload(value);
    }
    return value;
}

function sanitizePayload(value: unknown): unknown {
    if (value == null || typeof value !== 'object') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((item) => sanitizePayload(item));
    }
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        out[key] = sanitizeValue(key, val);
    }
    return out;
}

function serializeError(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
        return { name: error.name, message: error.message };
    }
    if (error && typeof error === 'object') {
        return sanitizePayload(error) as Record<string, unknown>;
    }
    return { message: String(error) };
}

function getUserContext(): { user: { uid: string; email: string } } {
    const { info } = useUserStore.getState();
    const uid = getUserUidForDisplay(info ?? undefined);
    const email = typeof info?.['email'] === 'string' ? info['email'] : '';
    return {
        user: { uid, email },
    };
}

function fbPayloadForEvent(
    event: PayLogEvent,
    eventId?: string,
): Record<string, unknown> | undefined {
    if (!isFacebookAnalytics() || !eventId) {
        return undefined;
    }
    if (event !== 'AddToCart' && event !== 'InitiateCheckout' && event !== 'Purchase') {
        return undefined;
    }
    return {
        event: event as FbLogEventName,
        eventId,
        fbp: getStoredFbp(),
        fbc: getStoredFbc(),
    };
}

/** 上报 `log`：user + event + status + 请求三要素（url / params / response） */
export async function reportPayLog(input: ReportPayLogInput): Promise<void> {
    syncFbAttributionCache();
    const { user } = getUserContext();
    const payload: Record<string, unknown> = {
        user,
        event: input.event,
    };
    if (input.request) {
        payload.request = {
            url: input.request.url,
            params: input.request.params ? sanitizePayload(input.request.params) : undefined,
            response: input.request.response !== undefined
                ? sanitizePayload(input.request.response)
                : undefined,
        };
    }
    if (input.status) {
        payload.status = input.status;
    }
    if (input.eventId) {
        payload.eventId = input.eventId;
    }
    if (input.meta && Object.keys(input.meta).length > 0) {
        payload.meta = sanitizePayload(input.meta);
    }
    const fb = fbPayloadForEvent(input.event, input.eventId);
    if (fb) {
        payload.fb = fb;
    }

    try {
        await api('log', {
            method: 'post',
            loading: false,
            toastOnError: false,
            data: payload,
        });
    } catch {
        // 日志失败不阻塞主流程
    }
}

export { serializeError };
