import { shareOrigin } from '@/env';

const origin = () => (shareOrigin || 'https://yogoshort.com').replace(/\/+$/, '');

function withCfPrefix(value: string): string {
    const code = value.trim();
    if (!code) return '';
    return /^cf/i.test(code) ? `cf${code.slice(2)}` : `cf${code}`;
}

export function buildAffiliateShareUrl(uid: string): string {
    const id = uid.trim();
    if (!id) return '';
    const query = new URLSearchParams({ ref: id, s: 'share' });
    return `${origin()}/share/cf${encodeURIComponent(id)}?${query.toString()}`;
}

export function buildDramaShareUrl(movieId: string | number, referralCode = ''): string {
    const id = String(movieId).trim();
    if (!id) return '';

    const ref = withCfPrefix(referralCode);
    const query = ref ? `?${new URLSearchParams({ ref }).toString()}` : '';
    return `${origin()}/share/${encodeURIComponent(id)}${query}`;
}
