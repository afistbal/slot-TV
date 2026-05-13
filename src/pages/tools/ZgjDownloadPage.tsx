import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type IPagination, type TData } from '@/api';
import { useConfigStore } from '@/stores/config';
import { useUserStore } from '@/stores/user';

/**
 * 限制「扫描影片」最多请求的页数。`null` = 拉全部分页（上线全量时用）。
 * 本地先跑 2 页即可；要全量时改为 `null`。
 */
const ZGJ_MOVIE_PAGE_CAP: number | null = 2;

type MovieRow = { id: number; title: string; image: string };

function joinStaticUrl(staticBase: string, image: string) {
    const base = staticBase.replace(/\/+$/, '');
    const path = image.replace(/^\/+/, '');
    return `${base}/${path}`;
}

/** 直连工具页时补齐 config / 匿名会话，避免等全站 `checked` */
async function ensureApiBootstrap() {
    const configStore = useConfigStore.getState();
    if (!configStore.config['static']) {
        const cfg = await api<TData>('config', { loading: false });
        if (cfg.c !== 0) {
            throw new Error(cfg.m || 'config 失败');
        }
        configStore.setConfig(cfg.d);
    }
    if (!localStorage.getItem('token')) {
        const anon = await api<TData>('login/anonymous', { loading: false });
        if (anon.c !== 0) {
            throw new Error(anon.m || '匿名登录失败');
        }
        localStorage.setItem('token', anon.d['token'] as string);
        useUserStore.getState().signin(anon.d['info'] as TData);
    }
}

function parseRows(d: IPagination): MovieRow[] {
    const raw = (d.data ?? []) as TData[];
    const out: MovieRow[] = [];
    for (const row of raw) {
        const id = Number(row['id']);
        const image = row['image'];
        const title = row['title'];
        if (!Number.isFinite(id) || typeof image !== 'string' || !image) {
            continue;
        }
        out.push({
            id,
            title: typeof title === 'string' ? title : '',
            image,
        });
    }
    return out;
}

/** 自用：分页拉全 `movie` 封面，写入本地目录 `id/image`（Chrome/Edge 选择文件夹权限）。 */
export default function ZgjDownloadPage() {
    const staticBase = useConfigStore((s) => (s.config['static'] as string | undefined) ?? '');
    const [bootError, setBootError] = useState<string | null>(null);
    const [ready, setReady] = useState(false);

    const [phase, setPhase] = useState<'idle' | 'listing' | 'downloading' | 'done'>('idle');
    const [listProgress, setListProgress] = useState({ page: 0, totalPages: 0 });
    const [rows, setRows] = useState<MovieRow[]>([]);
    const [dlProgress, setDlProgress] = useState({ done: 0, total: 0 });
    const [logLines, setLogLines] = useState<string[]>([]);
    const abortRef = useRef(false);

    const appendLog = useCallback((line: string) => {
        setLogLines((prev) => [...prev.slice(-200), line]);
    }, []);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                await ensureApiBootstrap();
                if (!cancelled) {
                    setReady(true);
                }
            } catch (e) {
                if (!cancelled) {
                    setBootError(e instanceof Error ? e.message : String(e));
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const handleListAll = useCallback(async () => {
        abortRef.current = false;
        setBootError(null);
        setPhase('listing');
        setRows([]);
        setLogLines([]);
        const merged = new Map<number, MovieRow>();

        try {
            const first = await api<IPagination>('movie', {
                loading: false,
                data: { page: 1 },
            });
            if (first.c !== 0) {
                throw new Error(first.m || 'movie 第 1 页失败');
            }
            const d0 = first.d;
            const perPage = d0.per_page > 0 ? d0.per_page : 24;
            const total = typeof d0.count === 'number' ? d0.count : 0;
            const totalPagesFull =
                total > 0 ? Math.max(1, Math.ceil(total / perPage)) : 1;
            const totalPages =
                ZGJ_MOVIE_PAGE_CAP == null
                    ? totalPagesFull
                    : Math.min(totalPagesFull, ZGJ_MOVIE_PAGE_CAP);

            for (const r of parseRows(d0)) {
                merged.set(r.id, r);
            }
            setListProgress({ page: 1, totalPages });

            for (let page = 2; page <= totalPages; page++) {
                if (abortRef.current) {
                    appendLog('已取消扫描');
                    setPhase('idle');
                    return;
                }
                const res = await api<IPagination>('movie', {
                    loading: false,
                    data: { page },
                });
                if (res.c !== 0) {
                    throw new Error(res.m || `movie 第 ${page} 页失败`);
                }
                for (const r of parseRows(res.d)) {
                    merged.set(r.id, r);
                }
                setListProgress({ page, totalPages });
            }

            const list = [...merged.values()].sort((a, b) => b.id - a.id);
            setRows(list);
            setPhase('idle');
            if (ZGJ_MOVIE_PAGE_CAP != null && totalPagesFull > totalPages) {
                appendLog(
                    `扫描完成（仅前 ${totalPages}/${totalPagesFull} 页）：${list.length} 条；count=${total}。全量请将源码中 ZGJ_MOVIE_PAGE_CAP 改为 null`,
                );
            } else {
                appendLog(`扫描完成：共 ${list.length} 条（服务端 count=${total}）`);
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setBootError(msg);
            appendLog(`错误: ${msg}`);
            setPhase('idle');
        }
    }, [appendLog]);

    const handleDownloadToFolder = useCallback(async () => {
        const base = staticBase || (useConfigStore.getState().config['static'] as string | undefined);
        if (!base) {
            appendLog('缺少 config.static，请稍后重试或刷新');
            return;
        }
        if (rows.length === 0) {
            appendLog('请先扫描列表');
            return;
        }
        const picker = window.showDirectoryPicker;
        if (typeof picker !== 'function') {
            appendLog('当前浏览器不支持选择文件夹（请用 Chrome / Edge 桌面版，且需 HTTPS 或 localhost）');
            return;
        }

        abortRef.current = false;
        setPhase('downloading');
        setDlProgress({ done: 0, total: rows.length });

        let root: FileSystemDirectoryHandle;
        try {
            root = await picker({ mode: 'readwrite' });
        } catch (e) {
            if ((e as Error).name === 'AbortError') {
                appendLog('已取消选择目录');
            } else {
                appendLog(`选择目录失败: ${e instanceof Error ? e.message : String(e)}`);
            }
            setPhase('idle');
            return;
        }

        const concurrency = 5;
        const queue = [...rows];
        const workers = Array.from({ length: concurrency }, async () => {
            while (queue.length > 0 && !abortRef.current) {
                const row = queue.shift();
                if (!row) {
                    break;
                }
                const url = joinStaticUrl(base, row.image);
                try {
                    const dir = await root.getDirectoryHandle(String(row.id), { create: true });
                    const fileHandle = await dir.getFileHandle(row.image, { create: true });
                    const writable = await fileHandle.createWritable();
                    const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
                    if (!res.ok) {
                        throw new Error(`HTTP ${res.status}`);
                    }
                    const buf = await res.arrayBuffer();
                    await writable.write(buf);
                    await writable.close();
                } catch (err) {
                    appendLog(`失败 id=${row.id} ${row.image}: ${err instanceof Error ? err.message : String(err)}`);
                }
                setDlProgress((prev) => ({
                    done: Math.min(prev.total, prev.done + 1),
                    total: prev.total,
                }));
            }
        });

        await Promise.all(workers);
        setPhase('done');
        appendLog(`写入队列已跑完（${rows.length} 条）；失败项见上方日志。`);
    }, [appendLog, rows, staticBase]);

    return (
        <div className="min-h-screen bg-white text-slate-900 antialiased">
            <div className="mx-auto max-w-3xl px-6 py-10">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                    影片封面批量保存
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                    仅分页请求{' '}
                    <code className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-slate-800">
                        movie?page=
                    </code>
                    ，不写 keyword / tag。保存路径：{' '}
                    <code className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-slate-800">
                        所选目录/id/文件名.webp
                    </code>
                    （例如目录选到 <code className="text-slate-800">D:\tvmoviespng</code>）。
                </p>

                {!ready && !bootError ? (
                    <p className="mt-6 text-slate-500">正在初始化接口与配置…</p>
                ) : null}

                {bootError && phase === 'idle' && rows.length === 0 ? (
                    <p className="mt-6 text-red-600">{bootError}</p>
                ) : null}

                <div className="mt-8 flex flex-wrap gap-3">
                    <button
                        type="button"
                        disabled={!ready || phase === 'listing' || phase === 'downloading'}
                        onClick={() => void handleListAll()}
                        className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {phase === 'listing'
                            ? `扫描中 ${listProgress.page}/${listProgress.totalPages || '…'} 页`
                            : '1. 扫描全部影片'}
                    </button>
                    <button
                        type="button"
                        disabled={!ready || rows.length === 0 || phase === 'listing' || phase === 'downloading'}
                        onClick={() => void handleDownloadToFolder()}
                        className="rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {phase === 'downloading'
                            ? `写入中 ${dlProgress.done}/${dlProgress.total}`
                            : '2. 选择文件夹并下载封面'}
                    </button>
                    <button
                        type="button"
                        disabled={phase === 'idle'}
                        onClick={() => {
                            abortRef.current = true;
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-30"
                    >
                        取消
                    </button>
                </div>

                {rows.length > 0 && phase !== 'listing' ? (
                    <p className="mt-4 text-sm text-slate-600">
                        已缓存 {rows.length} 条；static 前缀：
                        <span className="ml-1 break-all text-slate-900">
                            {staticBase || '(等待 config)'}
                        </span>
                    </p>
                ) : null}

                <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-sm">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">日志</div>
                    <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-slate-800">
                        {logLines.length === 0 ? '—' : logLines.join('\n')}
                    </pre>
                </div>
            </div>
        </div>
    );
}
