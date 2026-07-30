import { api, type TData } from '@/api';
import Loader from '@/components/Loader';
import { useConfigStore } from '@/stores/config';
import { Copy, Download, Eye, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { movieCoverImagePath, movieCoverUrl } from '@/lib/movieCoverUrl';

const COS_FALLBACK_BASE = 'https://cos.yogoshort.com';
const CLIENT_PAGE_SIZE = 200;
const CREATED_TIME_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
});

function pickText(row: TData, keys: string[], fallback = '—') {
    for (const key of keys) {
        const value = row[key];
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            return String(value);
        }
    }
    return fallback;
}

function rowTitle(row: TData): string {
    return pickText(row, ['titile', 'title', 'name', 'book_title'], '');
}

function formatCreatedHour(value: unknown): string {
    if (value == null || String(value).trim() === '') return '';
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return String(value);
    const parts = Object.fromEntries(
        CREATED_TIME_FORMATTER.formatToParts(date).map((part) => [part.type, part.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

function joinUrl(base: string, path: string) {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
    }
    if (path.startsWith('//')) {
        return `https:${path}`;
    }
    const root = base || COS_FALLBACK_BASE;
    const normalizedRoot = root.startsWith('//') ? `https:${root}` : root;
    const b = normalizedRoot.endsWith('/') ? normalizedRoot.slice(0, -1) : normalizedRoot;
    const p = path.startsWith('/') ? path.slice(1) : path;
    return `${b}/${p}`;
}

function imageBasename(path: string): string {
    const s = String(path ?? '').replace(/\\/g, '/').trim();
    if (!s) return '';
    const i = s.lastIndexOf('/');
    return i >= 0 ? s.slice(i + 1) : s;
}

function triggerBlobDownload(blob: Blob, filename: string) {
    const safeName = filename.replace(/[/\\?%*:|"<>]/g, '_');
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = safeName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    requestAnimationFrame(() => {
        a.remove();
        URL.revokeObjectURL(objectUrl);
    });
}

async function downloadImageViaCanvas(imageUrl: string, filename: string): Promise<boolean> {
    const safeName = filename.replace(/[/\\?%*:|"<>]/g, '_');
    return new Promise((resolve) => {
        const img = document.createElement('img');
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const w = img.naturalWidth;
                const h = img.naturalHeight;
                if (!w || !h) {
                    resolve(false);
                    return;
                }
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(false);
                    return;
                }
                ctx.drawImage(img, 0, 0);
                const lower = safeName.toLowerCase();
                const mime = lower.endsWith('.png')
                    ? 'image/png'
                    : lower.endsWith('.jpg') || lower.endsWith('.jpeg')
                      ? 'image/jpeg'
                      : 'image/webp';
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            resolve(false);
                            return;
                        }
                        triggerBlobDownload(blob, safeName);
                        resolve(true);
                    },
                    mime,
                    0.92,
                );
            } catch {
                resolve(false);
            }
        };
        img.onerror = () => resolve(false);
        img.src = imageUrl;
    });
}

async function downloadImageAsFile(url: string, filename: string) {
    const safeName = filename.replace(/[/\\?%*:|"<>]/g, '_');
    try {
        const res = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'no-store' });
        if (res.ok) {
            const blob = await res.blob();
            if (blob && blob.size > 0) {
                triggerBlobDownload(blob, safeName);
                toast.success('已开始下载');
                return;
            }
        }
    } catch {
        /* 继续尝试 canvas */
    }
    if (await downloadImageViaCanvas(url, safeName)) {
        toast.success('已开始下载');
        return;
    }
    toast.error('无法直接保存到本地（跨域限制）。请在大图预览里右键「图片另存为」。');
}

type DramaRow = {
    key: string;
    id: string;
    movieId: number;
    title: string;
    createdAt: string;
    coverUrl: string;
    coverImageFile: string;
};

type MovieListPayload = {
    data?: TData[];
    count?: number;
};

type MovieEpisodeRow = {
    id?: number;
    episode?: number;
    video?: string;
    url?: string;
    subtitle?: { id?: number; url?: string } | null;
    [key: string]: unknown;
};

type MovieDetailPayload = MovieEpisodeRow[];

type EpisodeDisplayRow = {
    key: string;
    episode: string;
    videoUrl: string;
    subtitleUrl: string;
};

function movieIdFromRow(row: TData): number | null {
    const n = Number(row['id']);
    return Number.isFinite(n) && n > 0 ? n : null;
}

function episodesFromDetailPayload(d: MovieDetailPayload | undefined): MovieEpisodeRow[] {
    return Array.isArray(d) ? d : [];
}

function subtitleUrlFromEpisode(item: MovieEpisodeRow): string {
    const top = item.url;
    if (top != null && String(top).trim() !== '') {
        return String(top).trim();
    }
    const st = item.subtitle;
    if (st != null && typeof st === 'object') {
        const nested = (st as { url?: unknown }).url;
        if (nested != null && String(nested).trim() !== '') {
            return String(nested).trim();
        }
    }
    return '';
}

async function copyText(text: string) {
    try {
        await navigator.clipboard.writeText(text);
        toast.success('已复制');
    } catch {
        toast.error('复制失败');
    }
}

function CopyButton({ text, className = '' }: { text: string; className?: string }) {
    if (!text || text === '—') return null;
    return (
        <button
            type="button"
            className={`inline-flex shrink-0 translate-y-[1px] items-center justify-center rounded p-0.5 align-middle text-blue-600 hover:bg-blue-50 hover:text-blue-700 ${className}`}
            aria-label="复制"
            title="复制"
            onClick={() => void copyText(text)}
        >
            <Copy size={12} />
        </button>
    );
}

function NameCell({ record }: { record: DramaRow }) {
    const title = record.title || '—';
    return (
        <div className="min-w-0">
            <p className="m-0 text-[13px] font-medium leading-snug text-slate-800 break-words">
                {title}
                <CopyButton text={record.title} className="ml-0.5" />
            </p>
            {record.createdAt ? (
                <time className="mt-1.5 block text-xs tabular-nums text-slate-500">
                    创建时间：{record.createdAt}
                </time>
            ) : null}
        </div>
    );
}

function CoverCell({
    record,
    onPreview,
}: {
    record: DramaRow;
    onPreview: (url: string) => void;
}) {
    const url = record.coverUrl?.trim();
    const canDownload = Boolean(url && record.id && record.coverImageFile);
    const downloadFilename =
        record.id && record.coverImageFile ? `${record.id}_${record.coverImageFile}` : '';
    const downloadTip = !url
        ? '无封面可下载'
        : canDownload
          ? `下载 ${downloadFilename}`
          : '缺少封面文件名';

    return (
        <div className="relative inline-flex shrink-0">
            {url ? (
                <img
                    src={url}
                    alt=""
                    className="h-[96px] w-[72px] rounded border border-slate-200/80 object-cover bg-slate-50"
                />
            ) : (
                <span className="flex h-[96px] w-[72px] items-center justify-center rounded border border-dashed border-slate-200 bg-slate-50 text-[10px] text-slate-300">
                    无封面
                </span>
            )}
            {url ? (
                <button
                    type="button"
                    className="absolute -bottom-1 -left-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:border-[#b3d8ff] hover:text-[#409eff]"
                    aria-label="查看大图"
                    title="查看大图"
                    onClick={(e) => {
                        e.stopPropagation();
                        onPreview(url);
                    }}
                >
                    <Eye size={12} />
                </button>
            ) : null}
            <button
                type="button"
                className="absolute -right-1 -top-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:border-[#b3d8ff] hover:text-[#409eff] disabled:pointer-events-none disabled:opacity-0"
                aria-label="下载封面"
                title={downloadTip}
                disabled={!canDownload}
                onClick={(e) => {
                    e.stopPropagation();
                    if (canDownload && url) {
                        void downloadImageAsFile(url, downloadFilename);
                    }
                }}
            >
                <Download size={12} />
            </button>
        </div>
    );
}

function AddressLine({ label, addr }: { label: string; addr: string }) {
    const a = String(addr ?? '');
    const display = a || '—';
    const isHttp = /^https?:\/\//.test(a);
    const isPath = a.startsWith('/');
    const body =
        isHttp && a && a !== '—' ? (
            <a
                className="block truncate text-blue-600 hover:text-blue-700 hover:underline"
                href={a}
                target="_blank"
                rel="noreferrer"
                title={a}
            >
                {a}
            </a>
        ) : isPath && a && a !== '—' ? (
            <a className="block truncate text-blue-600 hover:text-blue-700 hover:underline" href={a} title={a}>
                {a}
            </a>
        ) : (
            <span className="block truncate text-slate-700">{display}</span>
        );

    return (
        <div className="flex min-w-0 items-center gap-1">
            <span className="shrink-0 text-[11px] text-slate-500">{label}</span>
            <span className="inline-flex min-w-0 max-w-full items-center gap-0.5">
                <span className="min-w-0 truncate" title={a && a !== '—' ? a : undefined}>
                    {body}
                </span>
                <CopyButton text={a} />
            </span>
        </div>
    );
}

function ActionCell({
    record,
    onDetail,
}: {
    record: DramaRow;
    onDetail: (row: DramaRow) => void;
}) {
    const canAct = Boolean(record.id);
    if (!canAct) {
        return <span className="text-slate-300">—</span>;
    }
    return (
        <button
            type="button"
            className="rounded border border-[#b3d8ff] bg-white px-2.5 py-1 text-xs font-medium text-[#409eff] shadow-sm transition-colors hover:border-[#409eff] hover:bg-[#ecf5ff]"
            onClick={() => onDetail(record)}
        >
            详情
        </button>
    );
}

function DetailModal({
    open,
    movieId,
    movieTitle,
    staticBase,
    onClose,
}: {
    open: boolean;
    movieId: number | null;
    movieTitle: string;
    staticBase: string;
    onClose: () => void;
}) {
    const [loading, setLoading] = useState(false);
    const [episodes, setEpisodes] = useState<MovieEpisodeRow[]>([]);

    useEffect(() => {
        if (!open || movieId == null) {
            setEpisodes([]);
            return;
        }
        let cancelled = false;
        setLoading(true);
        void (async () => {
            try {
                const res = await api<MovieDetailPayload>('movie/detail', {
                    loading: false,
                    data: { movieid: movieId },
                });
                if (cancelled) return;
                if (res.c !== 0) {
                    toast.error(res.m || '加载集数失败');
                    setEpisodes([]);
                    return;
                }
                setEpisodes(episodesFromDetailPayload(res.d));
            } catch {
                if (!cancelled) {
                    toast.error('网络异常');
                    setEpisodes([]);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, movieId]);

    const rows = useMemo<EpisodeDisplayRow[]>(() => {
        return episodes.map((item, index) => {
            const episodeValue = item.episode;
            const videoRaw = String(item.video ?? '').trim();
            const videoUrl = videoRaw ? joinUrl(staticBase, videoRaw) : '';
            const subtitleRaw = subtitleUrlFromEpisode(item);
            const subtitleUrl = subtitleRaw ? joinUrl(staticBase, subtitleRaw) : '';
            const normalizedEpisode = Number(episodeValue);
            return {
                key: String(item.id ?? `ep-${index}`),
                episode:
                    Number.isFinite(normalizedEpisode) && normalizedEpisode > 0
                        ? String(normalizedEpisode)
                        : String(index + 1),
                videoUrl,
                subtitleUrl,
            };
        });
    }, [episodes, staticBase]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="presentation"
            onClick={onClose}
            onKeyDown={(e) => {
                if (e.key === 'Escape') onClose();
            }}
        >
            <div
                className="flex max-h-[min(90vh,720px)] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
                role="dialog"
                aria-modal="true"
                aria-labelledby="week-data-detail-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <div className="min-w-0">
                        <h2 id="week-data-detail-title" className="m-0 truncate text-sm font-semibold text-slate-900">
                            {movieTitle ? `${movieTitle} · 集数详情` : '集数详情'}
                        </h2>
                    </div>
                    <button
                        type="button"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                        aria-label="关闭"
                        onClick={onClose}
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-auto">
                    {loading ? (
                        <div className="flex min-h-[200px] items-center justify-center">
                            <Loader />
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="px-4 py-10 text-center text-sm text-slate-400">暂无集数</div>
                    ) : (
                        <table className="w-full min-w-[640px] table-fixed text-xs">
                            <thead className="sticky top-0 z-10 bg-[#ecf5ff] text-[#303133]">
                                <tr>
                                    <th className="w-[72px] border-b border-slate-200 px-3 py-2 text-center text-xs font-semibold">
                                        集数
                                    </th>
                                    <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold">
                                        链接
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, idx) => (
                                    <tr key={row.key} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#fafbfc]'}>
                                        <td className="border-b border-slate-100 px-3 py-2 text-center align-top text-slate-700">
                                            {row.episode}
                                        </td>
                                        <td className="border-b border-slate-100 px-3 py-2 align-top">
                                            <div className="flex flex-col gap-1">
                                                <AddressLine label="视频：" addr={row.videoUrl} />
                                                {row.subtitleUrl.trim() ? (
                                                    <AddressLine label="字幕：" addr={row.subtitleUrl} />
                                                ) : null}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function Component() {
    const configStore = useConfigStore();
    const staticBase = String(configStore.config['static'] ?? '').trim();

    const [titleKeyword, setTitleKeyword] = useState('');
    const [appliedTitle, setAppliedTitle] = useState('');
    const [apiList, setApiList] = useState<TData[]>([]);
    const [total, setTotal] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [hasFetched, setHasFetched] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [detailMovieId, setDetailMovieId] = useState<number | null>(null);
    const [detailMovieTitle, setDetailMovieTitle] = useState('');

    const openDetail = useCallback((row: DramaRow) => {
        setDetailMovieId(row.movieId);
        setDetailMovieTitle(row.title);
    }, []);

    const fetchList = useCallback(async (): Promise<boolean> => {
        setLoading(true);
        try {
            const res = await api<MovieListPayload>('movie/listnew', {
                loading: false,
            });
            if (res.c !== 0) {
                toast.error(res.m || '加载失败');
                setApiList([]);
                setTotal(0);
                setHasFetched(false);
                return false;
            }
            const d = res.d;
            const data = Array.isArray(d?.data) ? d.data : [];
            setApiList(data);
            setTotal(data.length);
            setCurrentPage(1);
            setHasFetched(true);
            return true;
        } catch {
            toast.error('网络异常');
            setApiList([]);
            setTotal(0);
            setHasFetched(false);
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    const handleRefresh = useCallback(async () => {
        const ok = await fetchList();
        if (ok) {
            setAppliedTitle(titleKeyword.trim());
            window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        }
    }, [fetchList, titleKeyword]);

    useEffect(() => {
        void fetchList();
    }, [fetchList]);

    const handleFilterTitle = useCallback(() => {
        if (!hasFetched) {
            toast.warning('请先点击「更新列表」拉取数据');
            return;
        }
        setAppliedTitle(titleKeyword.trim());
        setCurrentPage(1);
    }, [hasFetched, titleKeyword]);

    const handleClearTitle = useCallback(() => {
        setTitleKeyword('');
        setAppliedTitle('');
        setCurrentPage(1);
    }, []);

    const filteredApiList = useMemo(() => {
        const kw = appliedTitle.trim().toLowerCase();
        if (!kw) return apiList;
        return apiList.filter((row) => rowTitle(row).toLowerCase().includes(kw));
    }, [apiList, appliedTitle]);

    const rows = useMemo<DramaRow[]>(() => {
        return filteredApiList.flatMap((row) => {
            const movieId = movieIdFromRow(row);
            if (movieId == null) return [];
            const id = String(movieId);
            const coverPath = movieCoverImagePath(row, { fallbackId: movieId });
            return [
                {
                    key: id,
                    id,
                    movieId,
                    title: rowTitle(row),
                    createdAt: formatCreatedHour(row['created_at']),
                    coverUrl: movieCoverUrl(row, staticBase, { fallbackId: movieId }) ?? '',
                    coverImageFile: coverPath ? imageBasename(coverPath) : '',
                },
            ];
        });
    }, [filteredApiList, staticBase]);

    const totalPage = Math.max(1, Math.ceil(rows.length / CLIENT_PAGE_SIZE));
    const pageRows = useMemo(
        () => rows.slice((currentPage - 1) * CLIENT_PAGE_SIZE, currentPage * CLIENT_PAGE_SIZE),
        [currentPage, rows],
    );
    const emptyText = loading ? '加载中…' : hasFetched ? '暂无数据' : '请点击「更新列表」拉取数据';

    return (
        <div className="week-data-page flex h-full min-h-0 flex-col gap-4 bg-[#f0f2f5] p-5 text-xs text-slate-900 md:p-8">
            <style>{`
                .week-data-page .week-data-scroll {
                    overflow: auto !important;
                    scrollbar-width: thin;
                    scrollbar-color: #cbd5e1 transparent;
                }
                .week-data-page .week-data-scroll::-webkit-scrollbar {
                    width: 8px;
                    height: 8px;
                }
                .week-data-page .week-data-scroll::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 4px;
                }
                .week-data-page .week-data-row:nth-child(odd) {
                    background: #fff;
                }
                .week-data-page .week-data-row:nth-child(even) {
                    background: #fafbfc;
                }
                .week-data-page .week-data-row:hover {
                    background: #f5f9ff !important;
                }
            `}</style>

            <div className="flex flex-wrap items-center justify-between gap-2">
                <h1 className="m-0 text-base font-semibold text-[#303133]">最新更新</h1>
                {hasFetched ? (
                    <span className="text-xs text-slate-500">共 {total} 部 · 匹配 {filteredApiList.length} 部</span>
                ) : null}
            </div>

            <div className="rounded-lg border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        className="h-7 rounded-md border border-[#409eff] bg-[#409eff] px-3 text-xs font-medium text-white shadow-sm disabled:opacity-50"
                        disabled={loading}
                        onClick={() => void handleRefresh()}
                    >
                        {loading ? '加载中…' : '更新列表'}
                    </button>
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="shrink-0 text-xs font-medium text-slate-600">名称：</span>
                        <div className="relative">
                            <input
                                type="text"
                                className="h-6 w-[240px] max-w-full rounded border border-slate-300 bg-white py-0 pl-1.5 pr-7 text-xs disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                placeholder={hasFetched ? '模糊匹配 title' : '拉取完成后可输入'}
                                disabled={!hasFetched}
                                value={titleKeyword}
                                maxLength={128}
                                onChange={(e) => setTitleKeyword(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleFilterTitle();
                                }}
                            />
                            {titleKeyword || appliedTitle ? (
                                <button
                                    type="button"
                                    className="absolute right-1 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
                                    aria-label="清除名称搜索"
                                    title="清除"
                                    disabled={!hasFetched || loading}
                                    onClick={handleClearTitle}
                                >
                                    <X size={13} />
                                </button>
                            ) : null}
                        </div>
                        <button
                            type="button"
                            className="h-7 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm disabled:opacity-50"
                            disabled={!hasFetched || loading}
                            onClick={handleFilterTitle}
                        >
                            查询
                        </button>
                    </div>
                </div>
            </div>

            <div className="week-data-scroll min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200/80 bg-white shadow-sm">
                {loading && !hasFetched ? (
                    <div className="flex min-h-[200px] items-center justify-center p-8">
                        <Loader />
                    </div>
                ) : pageRows.length === 0 ? (
                    <div className="px-6 py-16 text-center text-sm text-slate-400">{emptyText}</div>
                ) : (
                    <ul className="m-0 grid list-none grid-cols-1 gap-px bg-white p-0 lg:grid-cols-2">
                        {pageRows.map((row) => (
                            <li key={row.key} className="week-data-row flex min-w-0 items-center gap-3 px-4 py-2.5">
                                <div className="min-w-0 flex-1">
                                    <NameCell record={row} />
                                </div>
                                <div className="flex w-[72px] shrink-0 justify-center">
                                    <CoverCell record={row} onPreview={setPreviewUrl} />
                                </div>
                                <div className="flex w-[64px] shrink-0 justify-center">
                                    <ActionCell record={row} onDetail={openDetail} />
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-lg border border-[#d9ecff] bg-[#ecf5ff] px-4 py-2.5">
                <div className="text-xs text-[#606266]">
                    匹配 {rows.length} 部{appliedTitle ? '（已筛选）' : ''} · 当前页 {pageRows.length} 部
                </div>
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        className="rounded border border-[#b3d8ff] bg-white px-2 py-0.5 text-xs font-medium text-[#409eff] disabled:opacity-40"
                        disabled={currentPage <= 1 || loading}
                        onClick={() => setCurrentPage((p) => p - 1)}
                    >
                        上一页
                    </button>
                    <div className="text-xs font-medium text-[#303133]">
                        第 {currentPage} / {totalPage} 页
                    </div>
                    <button
                        type="button"
                        className="rounded border border-[#b3d8ff] bg-white px-2 py-0.5 text-xs font-medium text-[#409eff] disabled:opacity-40"
                        disabled={currentPage >= totalPage || loading}
                        onClick={() => setCurrentPage((p) => p + 1)}
                    >
                        下一页
                    </button>
                </div>
            </div>

            <DetailModal
                open={detailMovieId != null}
                movieId={detailMovieId}
                movieTitle={detailMovieTitle}
                staticBase={staticBase}
                onClose={() => {
                    setDetailMovieId(null);
                    setDetailMovieTitle('');
                }}
            />

            {previewUrl ? (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6"
                    role="presentation"
                    onClick={() => setPreviewUrl(null)}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') setPreviewUrl(null);
                    }}
                >
                    <img
                        src={previewUrl}
                        alt=""
                        className="max-h-[90vh] max-w-[min(90vw,480px)] rounded-lg object-contain"
                    />
                </div>
            ) : null}
        </div>
    );
}
