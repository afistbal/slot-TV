import { api, type IPagination } from "@/api";
import NoContent from "@/components/NoContent";
import { Page } from "@/layouts/admin";
import { cn } from "@/lib/utils";
import { useOrderListStore } from "@/stores/admin";
import { LoaderCircle } from "lucide-react";
import { useEffect, useRef } from "react";
import { InView } from "react-intersection-observer";
import { FormattedDate, FormattedMessage, useIntl } from "react-intl";
import { Link } from "react-router";

export default function Component() {
    const store = useOrderListStore();
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

        loadData(store.page + 1);
    }

    function handleScrollEnd(e: React.UIEvent<HTMLDivElement>) {
        store.setScrollTop(e.currentTarget.scrollTop);
    }

    function handleKeywordChange(e: React.ChangeEvent<HTMLInputElement>) {
        searching.current = true;
        store.setKeyword(e.currentTarget.value);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
            loadData();
        }, 500);
    }

    async function loadData(p = 1) {
        const state = useOrderListStore.getState();
        if (p <= state.page || !state.more || requesting.current) {
            return;
        }
        requesting.current = true;
        const result = await api<IPagination>('admin/order', {
            loading: false,
            data: {
                page: p,
                keyword: state.keyword,
            }
        }).finally(() => {
            requesting.current = false;
            searching.current = false;
        });
        state.setLoading(false);
        state.setPage(p);
        state.setList([...state.list, ...result.d.data]);
        state.setTotal(result.d.count ?? 0);
        state.setMore(result.d.per_page === result.d.data.length);
    }

    useEffect(() => {
        if (store.list.length > 0) {
            if (!scrollRef.current) {
                return;
            }
            scrollRef.current.scrollTop = store.scrollTop;
        }
    }, []);

    return <Page title="order">
        <div className="flex flex-col h-full overflow-auto" ref={scrollRef} onScrollEnd={handleScrollEnd}>
            <div className="flex items-center justify-between px-4 pt-4 shrink-0">
                <div className="shrink-0 text-slate-500">
                    <FormattedMessage id="total_orders" values={{ total: store.total || '...' }} />
                </div>
                <label className="h-10 w-40 flex items-center border border-slate-300 rounded bg-slate-50 focus-within:bg-slate-100">
                    <input value={store.keyword} onChange={handleKeywordChange} type="text" enterKeyHint="done" maxLength={32} autoComplete="off" name="search" className="px-4 w-full h-full outline-none py-0 text-center text-sm" placeholder={intl.formatMessage({ id: 'flix_search' })} />
                </label>
            </div>
            {!store.loading && store.list.length === 0 ? <NoContent /> : <div className={cn('flex flex-col gap-2 p-4', store.loading || store.list.length === 0 ? 'overflow-hidden' : '')}>
                {store.loading ? <div /> : store.list.map(v => <Link to={`/z/page/order/${v['id']}`} key={v['id'] as string}>
                    <div className="flex justify-between items-center gap-4 bg-white p-4 rounded-md relative">
                        <div className="flex flex-col justify-center">
                            <div className="flex items-center">
                                <div className="text-lg font-bold">{v['id'] as number}</div>
                                <div className="text-xs px-1 py-0.5 border-slate-400 border rounded-sm text-slate-500 ml-1">{v['product_name'] as string}</div>
                                {v['type'] === 2 && <div className="text-xs px-1 py-0.5 border-lime-500 border rounded-sm text-lime-600 ml-1">
                                    <FormattedMessage id="renewal"/>
                                </div>}
                            </div>
                            <div className="text-sm text-slate-500 leading-4 py-3">{v['platform_sn'] as string}</div>
                            <div className="text-xs text-slate-400 leading-3" title={v['created_at'] as string}><FormattedMessage id="created_at" /> <FormattedDate value={v['created_at'] as string} /> <FormattedMessage id="updated_at" /> <FormattedDate value={v['updated_at'] as string} /></div>
                        </div>
                        <div className="flex flex-col gap-2 items-center">
                            <div className="flex items-center text-red-400">
                                <span className="text-sm mt-[3px]">$</span>
                                <span className="text-2xl">{v['amount'] as string}</span>
                            </div>

                            <div className={cn("rounded-sm text-sm px-2 py-1.5 text-white leading-3", v['status'] as number === 0 && 'bg-slate-400', v['status'] as number === 1 && 'bg-orange-400', v['status'] as number === 2 && 'bg-purple-400',)}>
                                {(v['status'] as number) === 0 && <FormattedMessage id="unpaid" />}
                                {(v['status'] as number) === 1 && <FormattedMessage id="paid" />}
                                {(v['status'] as number) === 2 && <FormattedMessage id="refunded" />}
                            </div>
                        </div>
                    </div>
                </Link>)}
                <InView as="div" onChange={handleMoreChange} className="h-12 flex justify-center items-center col-span-full">
                    {store.more ? <LoaderCircle className="w-8 h-8 text-slate-500 animate-[spin_1.5s_ease_infinite]" /> : <div className='text-slate-400'><FormattedMessage id="no_more" /></div>}
                </InView>
            </div>}
        </div>
    </Page>
}