import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { api, type IPagination, type TData } from '@/api';
import { ReelShortTopNav } from '@/components/ReelShortTopNav';
import { cn } from '@/lib/utils';

function SearchIcon16({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="1em"
            height="1em"
            viewBox="0 0 16 16"
            fill="currentColor"
            className={cn('shrink-0 text-current', className)}
            aria-hidden
        >
            <path
                fill="currentColor"
                fillRule="evenodd"
                d="M6.5 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9M1 6.5a5.5 5.5 0 1 1 9.727 3.52l3.127 3.126-.708.708-3.126-3.127A5.5 5.5 0 0 1 1 6.5"
                clipRule="evenodd"
            />
        </svg>
    );
}

function normalizeMovieItem(v: TData): { id: number; title: string } | null {
    const id = Number(v['id']);
    if (!Number.isFinite(id)) return null;
    const title = String(v['title'] ?? v['book_title'] ?? v['name'] ?? '');
    return { id, title };
}

export default function Component() {
    useParams(); // 保留以触发 locale 路由变化时的重新渲染（无需显式读取）
    const location = useLocation();
    const navigate = useNavigate();
    const scrollRef = useRef<HTMLDivElement>(null);
    const timerRef = useRef<number>(0);
    const urlSyncTimerRef = useRef<number>(0);

    const qFromUrl = useMemo(() => {
        const q = new URLSearchParams(location.search).get('q') ?? '';
        return decodeURIComponent(q.replace(/\+/g, ' '));
    }, [location.search]);

    const tagFromUrl = useMemo(() => new URLSearchParams(location.search).get('tag') ?? '', [location.search]);

    const [keyword, setKeyword] = useState(qFromUrl);
    const [tag, setTag] = useState(tagFromUrl);
    const [, setLoading] = useState(false);
    const [list, setList] = useState<TData[]>([]);
    const [, setActiveIndex] = useState(-1);
    const [tags, setTags] = useState<TData[]>([]);

    useEffect(() => {
        setKeyword(qFromUrl);
    }, [qFromUrl]);

    useEffect(() => {
        setTag(tagFromUrl);
    }, [tagFromUrl]);

    // 将 keyword/tag 同步到 URL：保证刷新/复制链接可复现当前搜索状态
    useEffect(() => {
        window.clearTimeout(urlSyncTimerRef.current);
        urlSyncTimerRef.current = window.setTimeout(() => {
            const qs = new URLSearchParams(location.search);

            const nextQ = keyword.trim();
            if (nextQ) qs.set('q', nextQ);
            else qs.delete('q');

            const nextTag = tag.trim();
            if (nextTag) qs.set('tag', nextTag);
            else qs.delete('tag');

            const nextSearch = qs.toString();
            const curr = location.search.replace(/^\?/, '');
            if (nextSearch !== curr) {
                navigate(
                    {
                        pathname: location.pathname,
                        search: nextSearch ? `?${nextSearch}` : '',
                    },
                    { replace: true },
                );
            }
        }, 150);

        return () => window.clearTimeout(urlSyncTimerRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [keyword, tag, location.pathname]);

    useEffect(() => {
        api<TData[]>('movie/tags', { loading: false }).then((res) => {
            setTags(res.d ?? []);
        });
    }, []);

    async function load(page = 1, kw = keyword, t = tag) {
        const k = kw.trim();
        setLoading(true);
        try {
            const res = await api<IPagination>('movie', {
                loading: false,
                data: {
                    page,
                    keyword: k,
                    ...(t ? { tag: t } : {}),
                },
            });
            setList((res.d?.data ?? []) as TData[]);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => {
            load(1, keyword, tag);
        }, 250);
        return () => window.clearTimeout(timerRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [keyword, tag]);

    const items = useMemo(
        () => list.map(normalizeMovieItem).filter(Boolean) as { id: number; title: string }[],
        [list],
    );

    return (
        <div className="flex h-full flex-col bg-app-canvas">
            <div className="overflow-y-auto flex-1" ref={scrollRef}>
                <ReelShortTopNav scrollParentRef={scrollRef} />

                <div className="pt-16/vw">
                    {/* 2) 搜索框：用你贴的那套结构与 class（含 icon） */}
                    <div
                        role="search-bar"
                        className="relative z-10 flex items-center overflow-hidden bg-black px-[min(4.27vw,1rem)] py-[min(1.6vw,0.5rem)] md:rounded-md md:bg-black/60 md:px-0 md:py-0 md:backdrop-blur-md"
                    >
                        <div
                            className="flex h-[min(11.2vw,2.625rem)] w-full items-center rounded-[min(2.13vw,8px)] border border-solid border-white/50 bg-white/10 px-[min(3.2vw,0.75rem)] md:h-[60px] md:rounded-xl"
                        >
                            <SearchIcon16 className="shrink-0 h-[min(6.4vw,1.5rem)] w-[min(6.4vw,1.5rem)] text-white md:h-6 md:w-6 md:opacity-50" />
                            <input
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                                type="search"
                                maxLength={100}
                                autoFocus
                                className="rs-search-input w-full border-0 bg-transparent px-[min(2.13vw,0.5rem)] text-[min(4.27vw,1rem)] text-white placeholder:text-white/50 focus:outline-none md:px-2 md:text-xl"
                                placeholder="搜尋任意內容"
                                onKeyDown={(e) => {
                                    if (e.key === 'ArrowDown') {
                                        e.preventDefault();
                                        setActiveIndex((i) => Math.min(items.length - 1, Math.max(-1, i + 1)));
                                    }
                                    if (e.key === 'ArrowUp') {
                                        e.preventDefault();
                                        setActiveIndex((i) => Math.max(-1, i - 1));
                                    }
                                }}
                            />
                            <div className="flex w-[30px] shrink-0 justify-end">
                                {keyword.trim().length > 0 ? (
                                    <span
                                        role="img"
                                        aria-label="close-circle"
                                        tabIndex={-1}
                                        className="rs-search-clear anticon anticon-close-circle cursor-pointer text-white/80 text-12/vw md:hidden"
                                        onClick={() => setKeyword('')}
                                    >
                                        <svg fillRule="evenodd" viewBox="64 64 896 896" focusable="false" data-icon="close-circle" width="1em" height="1em" fill="currentColor" aria-hidden="true">
                                            <path d="M512 64c247.4 0 448 200.6 448 448S759.4 960 512 960 64 759.4 64 512 264.6 64 512 64zm127.98 274.82h-.04l-.08.06L512 466.75 384.14 338.88c-.04-.05-.06-.06-.08-.06a.12.12 0 00-.07 0c-.03 0-.05.01-.09.05l-45.02 45.02a.2.2 0 00-.05.09.12.12 0 000 .07v.02a.27.27 0 00.06.06L466.75 512 338.88 639.86c-.05.04-.06.06-.06.08a.12.12 0 000 .07c0 .03.01.05.05.09l45.02 45.02a.2.2 0 00.09.05.12.12 0 00.07 0c.02 0 .04-.01.08-.05L512 557.25l127.86 127.87c.04.04.06.05.08.05a.12.12 0 00.07 0c.03 0 .05-.01.09-.05l45.02-45.02a.2.2 0 00.05-.09.12.12 0 000-.07v-.02a.27.27 0 00-.05-.06L557.25 512l127.87-127.86c.04-.04.05-.06.05-.08a.12.12 0 000-.07c0-.03-.01-.05-.05-.09l-45.02-45.02a.2.2 0 00-.09-.05.12.12 0 00-.07 0z"></path>
                                        </svg>
                                    </span>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="rs-tagbar flex gap-2 flex-wrap p-4 border-b justify-center">
                    {tags.slice(0, 10).map((t) => {
                        const name = String(t['name'] ?? '');
                        if (!name) return null;
                        const active = name === tag;
                        return (
                            <div
                                key={name}
                                onClick={() => setTag((prev) => (prev === name ? '' : name))}
                                className={cn(
                                    'rs-tag bg-slate-200 cursor-pointer hover:bg-slate-300 hover:border-slate-400 border border-transparent text-gray-500 px-2 py-1 text-sm rounded',
                                    active && 'rs-tag--active',
                                )}
                                data-active={active ? 'true' : 'false'}
                            >
                                {name}
                            </div>
                        );
                    })}
                    <div className="rs-tagbar__more flex justify-center items-center bg-red-100 cursor-pointer hover:bg-red-200 hover:border-red-400 border border-transparent text-red-500 px-2 py-1 text-sm rounded">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="1"></circle>
                            <circle cx="19" cy="12" r="1"></circle>
                            <circle cx="5" cy="12" r="1"></circle>
                        </svg>
                    </div>
                </div>

            </div>
        </div>
    );
}

