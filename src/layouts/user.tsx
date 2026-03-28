import { FormattedMessage } from "react-intl";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { ChevronLeft, ChevronRight, Home as IconHome, User as IconProfile, ListVideo } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Suspense, useEffect } from "react";
import Loader from "@/components/Loader";
import usePixel from "@/hooks/usePixel";

export default function Component() {
    const pixel = usePixel();
    const location = useLocation();

    useEffect(() => {
        pixel.track('PageView');
    }, [location]);

    return <div className="flex flex-col h-full">
        <div className="flex-1 overflow-auto">
            <Suspense key={location.key} fallback={<Loader />}>
                <Outlet key={location.key} />
            </Suspense>
        </div>
        <div className="p-2 grid grid-cols-3 border-t border-slate-200 bg-white text-xs text-slate-500">
            <NavLink className="flex flex-col items-center gap-0.5" to="/">
                <IconHome className="w-5 h-5" />
                <div>
                    <FormattedMessage id="home" />
                </div>
            </NavLink>
            <NavLink className="flex flex-col items-center gap-0.5" to="/my-list">
                <ListVideo className="w-5 h-5" />
                <div>
                    <FormattedMessage id="my_list" />
                </div>
            </NavLink>
            <NavLink className="flex flex-col items-center gap-0.5" to="/profile">
                <IconProfile className="w-5 h-5" />
                <div>
                    <FormattedMessage id="profile" />
                </div>
            </NavLink>
        </div>
    </div>;
}

export function Page({ title, titleClassName, children, action }: { title: string, titleClassName?: string, children?: React.ReactNode, action?: React.ReactNode }) {
    const navigate = useNavigate();

    function handleBack() {
        navigate(-1);
    }

    return <div className="flex flex-col h-full">
        {/** @ts-ignore */}
        {!window.flutter_inappwebview && <div className={cn("flex justify-between h-16 items-center border-b border-slate-200 text-slate-600", titleClassName || 'bg-white')}>
            {history.length > 0 ? <div onClick={handleBack} className="w-10 h-16 flex justify-center items-center shrink-0">
                {document.body.style.direction === 'ltr' ? <ChevronLeft /> : <ChevronRight />}
            </div> : <div />}
            <div className="text-lg font-bold text-ellipsis flex-1 whitespace-nowrap overflow-hidden">
                <FormattedMessage id={title} />
            </div>
            {action || <div />}
        </div>}
        <div className="flex-1 overflow-auto">
            {children}
        </div>
    </div>
}