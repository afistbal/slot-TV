import ky from 'ky';
import { toast } from 'sonner';
import { useLoadingStore } from './stores/loading';
import { UAParser } from 'ua-parser-js';
import { apiBaseURL } from './api/baseURL';
import { encryptRequestPayload, isWebCryptoAvailable } from './lib/requestEncryption';

/** POST 加密：`VITE_API_REQUEST_ENCRYPTION=true|false` 可覆盖；默认可用 Web Crypto 时加密（localhost/https），局域网 IP http 自动明文 */
function resolveApiRequestEncryptionEnabled(): boolean {
    const flag = import.meta.env.VITE_API_REQUEST_ENCRYPTION;
    if (flag === 'false') {
        return false;
    }
    if (flag === 'true') {
        return false;
        return isWebCryptoAvailable();
    }
    return false;
    return isWebCryptoAvailable();
}

let loggedInsecureCryptoFallback = false;

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

interface IResult<T> {
    c: number,
    m: string,
    d: T,
}

export interface IPagination {
    current_page: number,
    per_page: number,
    /** 總條數（分頁總頁數 = ceil(count / per_page)） */
    count?: number,
    data: { [key: string]: unknown }[],
}

export type TData = { [key: string]: unknown };

const ua = UAParser(window.navigator.userAgent);


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
            'Accept-Language': localStorage.getItem('locale') ?? 'en',
            Accept: 'application/json',
            'X-Platform': import.meta.env.MODE === 'tiktok' || import.meta.env.VITE_PLATFORM === 'tiktok'
                ? 'tiktok'
                : 'web',
            'X-OS': ua.os.name?.toLowerCase() ?? 'unknown',
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

        let result;
        switch (response.status) {
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
                if (response.headers.get('Content-Type') === 'application/json') {
                    result = await response.json<IResult<T>>();
                } else {
                    result = {
                        c: 0,
                        m: '',
                        d: await response.blob() as T,
                    };
                }
                break;
        }
        if (result.c !== 0 && options?.toastOnError !== false) {
            toast.error(result.m);
        }

        return result;
    } catch (e) {
        console.error(e);
        const error = (e as Error);
        if (options?.toastOnError !== false) {
            toast.error(error.name);
        }

        return {
            c: 1,
            m: error.message,
            d: null as T,
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
