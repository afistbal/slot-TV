import { NavLink, Outlet, useLocation } from "react-router";
import { FormattedMessage } from "react-intl";
import { Suspense } from "react";
import Loader from "@/components/Loader";

export default function Component() {
    const location = useLocation();

    return <div className="flex flex-col h-full">
        <div className="flex items-center h-16 px-4 gap-4 bg-white text-slate-500 text-xl border-b border-slate-200">
            <NavLink to="/my-list" end>
                <FormattedMessage id="favorite" />
            </NavLink>
            <NavLink to="/my-list/history" end>
                <FormattedMessage id="history" />
            </NavLink>
        </div>
        <div className="flex-1 overflow-y-auto">
            <Suspense key={location.key} fallback={<Loader />}>
                <Outlet key={location.key} />
            </Suspense>
        </div>
    </div >
}

