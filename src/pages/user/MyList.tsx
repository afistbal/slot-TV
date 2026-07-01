import { FormattedMessage, useIntl } from 'react-intl';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { Suspense, useCallback, useMemo } from 'react';
import Loader from '@/components/Loader';
import { PageBackBar } from '@/components/PageBackBar';
import { ReelShortFooter } from '@/components/ReelShortFooter';
import { ReelShortTopNav } from '@/components/ReelShortTopNav';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMinWidth768 } from '@/hooks/useMinWidth768';
import { cn } from '@/lib/utils';
import '@/styles/my-list-reelshort.scss';
import '@/styles/reelshort-dashboard-cabinet-mylist.scss';

type MyListLocationState = {
    sourceform?: string;
};

export default function Component() {
    const isPc = useMinWidth768();
    const intl = useIntl();
    const location = useLocation();
    const navigate = useNavigate();
    const locationState = (location.state ?? {}) as MyListLocationState;
    const sourceformFromSearch = new URLSearchParams(location.search).get('sourceform') ?? undefined;
    const rawSourceform = sourceformFromSearch ?? locationState.sourceform;
    const sourceform =
        typeof rawSourceform === 'string' && rawSourceform.length > 0 ? rawSourceform : undefined;
    const tab = useMemo(() => {
        const p = location.pathname.replace(/\/$/, '');
        return p.endsWith('/history') ? 'history' : 'favorite';
    }, [location.pathname]);

    const showTopBar = !(
        typeof window !== 'undefined' &&
        // @ts-expect-error Flutter InAppWebView
        window.flutter_inappwebview
    );

    const navigateTab = useCallback(
        (v: 'favorite' | 'history') => {
            navigate(
                `${v === 'history' ? '/my-list/history' : '/my-list'}${
                    sourceform ? `?sourceform=${encodeURIComponent(sourceform)}` : ''
                }`,
                {
                    replace: true,
                    state: sourceform ? { sourceform } : undefined,
                },
            );
        },
        [navigate, sourceform],
    );

    const outlet = (
        <Suspense key={location.key} fallback={<Loader />}>
            <Outlet key={location.key} />
        </Suspense>
    );

    if (!isPc) {
        return (
            <div className="rs-my-list-page rs-my-list-page--h5 flex h-full min-h-0 flex-col bg-app-canvas text-white">
                {showTopBar ? (
                    <ReelShortTopNav leftAction="none" showSearch={false} showRightActions={false} />
                ) : null}
                <div className="rs-my-list-page__scroll flex min-h-0 min-w-0 flex-1 flex-col">
                    <div className="rs-my-list-page__inner">
                        <div className="rs-my-list-tx">
                            <div
                                className="rs-my-list-tx__tabs"
                                role="tablist"
                                aria-label={intl.formatMessage({ id: 'my_list_history_title' })}
                            >
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={tab === 'favorite'}
                                    className={cn(
                                        'rs-my-list-tx__tab',
                                        tab === 'favorite' && 'rs-my-list-tx__tab--active',
                                    )}
                                    onClick={() => navigateTab('favorite')}
                                >
                                    <FormattedMessage id="my_list" />
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={tab === 'history'}
                                    className={cn(
                                        'rs-my-list-tx__tab',
                                        tab === 'history' && 'rs-my-list-tx__tab--active',
                                    )}
                                    onClick={() => navigateTab('history')}
                                >
                                    <FormattedMessage id="nav_watch_history" />
                                </button>
                            </div>
                            <div className="rs-my-list-tx__panel" role="tabpanel">
                                {outlet}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="rs-my-list-page flex h-full min-h-0 flex-col bg-app-canvas text-white">
            <div className="sticky top-0 z-[102] shrink-0 bg-black">
                {showTopBar ? (
                    <PageBackBar
                        className="border-b border-white/10 bg-black"
                        title={<FormattedMessage id="my_list_history_title" />}
                        onBack={() => {
                            if (sourceform) {
                                navigate(sourceform, { replace: true });
                                return;
                            }
                            if (window.history.length > 1) {
                                navigate(-1);
                                return;
                            }
                            navigate('/');
                        }}
                    />
                ) : null}

                <Tabs
                    value={tab}
                    onValueChange={(v) => navigateTab(v as 'favorite' | 'history')}
                    className="flex w-full shrink-0 flex-col bg-black"
                >
                    <TabsList className="flex w-full flex-wrap items-stretch justify-start gap-x-8 gap-y-2 overflow-visible rounded-none border-0 border-b border-white/10 bg-black p-4 pb-6 text-sm shadow-none">
                        <TabsTrigger
                            value="favorite"
                            className="rs-my-list__tabTrigger rounded-none border-0 bg-transparent px-0 py-1 text-inherit font-normal leading-normal text-white/60 shadow-none ring-offset-0 transition-colors hover:text-white/80 data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none"
                        >
                            <FormattedMessage id="my_list" />
                        </TabsTrigger>
                        <TabsTrigger
                            value="history"
                            className="rs-my-list__tabTrigger rounded-none border-0 bg-transparent px-0 py-1 text-inherit font-normal leading-normal text-white/60 shadow-none ring-offset-0 transition-colors hover:text-white/80 data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none"
                        >
                            <FormattedMessage id="nav_watch_history" />
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
                    <div className="flex min-h-full min-w-0 flex-1 flex-col">{outlet}</div>
                </div>
                <div className="shrink-0">
                    <ReelShortFooter dockAboveBottomTab />
                </div>
            </div>
        </div>
    );
}
