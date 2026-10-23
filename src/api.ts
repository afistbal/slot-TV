import ky from 'ky';
import { toast } from 'sonner';
import { useLoadingStore } from './stores/loading';
import { apiBaseURL } from './api/baseURL';
import { encryptRequestPayload, isWebCryptoAvailable } from './lib/requestEncryption';
import { normalizeAppLocaleCode } from './lib/messagesForLocale';

/** POST 加密：`VITE_API_REQUEST_ENCRYPTION=true|false` 可覆盖；默认可用 Web Crypto 时加密（localhost/https），局域网 IP http 自动明文 */
function resolveApiRequestEncryptionEnabled(): boolean {
    const flag = import.meta.env.VITE_API_REQUEST_ENCRYPTION;
    if (flag === 'false') {
        return false;
    }
    if (flag === 'true') {
        return isWebCryptoAvailable();
    }
    return isWebCryptoAvailable();
}

let loggedInsecureCryptoFallback = true;

function resolvePostPayload(
    path: string,
    data?: { [key: string]: unknown },
): { requestPath: string; payload: { [key: string]: unknown } } {
    let requestPath = path;
    const payload: { [key: string]: unknown } = { ...(data ?? {}) };
    const queryIndex = requestPath.indexOf('?');

    if (queryIndex !== -1) {
        const queryString = requestPath.slice(queryIndex + 1);
        requestPath = requestPath.slice(0, queryIndex);
        new URLSearchParams(queryString).forEach((value, key) => {
            payload[key] = value;
        });
    }

    return { requestPath, payload };
}

export interface IResult<T> {
    c: number,
    m: string,
    d: T,
    /** 原始 HTTP 状态，供页面展示具体接口诊断信息。网络层失败时为 0。 */
    httpStatus?: number,
    /** 实际请求的 API 相对路径。 */
    path?: string,
}

export interface IPagination {
    current_page: number,
    per_page: number,
    /** 總條數（分頁總頁數 = ceil(count / per_page)） */
    count?: number,
    data: { [key: string]: unknown }[],
}

export type TData = { [key: string]: unknown };

const HTTP_STATUS_TEXT: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
};

/** 将业务错误转换成可直接展示的“方法 + 接口 + HTTP 状态 + 后端文案”。 */
export function formatApiFailure(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    result: Pick<IResult<unknown>, 'm' | 'httpStatus'>,
): string {
    const endpoint = `/api/${path.replace(/^\/+/, '')}`;
    const status = result.httpStatus ?? 0;
    const statusText = status === 0
        ? 'Network Error'
        : `${status}${HTTP_STATUS_TEXT[status] ? ` ${HTTP_STATUS_TEXT[status]}` : ''}`;
    return `${method} ${endpoint}：${statusText} · ${result.m?.trim() || '接口未返回错误文案'}`;
}

/** 同时兼容旧接口 {c,m,d} 与创作者/推广合同使用的 {data,error}。 */
function normalizeResponsePayload<T>(payload: unknown): IResult<T> | null {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    const record = payload as Record<string, unknown>;
    if (typeof record.c === 'number') {
        return {
            c: record.c,
            m: typeof record.m === 'string' ? record.m : typeof record.message === 'string' ? record.message : '',
            d: record.d as T,
        };
    }
    if (!('data' in record) && !('error' in record)) return null;
    if (record.error) {
        const error = record.error;
        if (typeof error === 'string') return { c: 1, m: error, d: null as T };
        if (typeof error === 'object' && error !== null) {
            const details = error as Record<string, unknown>;
            const code = typeof details.code === 'string' ? details.code.trim() : '';
            const message = typeof details.message === 'string' ? details.message.trim() : '';
            return { c: 1, m: [code, message].filter(Boolean).join(' · ') || '接口未返回错误文案', d: null as T };
        }
        return { c: 1, m: '接口返回未知错误', d: null as T };
    }
    return { c: 0, m: '', d: record.data as T };
}

/** Error pages may return {message} rather than the business response envelope. */
function responseFailureMessage(payload: unknown): string {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return '';
    const record = payload as Record<string, unknown>;
    const error = record.error;
    const details = error && typeof error === 'object' ? error as Record<string, unknown> : null;
    const message = [details?.message, typeof error === 'string' ? error : null, record.message, record.m]
        .find((value): value is string => typeof value === 'string' && !!value.trim());
    const code = typeof details?.code === 'string' ? details.code : typeof record.code === 'string' ? record.code : '';
    return [code, message?.trim()].filter(Boolean).join(' · ');
}

function resolveOperatingSystem(): string {
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (userAgent.includes('android')) return 'android';
    if (/iphone|ipad|ipod/.test(userAgent)) return 'ios';
    if (userAgent.includes('windows')) return 'windows';
    if (userAgent.includes('mac os')) return 'macos';
    if (userAgent.includes('linux')) return 'linux';
    return 'unknown';
}

const operatingSystem = resolveOperatingSystem();


export async function api<T = TData>(path: string, options?: {
    loading?: boolean,
    method?: 'get' | 'post',
    data?: { [key: string]: unknown },
    headers?: Record<string, string | undefined>,
    toastOnError?: boolean,
}): Promise<IResult<T>> {
    const { requestPath, payload } = resolvePostPayload(path, options?.data);

    if (options?.loading !== false) {
        useLoadingStore.setState({ status: true });
    }

    try {
        const storedToken = localStorage.getItem('token')?.trim();
        const requestHeaders: Record<string, string | undefined> = {
            ...(storedToken ? { Authorization: `Bearer ${storedToken}` } : {}),
            'Accept-Language': normalizeAppLocaleCode(localStorage.getItem('locale') ?? 'zh-CN'),
            Accept: 'application/json',
            'X-Platform': 'web',
            'X-OS': operatingSystem,
            'X-Test': localStorage.getItem('test') ?? '',
            'X-Source': localStorage.getItem('source') ?? '',
            ...options?.headers,
        };

        const requestMethod = options?.method ?? 'post';
        const useEncryption = requestMethod === 'post' && resolveApiRequestEncryptionEnabled();
        if (requestMethod === 'post' && !useEncryption && import.meta.env.DEV && !loggedInsecureCryptoFallback) {
            loggedInsecureCryptoFallback = true;
            console.warn(
                '[api] Web Crypto 不可用（常见于 http://局域网IP），POST 请求将以明文发送；localhost 或 https 下会自动加密',
            );
        }
        let requestBody: string | undefined;

        if (useEncryption) {
            if (requestPath === 'product') {
                console.log('[api/product] before encrypt', { path: requestPath, payload });
            }
            const encrypted = await encryptRequestPayload(payload);
            Object.assign(requestHeaders, encrypted.headers);
            requestBody = encrypted.body;
        }

        const response = await ky(requestPath, {
            prefixUrl: apiBaseURL,
            method: requestMethod,
            headers: requestHeaders,
            timeout: 30000,
            ...(requestMethod === 'get'
                ? {
                      searchParams: new URLSearchParams(
                          Object.entries(payload).reduce<Record<string, string>>((params, [key, value]) => {
                              if (value != null) params[key] = String(value);
                              return params;
                          }, {}),
                      ),
                  }
                : {
                      json: !useEncryption ? payload : undefined,
                      body: useEncryption ? requestBody : undefined,
                  }),
            throwHttpErrors: false,
        });

        let result: IResult<T>;
        const isJson = response.headers.get('Content-Type')?.toLowerCase().includes('json') ?? false;
        const jsonPayload = isJson ? await response.json<unknown>().catch(() => null) : null;
        const normalizedPayload = normalizeResponsePayload<T>(jsonPayload);
        if (normalizedPayload) {
            result = normalizedPayload;
        } else switch (response.status) {
            case 500:
                result = {
                    c: 1,
                    m: 'Server error.',
                    d: null as T,
                };
                break;
            case 401:
                result = {
                    c: 1,
                    m: 'Authentication Failure.',
                    d: null as T,
                };
                break;
            case 403:
                result = {
                    c: 1,
                    m: 'Forbidden.',
                    d: null as T,
                };
                break;
            case 404:
                result = {
                    c: 1,
                    m: 'Page not found.',
                    d: null as T,
                };
                break;
            case 422:
                result = {
                    c: 1,
                    m: 'Invalid data.',
                    d: null as T,
                };
                break;
            default:
                if (isJson) {
                    result = {
                        c: response.ok ? 0 : 1,
                        m: response.ok ? '' : `HTTP ${response.status}`,
                        d: jsonPayload as T,
                    };
                } else {
                    result = {
                        c: 0,
                        m: '',
                        d: await response.blob() as T,
                    };
                }
                break;
        }
        if (!response.ok) {
            const fallbackMessage = response.status === 404 ? 'Page not found.' : `HTTP ${response.status} ${response.statusText}`.trim();
            result = { c: result.c || 1, m: responseFailureMessage(jsonPayload) || result.m || fallbackMessage, d: null as T };
        }
        if (result.c !== 0 && options?.toastOnError !== false) {
            toast.error(result.m);
        }

        return {
            ...result,
            httpStatus: response.status,
            path: requestPath,
        };
    } catch (e) {
        console.error(e);
        const error = (e as Error);
        if (options?.toastOnError !== false) {
            toast.error(error.message || error.name);
        }

        return {
            c: 1,
            m: error.message,
            d: null as T,
            httpStatus: 0,
            path: requestPath,
        };
    } finally {
        if (options?.loading !== false) {
            useLoadingStore.setState({ status: false });
        }
    }
}

export async function report(content: string) {
    api('report', {
        method: 'post',
        loading: false,
        data: {
            content,
        },
    });
}

export async function upload(file: File): Promise<string> {
    const form = new FormData();
    const result = await api('oss/form');
    let fileName: string;
    if (isWebCryptoAvailable()) {
        const buffer = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
        const hash = Array.from(new Uint8Array(buffer))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
        const suffix = file.name.split('.').pop();
        fileName = `${hash}.${suffix}`;
    } else {
        fileName = file.name.replace(/[^\w.-]+/g, '_');
    }
    form.append('key', fileName);
    form.append('file', file);

    const formData = result.d['form'] as TData;

    for (const key in formData) {
        form.append(key, formData[key] as string);
    }

    await fetch(result.d['url'] as string, {
        method: 'POST',
        body: form,
    });

    return fileName;
}
