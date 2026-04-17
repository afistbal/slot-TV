import { FormattedMessage } from 'react-intl';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { Suspense, useMemo } from 'react';
import Loader from '@/components/Loader';
import { PageBackBar } from '@/components/PageBackBar';
import { ReelShortFooter } from '@/components/ReelShortFooter';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type MyListLocationState = {
    sourceform?: string;
};

export default function Component() {
    const location = useLocation();
    const navigate = useNavigate();
    const locationState = (location.state ?? {}) as MyListLocationState;
    const sourceformFromSearch = new URLSearchParams(location.search).get('sourceform') ?? undefined;
    const sourceform = sourceformFromSearch ?? locationState.sourceform;
    const tab = useMemo(() => {
        const p = location.pathname.replace(/\/$/, '');
        return p.endsWith('/history') ? 'history' : 'favorite';
    }, [location.pathname]);

    const showTopBar = !(
        typeof window !== 'undefined' &&
        // @ts-expect-error Flutter InAppWebView
        window.flutter_inappwebview
    );

    return (
        <div className="flex h-full min-h-0 flex-col bg-app-canvas text-white">
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
                    onValueChange={(v) =>
                        navigate(
                            `${v === 'history' ? '/my-list/history' : '/my-list'}${
                                sourceform ? `?sourceform=${encodeURIComponent(sourceform)}` : ''
                            }`,
                            {
                            replace: true,
                            state: sourceform ? { sourceform } : undefined,
                        },
                        )
                    }
                    className="flex w-full shrink-0 flex-col bg-black"
                >
                    <TabsList className="flex w-full flex-wrap items-stretch justify-start gap-x-8 gap-y-2 overflow-visible rounded-none border-0 border-b border-white/10 bg-black p-[calc(4/100*var(--app-vw))] pb-[calc(6/100*var(--app-vw)+2px)] text-[calc(3.73333/100*var(--app-vw))] shadow-none md:p-4 md:pb-6 md:text-sm">
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

            <div className="min-h-0 flex-1 overflow-y-auto">
                <Suspense key={location.key} fallback={<Loader />}>
                    <Outlet key={location.key} />
                </Suspense>
                <ReelShortFooter />
            </div>
        </div>
    );
}
