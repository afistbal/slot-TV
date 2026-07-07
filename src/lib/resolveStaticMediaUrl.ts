function protocolFromBase(base: string): 'http' | 'https' {
    return /^http:\/\//i.test(base) ? 'http' : 'https';
}

function normalizeStaticBase(base: string): string {
    const trimmed = String(base ?? '').trim().replace(/\/+$/, '');
    return trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
}

function extractHostFromPath(path: string): string | null {
    const slashIdx = path.indexOf('/');
    if (slashIdx <= 0) {
        return null;
    }
    const host = path.slice(0, slashIdx);
    if (!host.includes('.') || !/^[a-z0-9.-]+$/i.test(host)) {
        return null;
    }
    return host;
}

/** Resolve API media paths against config.static. */
export function resolveStaticMediaUrl(raw: string, staticBase: string): string {
    const s = String(raw ?? '').trim();
    if (!s) {
        return '';
    }
    if (/^https?:\/\//i.test(s)) {
        return s;
    }

    const base = normalizeStaticBase(staticBase);
    const path = s.replace(/^\/+/, '');

    if (s.startsWith('//')) {
        return `https:${s}`;
    }

    const hostInPath = extractHostFromPath(path);
    if (hostInPath) {
        return `${protocolFromBase(base)}://${path}`;
    }

    if (!base) {
        return path || s;
    }

    try {
        const baseUrl = new URL(base.startsWith('http') ? base : `https://${base}`);
        if (path === baseUrl.host || path.startsWith(`${baseUrl.host}/`)) {
            return `${baseUrl.protocol}//${path}`;
        }
    } catch {
        // Keep the plain join fallback for non-URL config values.
    }

    return `${base}/${path}`;
}
