import { api, type IPagination } from "@/api";
import NoContent from "@/components/NoContent";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Page } from "@/layouts/admin";
import { cn } from "@/lib/utils";
import { useUserListStore } from "@/stores/admin";
import { LoaderCircle } from "lucide-react";
import { useEffect, useRef } from "react";
import { InView } from "react-intersection-observer";
import { FormattedDate, FormattedMessage, useIntl } from "react-intl";
import { Link } from "react-router";

export default function Component() {
    const userListStore = useUserListStore();
    const intl = useIntl();
    const scrollRef = useRef<HTMLDivElement>(null);
    const requesting = useRef(false);
    const searching = useRef(false);
    const timer = useRef(0);

    function handleMoreChange(visible: boolean) {
        if (searching.current) {
            return;
        }
        if (!visible) {
            return;
        }

        loadData(userListStore.page + 1);
    }

    function handleScrollEnd(e: React.UIEvent<HTMLDivElement>) {
        userListStore.setScrollTop(e.currentTarget.scrollTop);
    }

    function handleKeywordChange(e: React.ChangeEvent<HTMLInputElement>) {
        searching.current = true;
        userListStore.setKeyword(e.currentTarget.value);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
            loadData();
        }, 500);
    }

    function handleSetType(type: number) {
        userListStore.setType(type);
        loadData();
    }

    async function loadData(p = 1) {
        const state = useUserListStore.getState();
        if (p <= state.page || !state.more || requesting.current) {
            return;
        }
        requesting.current = true;
        const result = await api<IPagination>('admin/user', {
            loading: false,
            data: {
                page: p,
                keyword: state.keyword,
                type: state.type,
            }
        }).finally(() => {
            requesting.current = false;
            searching.current = false;
        });
        state.setLoading(false);
        state.setPage(p);
        state.setList([...state.list, ...result.d.data.map(v => {
            v['color'] = ['bg-orange-300', 'bg-pink-300', 'bg-red-300', 'bg-emerald-300', 'bg-purple-300'][Math.floor(Math.random() * 5)];
            return v;
        })]);
        state.setTotal(result.d.count ?? 0);
        state.setMore(result.d.per_page === result.d.data.length);
    }

    useEffect(() => {
        if (userListStore.list.length > 0) {
            if (!scrollRef.current) {
                return;
            }
            scrollRef.current.scrollTop = userListStore.scrollTop;
        }
    }, []);

    return <Page title="user" titleClassName="bg-black text-slate-100 border-slate-800">
        <div className="flex flex-col h-full overflow-auto bg-black text-slate-100" ref={scrollRef} onScrollEnd={handleScrollEnd}>
            <div className="flex items-center justify-between px-4 pt-4 shrink-0 gap-4">
                <div className="shrink-0 text-slate-400">
                    <FormattedMessage id="user_total" values={{ total: userListStore.total || '...' }} />
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                    <DropdownMenu>
                        <DropdownMenuTrigger className="border border-slate-700 rounded-md bg-slate-900 px-4 text-slate-300 text-sm py-2 min-h-10">
                            <FormattedMessage id={userListStore.type === 0 ? 'all' : userListStore.type === 1 ? 'registered_user' : 'anonymous_user'} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleSetType(0)}>
                                <div className={cn(userListStore.type === 0 && 'text-red-400')}><FormattedMessage id="all" /></div>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSetType(1)}>
                                <div className={cn(userListStore.type === 1 && 'text-red-400')}><FormattedMessage id="registered_user" /></div>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSetType(2)}>
                                <div className={cn(userListStore.type === 2 && 'text-red-400')}><FormattedMessage id="anonymous_user" /></div>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <label className="h-10 w-30 flex items-center border border-slate-700 rounded bg-slate-900 focus-within:bg-slate-800">
                        <input value={userListStore.keyword} onChange={handleKeywordChange} type="text" enterKeyHint="done" maxLength={32} autoComplete="off" name="search" className="px-4 w-full h-full outline-none py-0 text-center text-sm text-slate-100" placeholder={intl.formatMessage({ id: 'flix_search' })} />
                    </label>
                </div>
            </div>
            {!userListStore.loading && userListStore.list.length === 0 ? <NoContent /> : <div className={cn('flex flex-col gap-2 p-4', userListStore.loading || userListStore.list.length === 0 ? 'overflow-hidden' : '')}>
                {userListStore.loading ? <div /> : userListStore.list.map(v => <Link to={`/z/page/user/${v['id']}`} key={v['id'] as string}>
                    <div className="flex gap-4 bg-slate-900 border border-slate-800 p-4 rounded-md relative overflow-hidden">
                        <div className={cn('h-[64px] w-[64px] rounded-full shrink-0 flex justify-center items-center text-2xl leading-6 text-white', v['color'] as string)}>
                            <div>{(v['avatar'] as string).toUpperCase()}</div>
                        </div>
                        <div className="flex flex-col justify-center">
                            <div className="text-lg leading-[18px] text-slate-100">{v['id'] as number}</div>
                            <div className="text-sm text-slate-400 leading-4 py-1.5">{v['unique_id'] as string}</div>
                            <div className="text-xs text-slate-400 leading-3" title={v['created_at'] as string}><FormattedMessage id="created_at" /> <FormattedDate value={v['created_at'] as string} /> <FormattedMessage id="login_at" /> <FormattedDate value={v['created_at'] as string} /></div>
                        </div>
                        <div className="absolute top-0 right-0 flex text-xs text-white rounded-bl-md overflow-hidden">
                            {v['vip'] as number > 0 && <div className="bg-orange-300 px-2 py-1">
                                <FormattedMessage id="vip"/>
                            </div>}
                            {v['anonymous'] as number === 0 && <div className="bg-red-300 px-2 py-1">
                                <FormattedMessage id="registered_user"/>
                            </div>}
                        </div>
                    </div>
                </Link>)}
                <InView as="div" onChange={handleMoreChange} className="h-12 flex justify-center items-center col-span-full">
                    {userListStore.more ? <LoaderCircle className="w-8 h-8 text-slate-500 animate-[spin_1.5s_ease_infinite]" /> : <div className='text-slate-500'><FormattedMessage id="no_more" /></div>}
                </InView>
            </div>}
        </div>
    </Page>
}