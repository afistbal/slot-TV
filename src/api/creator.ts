import { apiBaseURL } from '@/api/baseURL';

export type CreatorRecord = Record<string, unknown>;
export type CreatorDashboardData = CreatorRecord;

export function creatorRows(value: unknown): CreatorRecord[] {
    if (Array.isArray(value)) return value.filter((item): item is CreatorRecord => !!item && typeof item === 'object');
    if (value && typeof value === 'object') {
        const record = value as CreatorRecord;
        return creatorRows(record.items ?? record.data);
    }
    return [];
}

export function creatorText(value: unknown): string {
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? '✓' : '—';
    if (value && typeof value === 'object') {
        const record = value as CreatorRecord;
        return String(record['zh-CN'] ?? record.zh ?? record.en ?? Object.values(record)[0] ?? '');
    }
    return '';
}

function camelize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(camelize);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()), camelize(entry)]));
}

/** JSON operations share the documented envelope; media endpoints also accept a direct payload. */
export async function creatorRequest<T = CreatorRecord>(method: 'POST', path: string, data?: CreatorRecord | File): Promise<T> {
    const readPath = path.split('?')[0];
    const isRead = ['creator/dashboard', 'creator/earnings', 'creator/commissions', 'creator/payout-methods', 'creator/comments/dramas', 'creator/comments/episodes', 'creator/comments'].includes(readPath) || /^creator\/commissions\/[^/]+\/milestones$/.test(readPath);
    const demoPath = readPath.split('/').some((part) => part.startsWith('demo-')) || new URLSearchParams(path.split('?')[1] ?? '').get('id')?.startsWith('demo-');
    const demoBody = !(data instanceof File) && Object.entries(data ?? {}).some(([key, value]) => (key.endsWith('Id') || key === 'filePath') && typeof value === 'string' && (value.startsWith('demo-') || value.startsWith('demo/')));
    if (!isRead && (demoPath || demoBody)) {
        throw new Error('演示记录仅供查看，不提交真实业务操作 / 示範紀錄僅供查看');
    }
    const token = localStorage.getItem('token')?.trim();
    if (!token) throw new Error('请先登录 / 請先登入');
    const url = new URL(path.replace(/^\/+/, ''), new URL(apiBaseURL, window.location.origin));
    const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Accept-Language': localStorage.getItem('locale') ?? 'zh-CN' };
    let body: BodyInit | undefined;
    if (data instanceof File) {
        headers['Content-Type'] = data.type || 'application/octet-stream';
        body = data;
    } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(data ?? {});
    }
    const response = await fetch(url, { method, headers, body });
    const payload = await response.json().catch(() => null) as CreatorRecord | null;
    const error = payload?.error;
    if (!response.ok || error || (typeof payload?.c === 'number' && payload.c !== 0)) {
        const details = error && typeof error === 'object' ? error as CreatorRecord : null;
        const message = creatorText(details?.message ?? error ?? payload?.m) || response.statusText;
        const fields = details?.fieldErrors;
        const fieldMessage = fields && typeof fields === 'object' ? Object.entries(fields).map(([key, value]) => `${key}: ${creatorText(value)}`).join('；') : '';
        throw new Error(`${method} /api/${path} · ${response.status} · ${[message, fieldMessage].filter(Boolean).join('；')}`);
    }
    const result = payload && 'data' in payload ? payload.data : payload && 'd' in payload ? payload.d : payload;
    return camelize(result) as T;
}

export const creatorApi = {
    earnings: (query: CreatorRecord) => creatorRequest('POST', 'creator/earnings', query),
    createProduct: (body: CreatorRecord) => creatorRequest<CreatorRecord | string>('POST', 'creator/products', body),
    publishProduct: (id: string) => creatorRequest('POST', `creator/products/${encodeURIComponent(id)}/publish`, {}),
    unpublishProduct: (id: string) => creatorRequest('POST', `creator/products/${encodeURIComponent(id)}/unpublish`, {}),
    commissions: (query: CreatorRecord) => creatorRequest('POST', 'creator/commissions', query),
    milestones: (id: string) => creatorRequest('POST', `creator/commissions/${encodeURIComponent(id)}/milestones`),
    bid: (id: string, body: CreatorRecord) => creatorRequest('POST', `creator/commissions/${encodeURIComponent(id)}/bids`, body),
    deliver: (id: string, body: CreatorRecord) => creatorRequest('POST', `creator/milestones/${encodeURIComponent(id)}/deliver`, body),
    payoutMethods: () => creatorRequest('POST', 'creator/payout-methods'),
    addPayoutMethod: (body: CreatorRecord) => creatorRequest('POST', 'creator/payout-methods', body),
    payoutQuote: (body: CreatorRecord) => creatorRequest<CreatorRecord | string>('POST', 'creator/payout-quotes', body),
    payout: (quoteId: string) => creatorRequest('POST', 'creator/payouts', { quoteId }),
    disablePayoutMethod: (id: string) => creatorRequest('POST', `creator/payout-methods/${encodeURIComponent(id)}/disable`, {}),
    respondLicense: (id: string, accept: boolean) => creatorRequest('POST', `creator/licenses/${encodeURIComponent(id)}/respond`, { accept }),
    handle: (handle: string) => creatorRequest('POST', 'creator/handle', { handle }),
    profile: (body: CreatorRecord) => creatorRequest('POST', 'creator/profile', body),
    publicBio: (bio: string) => creatorRequest('POST', 'creator/public-bio', { bio }),
    commentDramas: (query: CreatorRecord) => creatorRequest('POST', 'creator/comments/dramas', query),
    commentEpisodes: (query: CreatorRecord) => creatorRequest('POST', 'creator/comments/episodes', query),
    comments: (query: CreatorRecord) => creatorRequest('POST', 'creator/comments', query),
    uploadProduct: (id: string, file: File) => creatorRequest('POST', `product/upload?id=${encodeURIComponent(id)}&filename=${encodeURIComponent(file.name)}`, file),
    uploadDelivery: (id: string, file: File) => creatorRequest<{ filePath: string }>('POST', `commission/upload?id=${encodeURIComponent(id)}&filename=${encodeURIComponent(file.name)}`, file),
};
