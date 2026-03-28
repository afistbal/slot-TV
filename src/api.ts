import ky from 'ky';
import { toast } from 'sonner';
import { useLoadingStore } from './stores/loading';
import { useUserStore } from './stores/user';
import { UAParser } from 'ua-parser-js';


interface IResult<T> {
    c: number,
    m: string,
    d: T,
}

export interface IPagination {
    current_page: number,
    per_page: number,
    count?: number,
    data: { [key: string]: unknown }[],
}

export type TData = { [key: string]: unknown };

const ua = UAParser(window.navigator.userAgent);


export async function api<T = TData>(path: string, options?: { loading?: boolean, method?: 'get' | 'post', data?: { [key: string]: unknown }, headers?: Record<string, string | undefined> }): Promise<IResult<T>> {
    const query = new URLSearchParams();

    if ((options?.method === undefined || options?.method === 'get') && options?.data !== undefined) {
        Object.entries(options.data).forEach(item => {
            query.set(item[0], item[1] as string);
        });
    }

    const queryString = query.toString();

    path = queryString ? path + '?' + queryString : path;

    if (options?.loading !== false) {
        useLoadingStore.setState({ status: true });
    }

    try {
        const response = await ky(path, {
            prefixUrl: '/api',
            method: options?.method,
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Accept-Language': localStorage.getItem('locale') ?? 'en',
                'Accept': 'application/json',
                'X-Platform': 'web',
                'X-OS': ua.os.name?.toLowerCase() ?? 'unknown',
                'X-Test': localStorage.getItem('test') ?? '',
                'X-Source': localStorage.getItem('source') ?? '',
                ...options?.headers,
            },
            timeout: 30000,
            json: options?.method === 'post' ? options?.data : undefined,
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
                localStorage.removeItem('token');
                useUserStore.setState({ signed: false });
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
        if (result.c !== 0) {
            toast.error(result.m);
        }

        return result;
    } catch (e) {
        console.error(e);
        const error = (e as Error);
        toast.error(error.name);

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
    const buffer = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    const hash = Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    const suffix = file.name.split('.').pop();
    const fileName = `${hash}.${suffix}`;
    form.append('key', fileName);
    form.append('file', file);

    const formData = result.d['form'] as TData;

    for (let key in formData) {
        form.append(key, formData[key] as string);
    }

    await fetch(result.d['url'] as string, {
        method: 'POST',
        body: form,
    });

    return fileName;
}