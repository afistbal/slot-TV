import { shareOrigin } from '@/env';

const origin = () => (shareOrigin || 'https://yogoshort.com').replace(/\/+$/, '');

export function buildAffiliateShareUrl(uid: string): string {
    const id = uid.trim();
    if (!id) return '';
    return `https://yogoshort.com/share/cf${encodeURIComponent(id)}?s=share`;
}

export function buildDramaShareUrl(movieId: string | number): string {
    const id = String(movieId).trim();
    return id ? `${origin()}/share/${encodeURIComponent(id)}` : '';
}
