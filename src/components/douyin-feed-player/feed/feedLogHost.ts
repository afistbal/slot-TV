/** 仅 localhost / IP 访问时展示调试日志按钮（正式、测试域名均不展示） */

function isIpv4Host(hostname: string): boolean {
    const parts = hostname.split('.');
    if (parts.length !== 4) {
        return false;
    }
    return parts.every((part) => {
        if (!/^\d+$/.test(part)) {
            return false;
        }
        const n = Number(part);
        return n >= 0 && n <= 255;
    });
}

export function isLocalOrIpHostname(hostname: string): boolean {
    const h = hostname.trim().toLowerCase();
    if (!h) {
        return false;
    }
    if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]') {
        return true;
    }
    return isIpv4Host(h);
}

export function shouldShowFeedLogExportChip(): boolean {
    if (!import.meta.env.DEV) {
        return false;
    }
    if (typeof window === 'undefined') {
        return false;
    }
    return isLocalOrIpHostname(window.location.hostname);
}
