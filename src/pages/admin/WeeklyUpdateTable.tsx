import { api, type IPagination, type TData } from '@/api';
import Loader from '@/components/Loader';
import { useConfigStore } from '@/stores/config';
import { useEffect, useMemo, useState } from 'react';

const PER_PAGE = 400;
const COS_FALLBACK_BASE = 'https://cos.yogoshort.com';

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
    const [currentPage, setCurrentPage] = useState(1);
    const [currentPerPage, setCurrentPerPage] = useState(PER_PAGE);
    const [loading, setLoading] = useState(true);
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
                setCurrentPage(res.d.current_page ?? 1);
                setCurrentPerPage(res.d.per_page ?? PER_PAGE);
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
                        time: outerTime || '-',
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
                    time: outerTime || innerTime || '-',
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

    return (
        <div className="h-full bg-[#f3f4f6] text-slate-900 flex flex-col">
            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <Loader />
                </div>
            ) : (
                <>
                    <div className="flex-1 overflow-auto">
                        <table className="w-full table-fixed text-[14px] leading-6">
                            <thead className="sticky top-0 z-20 bg-[#e5e7eb] text-slate-900">
                                <tr>
                                    <th className="w-[26%] px-3 py-2 text-left font-semibold border-b border-slate-300">名称</th>
                                    <th className="w-[16%] px-3 py-2 text-left font-semibold border-b border-slate-300">时间</th>
                                    <th className="w-[8%] px-3 py-2 text-left font-semibold border-b border-slate-300">集数</th>
                                    <th className="w-[50%] px-3 py-2 text-left font-semibold border-b border-slate-300">地址</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, idx) => {
                                    const isLink = /^https?:\/\//.test(row.address) || row.address.startsWith('/');
                                    const groupClass =
                                        row.groupIndex % 2 === 0 ? 'bg-[#f8fafc]' : 'bg-[#eef2ff]';
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
                    <div className="shrink-0 border-t border-slate-300 bg-[#e5e7eb] px-3 py-2 flex items-center justify-between gap-2 text-xs">
                        <div className="text-slate-600">总数: {total}</div>
                        <div className="text-slate-600">页码: {currentPage} / 每页: {currentPerPage}</div>
                    </div>
                </>
            )}
        </div>
    );
}
