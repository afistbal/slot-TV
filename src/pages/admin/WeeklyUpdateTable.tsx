import { api, type IPagination, type TData } from '@/api';
import Loader from '@/components/Loader';
import { useConfigStore } from '@/stores/config';
import { Copy, Download } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

const COS_FALLBACK_BASE = 'https://cos.yogoshort.com';
const CLIENT_PAGE_SIZE = 200;

function pad(num: number) {
    return String(num).padStart(2, '0');
}

function formatDateInput(input: Date) {
    return `${input.getFullYear()}-${pad(input.getMonth() + 1)}-${pad(input.getDate())}`;
}

function defaultDateRange(): [string, string] {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    return [formatDateInput(start), formatDateInput(end)];
}

function parseDateInput(value: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (Number.isNaN(d.getTime())) return null;
    return d;
}

function rangeToApiStrings(range: [string, string]): [string, string] {
    let a = parseDateInput(range[0]);
    let b = parseDateInput(range[1]);
    if (!a || !b) {
        const fallback = defaultDateRange();
        a = parseDateInput(fallback[0])!;
        b = parseDateInput(fallback[1])!;
    }
    if (a.getTime() > b.getTime()) {
        const t = a;
        a = b;
        b = t;
    }
    const start = new Date(a);
    start.setHours(0, 0, 0, 0);
    const end = new Date(b);
    end.setHours(23, 59, 59, 999);
    return [
        `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())} ${pad(start.getHours())}:${pad(start.getMinutes())}:${pad(start.getSeconds())}`,
        `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())} ${pad(end.getHours())}:${pad(end.getMinutes())}:${pad(end.getSeconds())}`,
    ];
}

function formatDisplayTime(raw: string) {
    const value = String(raw ?? '').trim();
    if (!value) return '—';
    const normalized = value
        .replace('T', ' ')
        .replace(/(\.\d+)?Z$/i, '')
        .trim();
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
    return normalized;
}

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

function toFallbackAddress(row: TData) {
    const direct = pickText(row, ['address', 'url', 'href', 'link', 'episode_url', 'episode_href'], '');
    if (direct) return direct;
    const id = row['id'];
    if (id !== undefined && id !== null && String(id).trim() !== '') {
        return `/video/${id}`;
    }
    const slug = pickText(row, ['episode_slug', 'slug'], '');
    if (slug) return `/episodes/${slug}`;
    return '—';
}

type EpisodeRow = {
    key: string;
    title: string;
    coverUrl: string;
    dramaId: string;
    coverImageFile: string;
    time: string;
    episode: string;
    videoAddress: string;
    audioAddress: string;
    groupIndex: number;
};

function computeTitleRowSpans(rows: EpisodeRow[]): number[] {
    const result = rows.map(() => 0);
    const countByGroup = new Map<number, number>();
    const firstIndexByGroup = new Map<number, number>();
    rows.forEach((r, i) => {
        countByGroup.set(r.groupIndex, (countByGroup.get(r.groupIndex) ?? 0) + 1);
        if (!firstIndexByGroup.has(r.groupIndex)) {
            firstIndexByGroup.set(r.groupIndex, i);
        }
    });
    rows.forEach((r, i) => {
        const first = firstIndexByGroup.get(r.groupIndex);
        if (first === i) {
            result[i] = countByGroup.get(r.groupIndex) ?? 1;
        } else {
            result[i] = 0;
        }
    });
    return result;
}

async function copyText(text: string) {
    try {
        await navigator.clipboard.writeText(text);
        toast.success('已复制');
    } catch {
        toast.error('复制失败');
    }
}

function CopyButton({ text }: { text: string }) {
    if (!text || text === '—') return null;
    return (
        <button
            type="button"
            className="inline-flex shrink-0 items-center justify-center rounded p-1 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
            aria-label="复制"
            title="复制"
            onClick={() => void copyText(text)}
        >
            <Copy size={12} />
        </button>
    );
}

function CoverCell({
    record,
    onPreview,
}: {
    record: EpisodeRow;
    onPreview: (url: string) => void;
}) {
    const url = record.coverUrl?.trim();
    const idLine = record.dramaId ? `id: ${record.dramaId}` : 'id: —';
    const canDownload = Boolean(url && record.dramaId && record.coverImageFile);
    const downloadFilename =
        record.dramaId && record.coverImageFile ? `${record.dramaId}_${record.coverImageFile}` : '';
    const downloadTip = !url
        ? '无封面可下载'
        : canDownload
          ? `下载 ${downloadFilename}`
          : !record.dramaId
            ? '缺少剧目 id，无法按规范命名下载'
            : '缺少封面文件名';

    return (
        <div className="flex flex-col items-center justify-center gap-1 py-0.5">
            <div className="flex w-full min-w-0 items-center justify-between gap-1">
                <span className="min-w-0 flex-1 break-all text-left text-[11px] leading-tight text-slate-500">{idLine}</span>
                <button
                    type="button"
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-35"
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
                    <Download size={13} />
                </button>
            </div>
            {url ? (
                <img
                    src={url}
                    alt=""
                    className="h-[148px] w-[112px] shrink-0 cursor-zoom-in rounded border border-slate-200 object-cover"
                    onClick={() => onPreview(url)}
                    title="查看大图"
                />
            ) : (
                <span className="text-[11px] text-slate-300">—</span>
            )}
        </div>
    );
}

function AddressLine({ addr }: { addr: string }) {
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
        <div className="flex min-w-0 flex-1 items-center gap-1">
            <div className="min-w-0 flex-1 truncate" title={a && a !== '—' ? a : undefined}>
                {body}
            </div>
            <CopyButton text={a} />
        </div>
    );
}

function AddressCell({ videoAddr, audioAddr }: { videoAddr: string; audioAddr: string }) {
    const hasAudio = Boolean(String(audioAddr ?? '').trim());
    return (
        <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex min-w-0 items-center gap-1">
                <span className="shrink-0 text-[11px] text-slate-500">视频：</span>
                <AddressLine addr={videoAddr} />
            </div>
            {hasAudio ? (
                <div className="flex min-w-0 items-center gap-1">
                    <span className="shrink-0 text-[11px] text-slate-500">字幕：</span>
                    <AddressLine addr={audioAddr} />
                </div>
            ) : null}
        </div>
    );
}

export default function Component() {
    const configStore = useConfigStore();
    const staticBase = String(configStore.config['static'] ?? '').trim();

    const [dateRange, setDateRange] = useState<[string, string]>(() => defaultDateRange());
    const [titleKeyword, setTitleKeyword] = useState('');
    const [appliedTitle, setAppliedTitle] = useState('');
    const [apiList, setApiList] = useState<TData[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [hasFetched, setHasFetched] = useState(false);
    const [clientPage, setClientPage] = useState(1);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const fetchByDateRange = useCallback(async (): Promise<boolean> => {
        setLoading(true);
        try {
            const [s, e] = rangeToApiStrings(dateRange);
            const res = await api<IPagination>('movie/listnew', {
                loading: false,
                data: {
                    daterange: JSON.stringify([s, e]),
                },
            });
            if (res.c !== 0) {
                toast.error(res.m || '加载失败');
                setApiList([]);
                setTotal(0);
                setHasFetched(false);
                return false;
            }
            setApiList(res.d.data);
            setTotal(res.d.count ?? 0);
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
    }, [dateRange]);

    const handleSearch = useCallback(async () => {
        const ok = await fetchByDateRange();
        if (ok) {
            setAppliedTitle(titleKeyword.trim());
            setClientPage(1);
            window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        }
    }, [fetchByDateRange, titleKeyword]);

    useEffect(() => {
        void handleSearch();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅挂载一次
    }, []);

    const handleFilterTitle = useCallback(() => {
        if (!hasFetched) {
            toast.warning('请先点击「更新列表」拉取时间范围内的数据');
            return;
        }
        setAppliedTitle(titleKeyword.trim());
        setClientPage(1);
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, [hasFetched, titleKeyword]);

    const filteredApiList = useMemo(() => {
        const kw = appliedTitle.trim().toLowerCase();
        if (!kw) return apiList;
        return apiList.filter((row) => rowTitle(row).toLowerCase().includes(kw));
    }, [apiList, appliedTitle]);

    const rows = useMemo<EpisodeRow[]>(() => {
        return filteredApiList.flatMap((row, groupIndex) => {
            const title = rowTitle(row);
            const outerTime = pickText(
                row,
                ['updated_at', 'update_time', 'time', 'created_at', 'publish_time', 'publish_at'],
                '',
            );
            const raw = row['list'];
            const rowId = row['id'] != null ? String(row['id']) : String(groupIndex);
            const coverPath = pickText(row, ['image', 'poster', 'cover', 'thumb', 'cover_image'], '');
            const coverUrl = coverPath ? joinUrl(staticBase, coverPath) : '';
            const dramaId = row['id'] != null ? String(row['id']) : '';
            const coverImageFile = coverPath ? imageBasename(coverPath) : '';

            if (!Array.isArray(raw) || raw.length === 0) {
                return [
                    {
                        key: `g${rowId}-0`,
                        title,
                        coverUrl,
                        dramaId,
                        coverImageFile,
                        time: formatDisplayTime(outerTime || '—'),
                        episode: pickText(row, ['episode', 'episodes', 'currentEp', 'current_ep', 'videos']),
                        videoAddress: toFallbackAddress(row),
                        audioAddress: '',
                        groupIndex,
                    },
                ];
            }
            return raw.map((item, index) => {
                const record = item as Record<string, unknown>;
                const episodeValue = record['episode'];
                const video = String(record['video'] ?? '').trim();
                const audio = String(record['url'] ?? '').trim();
                const videoAddress = video ? joinUrl(staticBase, video) : toFallbackAddress(row);
                const audioAddress = audio ? joinUrl(staticBase, audio) : '';
                const normalizedEpisode = Number(episodeValue);
                const innerTime = pickText(
                    record as TData,
                    ['updated_at', 'update_time', 'time', 'created_at', 'publish_time', 'publish_at'],
                    '',
                );
                return {
                    key: `g${rowId}-${index}`,
                    title,
                    coverUrl,
                    dramaId,
                    coverImageFile,
                    time: formatDisplayTime(outerTime || innerTime || '—'),
                    episode:
                        Number.isFinite(normalizedEpisode) && normalizedEpisode > 0
                            ? String(normalizedEpisode)
                            : String(index + 1),
                    videoAddress,
                    audioAddress,
                    groupIndex,
                };
            });
        });
    }, [filteredApiList, staticBase]);

    const clientTotalPage = Math.max(1, Math.ceil(rows.length / CLIENT_PAGE_SIZE));
    const pagedRows = useMemo(() => {
        const start = (clientPage - 1) * CLIENT_PAGE_SIZE;
        return rows.slice(start, start + CLIENT_PAGE_SIZE);
    }, [clientPage, rows]);

    const titleRowSpans = useMemo(() => computeTitleRowSpans(pagedRows), [pagedRows]);

    useEffect(() => {
        setClientPage(1);
    }, [rows.length]);

    function goPage(next: number) {
        const target = Math.min(Math.max(1, next), clientTotalPage);
        setClientPage(target);
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }

    const emptyText = loading ? '加载中…' : hasFetched ? '暂无数据' : '请点击「更新列表」拉取数据';

    return (
        <div className="week-data-page flex h-full min-h-0 flex-col gap-1 bg-[#f5f7fa] p-[16px] text-xs text-slate-900">
            <style>{`
                .week-data-page .week-data-scroll {
                    overflow: auto !important;
                    scrollbar-width: auto !important;
                    scrollbar-color: #94a3b8 #e2e8f0 !important;
                }
                .week-data-page .week-data-scroll::-webkit-scrollbar {
                    width: 16px !important;
                    height: 16px !important;
                    display: block !important;
                }
                .week-data-page .week-data-scroll::-webkit-scrollbar-track {
                    background: #e2e8f0 !important;
                }
                .week-data-page .week-data-scroll::-webkit-scrollbar-thumb {
                    background: #94a3b8 !important;
                    border-radius: 9999px !important;
                    border: 4px solid #e2e8f0 !important;
                }
                .week-data-page .week-data-scroll::-webkit-scrollbar-thumb:hover {
                    background: #64748b !important;
                }
            `}</style>

            <h1 className="m-0 text-sm font-semibold text-[#303133]">最新更新</h1>

            <div className="relative border-b border-slate-300 pb-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                    <div className="flex flex-wrap items-center gap-1">
                        <span className="shrink-0 text-xs text-slate-600">时间范围：</span>
                        <input
                            type="date"
                            className="h-6 rounded border border-slate-300 bg-white px-1 text-xs"
                            value={dateRange[0]}
                            onChange={(e) => setDateRange([e.target.value, dateRange[1]])}
                        />
                        <span className="text-xs text-slate-400">至</span>
                        <input
                            type="date"
                            className="h-6 rounded border border-slate-300 bg-white px-1 text-xs"
                            value={dateRange[1]}
                            onChange={(e) => setDateRange([dateRange[0], e.target.value])}
                        />
                        <button
                            type="button"
                            className="h-6 rounded border border-[#409eff] bg-[#409eff] px-2 text-xs font-medium text-white disabled:opacity-50"
                            disabled={loading}
                            onClick={() => void handleSearch()}
                        >
                            {loading ? '加载中…' : '更新列表'}
                        </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                        <span className="shrink-0 text-xs text-slate-600">名称：</span>
                        <input
                            type="text"
                            className="h-6 w-[160px] max-w-full rounded border border-slate-300 bg-white px-1.5 text-xs disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                            placeholder={hasFetched ? '模糊匹配 title' : '拉取完成后可输入'}
                            disabled={!hasFetched}
                            value={titleKeyword}
                            maxLength={128}
                            onChange={(e) => setTitleKeyword(e.target.value)}
                        />
                        <button
                            type="button"
                            className="h-6 rounded border border-slate-300 bg-white px-2 text-xs disabled:opacity-50"
                            disabled={!hasFetched || loading}
                            onClick={handleFilterTitle}
                        >
                            查询
                        </button>
                    </div>
                </div>
            </div>

            <p className="m-0 text-[11px] leading-4 text-slate-500">
                进入页面已按默认时间自动请求；修改时间后请点「更新列表」。名称在数据返回后可填，点「更新列表」会重新请求并带上名称筛选，点「查询」只筛当前结果。
            </p>

            <div className="week-data-scroll min-h-0 flex-1 rounded border border-slate-200 bg-white">
                {loading && !hasFetched ? (
                    <div className="flex h-full min-h-[120px] items-center justify-center">
                        <Loader />
                    </div>
                ) : (
                    <table className="w-full min-w-[760px] table-fixed text-xs leading-5">
                        <thead className="sticky top-0 z-20 bg-[#ecf5ff] text-[#303133]">
                            <tr>
                                <th className="w-[18%] border-b border-slate-300 px-2 py-1 text-left text-xs font-semibold">名称</th>
                                <th className="w-[12%] border-b border-slate-300 px-2 py-1 text-left text-xs font-semibold">封面</th>
                                <th className="w-[14%] border-b border-slate-300 px-2 py-1 text-left text-xs font-semibold">时间</th>
                                <th className="w-[5%] border-b border-slate-300 px-2 py-1 text-left text-xs font-semibold">集数</th>
                                <th className="border-b border-slate-300 px-2 py-1 text-left text-xs font-semibold">地址</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pagedRows.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-2 py-6 text-center text-xs text-slate-400">
                                        {emptyText}
                                    </td>
                                </tr>
                            ) : (
                                pagedRows.map((row, idx) => {
                                    const span = titleRowSpans[idx] ?? 1;
                                    const groupClass = row.groupIndex % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]';
                                    return (
                                        <tr key={row.key} className={groupClass}>
                                            {span > 0 ? (
                                                <td
                                                    rowSpan={span}
                                                    className="border-b border-slate-200 px-2 py-1 align-middle"
                                                >
                                                    <div className="flex min-w-0 items-start gap-0.5">
                                                        <span className="min-w-0 flex-1 break-words text-xs font-medium leading-5 text-slate-900">
                                                            {row.title}
                                                        </span>
                                                        <CopyButton text={row.title} />
                                                    </div>
                                                </td>
                                            ) : null}
                                            {span > 0 ? (
                                                <td rowSpan={span} className="border-b border-slate-200 px-2 py-1 align-middle">
                                                    <CoverCell record={row} onPreview={setPreviewUrl} />
                                                </td>
                                            ) : null}
                                            <td className="whitespace-nowrap border-b border-slate-200 px-2 py-1 align-top text-slate-700">
                                                {row.time}
                                            </td>
                                            <td className="whitespace-nowrap border-b border-slate-200 px-2 py-1 align-top text-slate-700">
                                                {row.episode}
                                            </td>
                                            <td className="border-b border-slate-200 px-2 py-1 align-top">
                                                <AddressCell videoAddr={row.videoAddress} audioAddr={row.audioAddress} />
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded border border-[#d9ecff] bg-[#ecf5ff] px-2 py-1.5">
                <div className="text-xs font-medium text-[#303133]">
                    接口影剧数: {total} | 当前匹配剧: {filteredApiList.length} | 展示行数: {rows.length}
                </div>
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        className="rounded border border-[#b3d8ff] bg-white px-2 py-0.5 text-xs font-medium text-[#409eff] disabled:opacity-40"
                        disabled={clientPage <= 1}
                        onClick={() => goPage(clientPage - 1)}
                    >
                        上一页
                    </button>
                    <div className="text-xs font-medium text-[#303133]">
                        第 {clientPage} / {clientTotalPage} 页（每页 {CLIENT_PAGE_SIZE} 条）
                    </div>
                    <button
                        type="button"
                        className="rounded border border-[#b3d8ff] bg-white px-2 py-0.5 text-xs font-medium text-[#409eff] disabled:opacity-40"
                        disabled={clientPage >= clientTotalPage}
                        onClick={() => goPage(clientPage + 1)}
                    >
                        下一页
                    </button>
                </div>
            </div>

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
