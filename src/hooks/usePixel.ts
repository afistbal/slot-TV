
import { useRef } from 'react';
import { FacebookPixel, type EventData, type TrackableEventName } from 'react-use-facebook-pixel';
import { isFacebookAnalytics, isTikTokAnalytics, setAnalyticsType, type AnalyticsType } from '@/lib/fbAttribution';

interface TiktokPixel {
    init(pixelId: string, advancedMatching?: {}, options?: {
        debug: boolean;
    }): Promise<void>;
    pageView(): void;
    track(event: unknown, data: unknown): void;
};

interface IPixel {
    instance: unknown | null;
    track(name: unknown, data?: unknown): void;
}

class _Facebook implements IPixel {
    instance: FacebookPixel | null = null;

    public track(name: unknown, data?: unknown) {
        this.instance?.trackEvent(name as TrackableEventName, data as EventData[TrackableEventName]);
    }
}

class _Tiktok {
    instance: TiktokPixel | null = null;

    public track(name: unknown, data?: unknown) {
        // 支付
        this.instance?.track(name, data);
    }
}

class Pixel {
    protected instance: Array<_Facebook | _Tiktok> = [];

    public addInstance(instance: _Facebook | _Tiktok) {
        this.instance.push(instance);
    }

    public track(name: unknown, data?: unknown) {
        const raw = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
        this.instance.forEach((instance) => {
            const payload =
                instance instanceof _Facebook
                    ? normalizeFbCommerceData(raw)
                    : normalizeCommerceData(raw);
            instance.track(name, payload);
        });
    }
}

const singleton = new Pixel();
let initialized = false;
let fbPixelId: string | null = null;
let pendingAnonymousCompleteRegistration = false;
let pendingPageViewUrl: string | null = null;
let pixelReady = false;
let lastPageView: { url: string; ts: number } | null = null;

const PAGE_VIEW_DEDUPE_MS = 400;

function flushAnonymousCompleteRegistration() {
    if (!pendingAnonymousCompleteRegistration || !pixelReady) {
        return;
    }
    pendingAnonymousCompleteRegistration = false;
    singleton.track('CompleteRegistration');
}

/** `login/anonymous` 成功时调用；若 Pixel 尚未 init，会在 init 完成后补发 */
export function trackAnonymousCompleteRegistration() {
    pendingAnonymousCompleteRegistration = true;
    flushAnonymousCompleteRegistration();
}

function markPixelReady() {
    pixelReady = true;
    flushAnonymousCompleteRegistration();
    flushPendingPageView();
}

function disableFbAutoPageView(pixelId: string) {
    if (typeof window === 'undefined') {
        return;
    }
    const fbq = (window as unknown as { fbq?: FbqFn & { disablePushState?: boolean } }).fbq;
    if (typeof fbq !== 'function') {
        return;
    }
    fbq.disablePushState = true;
    fbq('set', 'autoConfig', false, pixelId);
}

function buildPageViewEventId(): string {
    return `pv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** 标准 PageView（SPA 路由变化）；须 trackSingle，与 autoConfig:false 一致 */
function fireFbPageView(eventSourceUrl?: string): boolean {
    if (!fbPixelId || typeof window === 'undefined' || !isFacebookAnalytics()) {
        return false;
    }
    const fbq = (window as unknown as { fbq?: FbqFn }).fbq;
    if (typeof fbq !== 'function') {
        return false;
    }
    const url = eventSourceUrl || window.location.href;
    const eventID = buildPageViewEventId();
    fbq('trackSingle', fbPixelId, 'PageView', { eventSourceUrl: url }, { eventID });
    return true;
}

/** FB 渠道统一走 trackSingle */
function fireFbEvent(
    eventName: string,
    data: Record<string, unknown>,
    eventId?: string,
): boolean {
    if (!fbPixelId || typeof window === 'undefined' || !isFacebookAnalytics()) {
        return false;
    }
    const fbq = (window as unknown as { fbq?: FbqFn }).fbq;
    if (typeof fbq !== 'function') {
        return false;
    }
    const payload = normalizeFbCommerceData(data);
    if (eventId) {
        fbq('trackSingle', fbPixelId, eventName, payload, { eventID: eventId });
    } else {
        fbq('trackSingle', fbPixelId, eventName, payload);
    }
    return true;
}

function flushPendingPageView() {
    if (!pendingPageViewUrl || !pixelReady) {
        return;
    }
    const url = pendingPageViewUrl;
    pendingPageViewUrl = null;
    if (!isFacebookAnalytics() && !isTikTokAnalytics()) {
        return;
    }
    if (isTikTokAnalytics()) {
        lastPageView = { url, ts: Date.now() };
        singleton.track('PageView', { event_source_url: url });
        return;
    }
    if (isFacebookAnalytics() && !fbPixelId) {
        pendingPageViewUrl = url;
        return;
    }
    if (!fireFbPageView(url)) {
        pendingPageViewUrl = url;
        return;
    }
    lastPageView = { url, ts: Date.now() };
}

export async function init(config: { [key: string]: unknown }) {
    if (!config['analyzation']) {
        setAnalyticsType('');
        initialized = true;
        markPixelReady();
        return;
    }
    if (initialized) {
        markPixelReady();
        return;
    }

    const initializeFacebookPixel = async (id: string) => {
        fbPixelId = id;
        const instance = new FacebookPixel({
            pixelID: id,
            pageViewOnInit: false,
            autoConfig: false,
            debug: false,
        });

        instance.init({});
        disableFbAutoPageView(id);
        window.setTimeout(() => disableFbAutoPageView(id), 1000);

        const facebook = new _Facebook();
        facebook.instance = instance;
        singleton.addInstance(facebook);
    };

    const intitalizeTiktokPixel = async (id: string) => {
        const instance = (await import('tiktok-pixel')).default;

        instance.init(id);
        const tiktok = new _Tiktok();
        tiktok.instance = instance;
        singleton.addInstance(tiktok);
    }

    const analyzation = config['analyzation'] as { type: AnalyticsType, id: string };
    setAnalyticsType(analyzation.type);
    if (analyzation.type === '') {
        initialized = true;
        markPixelReady();
        return;
    }

    switch (analyzation.type) {
        case 'facebook':
            await initializeFacebookPixel(analyzation.id);
            break;
        case 'tiktok':
            await intitalizeTiktokPixel(analyzation.id);
            break;
    }

    initialized = true;
    markPixelReady();
}

const usePixel = () => {
    const pixel = useRef<Pixel>(singleton);
    return pixel.current;
};

type FbqFn = (...args: unknown[]) => void;

type FbStandardEvent = 'AddToCart' | 'InitiateCheckout' | 'Purchase';

function toNumericValue(value: string | number | undefined | null): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    const n = parseFloat(String(value ?? ''));
    return Number.isFinite(n) ? n : 0;
}

function enrichFbPixelData(data: Record<string, unknown>): Record<string, unknown> {
    if (typeof window === 'undefined') {
        return data;
    }
    return { ...data, eventSourceUrl: window.location.href };
}

function enrichTikTokPixelData(data: Record<string, unknown>): Record<string, unknown> {
    if (typeof window === 'undefined') {
        return data;
    }
    return { ...data, event_source_url: window.location.href };
}

function applyCommerceFields(data: Record<string, unknown>): Record<string, unknown> {
    const out = { ...data };
    if (out.value != null && typeof out.value !== 'number') {
        out.value = toNumericValue(out.value as string | number);
    }
    const ids = out.content_ids as string[] | undefined;
    if (ids?.length && !out.contents) {
        const itemPrice = toNumericValue(out.value as string | number | undefined);
        out.contents = ids.map((id) => ({ id, quantity: 1, item_price: itemPrice }));
    }
    if (!out.content_type && ids?.length) {
        out.content_type = 'product';
    }
    return out;
}

/** FB：补全 eventSourceUrl / contents / value */
function normalizeFbCommerceData(data: Record<string, unknown>): Record<string, unknown> {
    return applyCommerceFields(enrichFbPixelData({ ...data }));
}

/** TikTok 等：event_source_url；补全 contents / value */
function normalizeCommerceData(data: Record<string, unknown>): Record<string, unknown> {
    return applyCommerceFields(enrichTikTokPixelData({ ...data }));
}

/** 手动 PageView（SPA 路由变化）；init 前排队补发 */
export function trackPageView(eventSourceUrl?: string) {
    if (typeof window === 'undefined') {
        return;
    }
    const url = eventSourceUrl || window.location.href;
    const now = Date.now();

    if (!pixelReady || (isFacebookAnalytics() && !fbPixelId)) {
        pendingPageViewUrl = url;
        return;
    }

    if (!isFacebookAnalytics() && !isTikTokAnalytics()) {
        return;
    }

    if (
        lastPageView &&
        lastPageView.url === url &&
        now - lastPageView.ts < PAGE_VIEW_DEDUPE_MS
    ) {
        return;
    }

    if (isTikTokAnalytics()) {
        lastPageView = { url, ts: now };
        singleton.track('PageView', { event_source_url: url });
        return;
    }

    if (!fireFbPageView(url)) {
        pendingPageViewUrl = url;
        return;
    }
    lastPageView = { url, ts: now };
}

export function buildProductPixelPayload(opts: {
    id: number | string;
    price: string | number;
    currency?: string;
    name?: string;
}): Record<string, unknown> {
    const id = String(opts.id);
    const value = toNumericValue(opts.price);
    const currency = opts.currency ?? 'USD';
    return {
        content_type: 'product',
        content_ids: [id],
        contents: [{ id, quantity: 1, item_price: value }],
        value,
        currency,
        ...(opts.name ? { content_name: opts.name } : {}),
    };
}

const viewedProductIds = new Set<string>();

export function trackViewContent(
    productId: number | string,
    data: Record<string, unknown>,
) {
    const pageKey =
        typeof window !== 'undefined'
            ? `${window.location.pathname}${window.location.search}`
            : '';
    const key = `${productId}@${pageKey}`;
    if (viewedProductIds.has(key)) {
        return;
    }
    viewedProductIds.add(key);
    if (!fireFbEvent('ViewContent', data)) {
        singleton.track('ViewContent', data);
    }
}

/** fbq 第 4 参数传 `eventID`（对应请求里的 `eid`），与 CAPI / 后端 `sn` 去重 */
function trackFbStandardEvent(
    eventName: FbStandardEvent,
    data: Record<string, unknown>,
    eventId?: string,
) {
    if (isTikTokAnalytics()) {
        singleton.track(
            eventName,
            eventId ? { ...normalizeCommerceData(data), eventID: eventId } : normalizeCommerceData(data),
        );
        return;
    }
    if (!fireFbEvent(eventName, data, eventId)) {
        const payload = normalizeFbCommerceData(data);
        singleton.track(
            eventName,
            eventId ? { ...payload, eventID: eventId } : payload,
        );
    }
}

export function trackFbAddToCart(
    data: Record<string, unknown>,
    eventId?: string,
) {
    trackFbStandardEvent('AddToCart', data, eventId);
}

export function trackFbInitiateCheckout(
    data: Record<string, unknown>,
    eventId?: string,
) {
    trackFbStandardEvent('InitiateCheckout', data, eventId);
}

export function trackFbPurchase(
    data: Record<string, unknown>,
    eventId?: string,
) {
    if (isTikTokAnalytics()) {
        const payload = normalizeCommerceData(data);
        singleton.track(
            'CompletePayment',
            eventId ? { ...payload, eventID: eventId } : payload,
        );
        return;
    }
    trackFbStandardEvent('Purchase', data, eventId);
}

export default usePixel;