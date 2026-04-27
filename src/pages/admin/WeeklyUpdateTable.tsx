import { api, type IPagination, type TData } from '@/api';
import Loader from '@/components/Loader';
import { useConfigStore } from '@/stores/config';
import { useEffect, useMemo, useState } from 'react';

const COS_FALLBACK_BASE = 'https://cos.yogoshort.com';
const CLIENT_PAGE_SIZE = 200;

function pad(num: number) {
    return String(num).padStart(2, '0');
}

function formatDateTime(input: Date) {
    return `${input.getFullYear()}-${pad(input.getMonth() + 1)}-${pad(input.getDate())} ${pad(input.getHours())}:${pad(input.getMinutes())}:${pad(input.getSeconds())}`;
}

function weekDateRange() {
    const end = new Date();
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    return [formatDateTime(start), formatDateTime(end)] as const;
}

function formatDisplayTime(raw: string) {
    const value = String(raw ?? '').trim();
    if (!value) return '-';
    // 兼容 ISO 时间：2026-04-27T10:54:30.000000Z -> 2026-04-27 10:54:30
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

function pickText(row: TData, keys: string[], fallback = '-') {
    for (const key of keys) {
        const value = row[key];
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            return String(value);
        }
    }
    return fallback;
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

function toFallbackAddress(row: TData) {
    const direct = pickText(row, ['address', 'url', 'href', 'link', 'episode_url', 'episode_href'], '');
    if (direct) return direct;
    const id = row['id'];
    if (id !== undefined && id !== null && String(id).trim() !== '') {
        return `/video/${id}`;
    }
    const slug = pickText(row, ['episode_slug', 'slug'], '');
    if (slug) return `/episodes/${slug}`;
    return '-';
}

type EpisodeRow = { title: string; time: string; episode: string; address: string; groupIndex: number };

export default function Component() {
    const configStore = useConfigStore();
    const [list, setList] = useState<TData[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [clientPage, setClientPage] = useState(1);
    const staticBase = String(configStore.config['static'] ?? '').trim();
    const dateRange = useMemo(() => weekDateRange(), []);

    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        let cancelled = false;
        setLoading(true);
        api<IPagination>('movie/listnew', {
            loading: false,
            data: {
                // GET 下通过 query 传递数组字符串格式：["start","end"]
                daterange: JSON.stringify([dateRange[0], dateRange[1]]),
            },
        })
            .then((res) => {
                if (cancelled || res.c !== 0) return;
                setList(res.d.data);
                setTotal(res.d.count ?? 0);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [dateRange]);

    const rows = useMemo<EpisodeRow[]>(() => {
        return list.flatMap((row, groupIndex) => {
            const title = pickText(row, ['titile', 'title', 'name', 'book_title']);
            const outerTime = pickText(
                row,
                ['updated_at', 'update_time', 'time', 'created_at', 'publish_time', 'publish_at'],
                '',
            );
            const raw = row['list'];
            if (!Array.isArray(raw) || raw.length === 0) {
                return [
                    {
                        title,
                        time: formatDisplayTime(outerTime || '-'),
                        episode: pickText(row, ['episode', 'episodes', 'currentEp', 'current_ep', 'videos']),
                        address: toFallbackAddress(row),
                        groupIndex,
                    },
                ];
            }
            return raw.map((item, index) => {
                const record = item as Record<string, unknown>;
                const episodeValue = record['episode'];
                const video = String(record['video'] ?? '').trim();
                const address = video ? joinUrl(staticBase, video) : toFallbackAddress(row);
                const normalizedEpisode = Number(episodeValue);
                const innerTime = pickText(
                    record as TData,
                    ['updated_at', 'update_time', 'time', 'created_at', 'publish_time', 'publish_at'],
                    '',
                );
                return {
                    title,
                    time: formatDisplayTime(outerTime || innerTime || '-'),
                    // 优先使用接口返回 episode；缺失时按顺序补 1,2,3...，保证每一集一行
                    episode:
                        Number.isFinite(normalizedEpisode) && normalizedEpisode > 0
                            ? String(normalizedEpisode)
                            : String(index + 1),
                    address,
                    groupIndex,
                };
            });
        });
    }, [list, staticBase]);

    const clientTotalPage = Math.max(1, Math.ceil(rows.length / CLIENT_PAGE_SIZE));
    const pagedRows = useMemo(() => {
        const start = (clientPage - 1) * CLIENT_PAGE_SIZE;
        return rows.slice(start, start + CLIENT_PAGE_SIZE);
    }, [clientPage, rows]);

    useEffect(() => {
        setClientPage(1);
    }, [rows.length]);

    function goPage(next: number) {
        const target = Math.min(Math.max(1, next), clientTotalPage);
        setClientPage(target);
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }

    return (
        <div className="week-data-page h-full bg-[#f5f7fa] text-slate-900 flex flex-col min-h-0">
            <style>{`
                .week-data-page .week-data-scroll {
                    overflow-y: scroll !important;
                    overflow-x: hidden !important;
                    scrollbar-width: auto !important;
                    scrollbar-color: #94a3b8 #e2e8f0 !important;
                }
                .week-data-page .week-data-scroll::-webkit-scrollbar {
                    width: 24px !important;
                    height: 24px !important;
                    display: block !important;
                }
                .week-data-page .week-data-scroll::-webkit-scrollbar-track {
                    background: #e2e8f0 !important;
                }
                .week-data-page .week-data-scroll::-webkit-scrollbar-thumb {
                    background: #94a3b8 !important;
                    border-radius: 9999px !important;
                    border: 5px solid #e2e8f0 !important;
                }
                .week-data-page .week-data-scroll::-webkit-scrollbar-thumb:hover {
                    background: #64748b !important;
                }
            `}</style>
            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <Loader />
                </div>
            ) : (
                <>
                    <div className="week-data-scroll flex-1 min-h-0">
                        <table className="w-full table-fixed text-[14px] leading-6">
                            <thead className="sticky top-0 z-20 bg-[#ecf5ff] text-[#303133]">
                                <tr>
                                    <th className="w-[26%] px-3 py-2 text-left font-semibold border-b border-slate-300">名称</th>
                                    <th className="w-[16%] px-3 py-2 text-left font-semibold border-b border-slate-300">时间</th>
                                    <th className="w-[8%] px-3 py-2 text-left font-semibold border-b border-slate-300">集数</th>
                                    <th className="w-[50%] px-3 py-2 text-left font-semibold border-b border-slate-300">地址</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pagedRows.map((row, idx) => {
                                    const isLink = /^https?:\/\//.test(row.address) || row.address.startsWith('/');
                                    const groupClass =
                                        row.groupIndex % 2 === 0 ? 'bg-white' : 'bg-[#f5f7fa]';
                                    return (
                                        <tr key={`${row.title}-${row.episode}-${idx}`} className={groupClass}>
                                            <td className="px-3 py-2 border-b border-slate-200 align-top">
                                                <div className="line-clamp-3 break-words text-[16px] leading-6 font-medium text-slate-900">{row.title}</div>
                                            </td>
                                            <td className="px-3 py-2 border-b border-slate-200 whitespace-nowrap align-top text-slate-700">{row.time}</td>
                                            <td className="px-3 py-2 border-b border-slate-200 whitespace-nowrap align-top text-slate-700">{row.episode}</td>
                                            <td className="px-3 py-2 border-b border-slate-200 break-all align-top">
                                                {isLink ? (
                                                    <a
                                                        href={row.address}
                                                        target={row.address.startsWith('http') ? '_blank' : undefined}
                                                        rel={row.address.startsWith('http') ? 'noreferrer' : undefined}
                                                        className="text-blue-700 hover:text-blue-800 underline decoration-blue-400 break-all"
                                                    >
                                                        {row.address}
                                                    </a>
                                                ) : (
                                                    <span className="text-slate-700">{row.address}</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="shrink-0 border-t border-[#d9ecff] bg-[#ecf5ff] px-6 py-4 flex items-center justify-between gap-4 text-base">
                        <div className="text-[#303133] font-semibold text-[20px]">影剧总数: {total} | 展示总行数: {rows.length}</div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                className="rounded-md border border-[#b3d8ff] bg-white px-5 py-2.5 text-[#409eff] text-base font-semibold disabled:opacity-40"
                                disabled={clientPage <= 1}
                                onClick={() => goPage(clientPage - 1)}
                            >
                                上一页
                            </button>
                            <div className="text-[#303133] text-lg font-semibold">
                                第 {clientPage} / {clientTotalPage} 页（每页 {CLIENT_PAGE_SIZE} 条）
                            </div>
                            <button
                                type="button"
                                className="rounded-md border border-[#b3d8ff] bg-white px-5 py-2.5 text-[#409eff] text-base font-semibold disabled:opacity-40"
                                disabled={clientPage >= clientTotalPage}
                                onClick={() => goPage(clientPage + 1)}
                            >
                                下一页
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
