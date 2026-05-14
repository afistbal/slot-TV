import { FormattedMessage, useIntl } from "react-intl";
import { matchPath, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { ChevronLeft, ChevronRight, Home as IconHome, User as IconProfile, ListVideo } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { ReelShortBasicsSpin } from "@/components/ReelShortBasicsSpin";
import UserHome from "@/pages/user/Home";
import UserSearch from "@/pages/user/Search";
import usePixel from "@/hooks/usePixel";
import { showBottomTabBar } from "@/env";
import { IosAddHomeFloatingBtn } from "@/components/IosAddHomeFloatingBtn";
import {
    prefetchMyListRouteChunk,
    prefetchProfileRouteChunk,
} from "@/lib/prefetchSecondaryUserRoutes";

/** 与 App 中 `/`、`/search`、`/:locale/search` 占位路由一致；仅这两页做 DOM 级 keep-alive，避免反复卸载导致图片/LazyLoad 重跑 */
function usePrimaryTabKeepAlive() {
    const { pathname } = useLocation();
    const isHome = matchPath({ path: "/", end: true }, pathname) != null;
    const isSearch =
        matchPath({ path: "/search", end: true }, pathname) != null ||
        matchPath({ path: "/:locale/search", end: true }, pathname) != null;
    return { isHome, isSearch };
}

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
    /**
     * 默认用 pathname+search 作 key，换 URL 即 remount，避免脏状态。
     * 播放页例外：换集只改 `/:episode`，若整页 remount 会丢掉全屏/播放器状态；同一剧 id 下保持稳定 key。
     */
    const outletKey = useMemo(() => {
        const { pathname, search } = location;
        const videoMatch = matchPath({ path: '/video/:id/:episode?', end: true }, pathname);
        if (videoMatch?.params?.id != null) {
            return `video:${String(videoMatch.params.id)}${search}`;
        }
        return `${pathname}${search}`;
    }, [location]);
    const { isHome, isSearch } = usePrimaryTabKeepAlive();
    const visitedHomeRef = useRef(false);
    const visitedSearchRef = useRef(false);
    if (isHome) visitedHomeRef.current = true;
    if (isSearch) visitedSearchRef.current = true;
    const showPrimaryKeepAlive = isHome || isSearch;
    const pathSegments = location.pathname.toLowerCase().split('/').filter(Boolean);
    const isShoppingRoute = pathSegments[pathSegments.length - 1] === 'shopping';
    /** 全屏播放器壳：勿叠底部「加入桌面」胶囊，避免挡控制条 / 与 PC 侧栏观感冲突 */
    const isImmersivePlayerShell = useMemo(() => {
        const { pathname } = location;
        return matchPath({ path: '/video/:id/:episode?', end: true }, pathname) != null;
    }, [location.pathname]);

    useEffect(() => {
        pixel.track('PageView');
    }, [location, pixel]);

    return <div className="flex h-full min-h-0 flex-col">
        {/* min-h-0 + overflow-hidden：纵滑只发生在各页内部 scroll 容器，避免与首页 home-page__scroll 双轨滚动导致页脚滚不到、顶栏 ref 的 scrollTop 恒为 0 */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {/*
              flex-1+min-h-0：保证首页 home-page 的 h-full / 内层 overflow-y-auto 高度链不断。
            */}
            <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
                {visitedHomeRef.current ? (
                    <div
                        className={cn(
                            "flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden",
                            !isHome && "hidden",
                        )}
                        aria-hidden={!isHome}
                    >
                        <Suspense fallback={<RouteSuspenseFallback />}>
                            <UserHome />
                        </Suspense>
                    </div>
                ) : null}
                {visitedSearchRef.current ? (
                    <div
                        className={cn(
                            "flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden",
                            !isSearch && "hidden",
                        )}
                        aria-hidden={!isSearch}
                    >
                        <Suspense fallback={<RouteSuspenseFallback />}>
                            <UserSearch />
                        </Suspense>
                    </div>
                ) : null}
                {!showPrimaryKeepAlive ? (
                    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
                        <Suspense key={outletKey} fallback={<RouteSuspenseFallback />}>
                            <Outlet key={outletKey} />
                        </Suspense>
                    </div>
                ) : null}
            </div>
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
                    onPointerEnter={prefetchMyListRouteChunk}
                    onPointerDown={prefetchMyListRouteChunk}
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
                    to="/profile?tab=topup"
                    onPointerEnter={prefetchProfileRouteChunk}
                    onPointerDown={prefetchProfileRouteChunk}
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
        {!isShoppingRoute && !isImmersivePlayerShell ? <IosAddHomeFloatingBtn /> : null}
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
