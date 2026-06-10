function protocolFromBase(base: string): 'http' | 'https' {
    return /^http:\/\//i.test(base) ? 'http' : 'https';
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
        return s;
    }

    const base = String(staticBase ?? '').replace(/\/+$/, '');
    const path = s.replace(/^\/+/, '');

    if (s.startsWith('//')) {
        return `${protocolFromBase(base)}:${s}`;
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
        // ignore
    }

    return `${base}/${path}`;
}
