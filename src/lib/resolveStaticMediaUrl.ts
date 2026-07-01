function protocolFromBase(base: string): 'http' | 'https' {
    return /^http:\/\//i.test(base) ? 'http' : 'https';
}

function forceCosHttps(url: string): string {
    return url.replace(/^http:\/\/cos\.yogoshort\.com\//i, 'https://cos.yogoshort.com/');
}

/** `cos.yogoshort.com/path` — host + path，无 scheme */
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

/**
 * 将 API 相对 video / 静态资源路径拼成绝对 URL。
 * 兼容：`https://…`、协议相对 `//…`、纯路径、`cos.example.com/…`（勿与 static 再拼一次 host）。
 */
export function resolveStaticMediaUrl(raw: string, staticBase: string): string {
    const s = String(raw ?? '').trim();
    if (!s) {
        return '';
    }
    if (/^https?:\/\//i.test(s)) {
        return forceCosHttps(s);
    }

    const base = String(staticBase ?? '').replace(/\/+$/, '');
    const path = s.replace(/^\/+/, '');

    if (s.startsWith('//')) {
        const protocol = /^\/\/cos\.yogoshort\.com\//i.test(s) ? 'https' : protocolFromBase(base);
        return `${protocol}:${s}`;
    }

    const hostInPath = extractHostFromPath(path);
    if (hostInPath) {
        const protocol = /^cos\.yogoshort\.com$/i.test(hostInPath) ? 'https' : protocolFromBase(base);
        return `${protocol}://${path}`;
    }

    if (!base) {
        return path || s;
    }

    try {
        const baseUrl = new URL(base.startsWith('http') ? base : `https://${base}`);
        if (path === baseUrl.host || path.startsWith(`${baseUrl.host}/`)) {
            return forceCosHttps(`${baseUrl.protocol}//${path}`);
        }
    } catch {
        // ignore
    }

    return forceCosHttps(`${base}/${path}`);
}
