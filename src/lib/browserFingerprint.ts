import md5 from 'md5';

const DEVICE_UUID_KEY = 'device_uuid';

function getCanvasFingerprint(): string {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 240;
        canvas.height = 60;
        const ctx = canvas.getContext('2d');
        if (!ctx) return '';

        ctx.textBaseline = 'top';
        ctx.font = '16px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(0, 0, 120, 60);
        ctx.fillStyle = '#069';
        ctx.fillText('device_uuid', 2, 15);
        ctx.strokeStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.arc(80, 30, 20, 0, Math.PI * 2, true);
        ctx.stroke();

        return canvas.toDataURL();
    } catch {
        return '';
    }
}

function getWebGLRenderer(): string {
    try {
        const canvas = document.createElement('canvas');
        const gl =
            canvas.getContext('webgl') ??
            (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
        if (!gl) return '';

        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (!debugInfo) return '';

        return String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) ?? '');
    } catch {
        return '';
    }
}

/** 采集浏览器环境特征，用于生成稳定 device_uuid */
export function collectBrowserFingerprintRaw(): string {
    const nav = navigator;
    const scr = window.screen;

    return [
        nav.userAgent,
        nav.language,
        nav.languages?.join(',') ?? '',
        String(nav.platform ?? ''),
        String(nav.hardwareConcurrency ?? ''),
        String(nav.maxTouchPoints ?? ''),
        String((nav as Navigator & { deviceMemory?: number }).deviceMemory ?? ''),
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        String(scr.width),
        String(scr.height),
        String(scr.availWidth),
        String(scr.availHeight),
        String(scr.colorDepth),
        String(window.devicePixelRatio),
        getCanvasFingerprint(),
        getWebGLRenderer(),
    ].join('|');
}

export function getCachedDeviceUuid(): string | null {
    try {
        const value = localStorage.getItem(DEVICE_UUID_KEY)?.trim();
        return value || null;
    } catch {
        return null;
    }
}

/** 写入 localStorage 中的设备号 */
function persistDeviceUuid(deviceUuid: string): void {
    const value = deviceUuid.trim();
    if (!value) return;
    try {
        localStorage.setItem(DEVICE_UUID_KEY, value);
    } catch {
        /* ignore */
    }
}

/**
 * 首次访问：根据浏览器指纹生成 device_uuid 并写入 localStorage；
 * 之后始终复用同一值，保证匿名登录设备身份稳定。
 */
export function getOrCreateDeviceUuid(): string {
    const cached = getCachedDeviceUuid();
    if (cached) {
        return cached;
    }

    const deviceUuid = md5(collectBrowserFingerprintRaw());
    persistDeviceUuid(deviceUuid);
    return deviceUuid;
}
