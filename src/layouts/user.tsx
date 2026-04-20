import { FormattedMessage, useIntl } from "react-intl";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { ChevronLeft, ChevronRight, Home as IconHome, User as IconProfile, ListVideo } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Suspense, useEffect } from "react";
import { ReelShortBasicsSpin } from "@/components/ReelShortBasicsSpin";
import usePixel from "@/hooks/usePixel";
import { showBottomTabBar } from "@/env";
import { IosAddHomeFloatingBtn } from "@/components/IosAddHomeFloatingBtn";

function RouteSuspenseFallback() {
    const intl = useIntl();
    return (
        <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center bg-app-canvas">
            <ReelShortBasicsSpin
                visible
                variant="inline"
                withOverlay={false}
                label={intl.formatMessage({ id: 'loading' })}
            />
        </div>
    );
}

export default function Component() {
    const pixel = usePixel();
    const location = useLocation();
    const sourceform = `${location.pathname}${location.search}`;
    const pathSegments = location.pathname.toLowerCase().split('/').filter(Boolean);
    const isShoppingRoute = pathSegments[pathSegments.length - 1] === 'shopping';

    useEffect(() => {
        pixel.track('PageView');
    }, [location, pixel]);

    return <div className="flex h-full min-h-0 flex-col">
        {/* min-h-0：允许 flex 子项低于内容高度，否则滚动落在外层，首页 scrollRef.scrollTop 恒为 0，顶栏无法切实心背景 */}
        <div className="min-h-0 min-w-0 flex-1 overflow-auto">
            <Suspense key={location.key} fallback={<RouteSuspenseFallback />}>
                <Outlet key={location.key} />
            </Suspense>
        </div>
        {/* ReelShort 无底部三栏 Tab；需要旧版时设 `VITE_BOTTOM_TAB_BAR=true`（见 `src/env.ts`） */}
        {showBottomTabBar ? (
            <div className="grid grid-cols-3 border-t border-white/10 bg-app-surface px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 text-[11px]">
                <NavLink
                    to="/"
                    className={({ isActive }) =>
                        cn(
                            'flex flex-col items-center gap-0.5 rounded-md py-1',
                            isActive ? 'text-white' : 'text-white/55',
                        )
                    }
                >
                    <IconHome className="h-5 w-5 shrink-0" />
                    <div>
                        <FormattedMessage id="home" />
                    </div>
                </NavLink>
                <NavLink
                    to={`/my-list?sourceform=${encodeURIComponent(sourceform)}`}
                    state={{ sourceform }}
                    className={({ isActive }) =>
                        cn(
                            'flex flex-col items-center gap-0.5 rounded-md py-1',
                            isActive ? 'text-white' : 'text-white/55',
                        )
                    }
                >
                    <ListVideo className="h-5 w-5 shrink-0" />
                    <div>
                        <FormattedMessage id="my_list" />
                    </div>
                </NavLink>
                <NavLink
                    to="/profile"
                    className={({ isActive }) =>
                        cn(
                            'flex flex-col items-center gap-0.5 rounded-md py-1',
                            isActive ? 'text-white' : 'text-white/55',
                        )
                    }
                >
                    <IconProfile className="h-5 w-5 shrink-0" />
                    <div>
                        <FormattedMessage id="profile" />
                    </div>
                </NavLink>
            </div>
        ) : null}
        {!isShoppingRoute ? <IosAddHomeFloatingBtn /> : null}
    </div>;
}

export function Page({
    title,
    titleClassName,
    bodyClassName,
    children,
    action,
}: {
    title: string;
    titleClassName?: string;
    /** 标题下方主滚动区 class（如收银台铺满深色底） */
    bodyClassName?: string;
    children?: React.ReactNode;
    action?: React.ReactNode;
}) {
    const navigate = useNavigate();

    function handleBack() {
        navigate(-1);
    }

    return <div className="flex flex-col h-full">
        {/** @ts-expect-error - injected by Flutter InAppWebView */}
        {!window.flutter_inappwebview && (
            <div
                className={cn(
                    "relative flex items-center justify-center border-b border-white/10 bg-app-canvas text-white",
                    "min-h-[calc(44/375*var(--app-vw))]",
                    titleClassName,
                )}
            >
                <div className="absolute left-1 top-1/2 -translate-y-1/2 md:left-6">
                    {history.length > 0 ? (
                        <button
                            type="button"
                            onClick={handleBack}
                            className="flex h-10 w-10 items-center justify-center rounded-md text-white/90 hover:bg-white/10 active:bg-white/15"
                        >
                            {document.body.style.direction === 'ltr' ? (
                                <ChevronLeft className="h-7 w-7" />
                            ) : (
                                <ChevronRight className="h-7 w-7" />
                            )}
                        </button>
                    ) : null}
                </div>

                <div className="mx-auto max-w-[70%] truncate text-center text-lg">
                    <FormattedMessage id={title} />
                </div>

                <div className="absolute right-3 top-1/2 -translate-y-1/2 md:right-6">
                    {action}
                </div>
            </div>
        )}
        <div className={cn('flex-1 overflow-auto', bodyClassName)}>
            {children}
        </div>
    </div>
}
