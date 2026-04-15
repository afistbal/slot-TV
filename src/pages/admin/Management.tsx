import { Videotape, SquareUser, BarChart, CircleDollarSign } from "lucide-react";
import { FormattedMessage } from "react-intl";
import { Link } from "react-router";

export default function Component() {
    // const loadingStore = useLoadingStore();

    // async function handleWatchAd() {
    //     loadingStore.show();
    //     try {
    //         /* @ts-ignore */
    //         let result = await window.flutter_inappwebview.callHandler('showAd');
    //         console.log(result);
    //     } finally {
    //         loadingStore.hide();
    //     }
    // }
    return <div className="p-4 bg-black min-h-full">
        <div className="grid grid-cols-3 gap-4">
            {/* <Link to="/z/page/movie/detail" className="bg-emerald-400 text-sm text-white flex justify-center flex-col gap-1 items-center py-4 rounded-lg">
                <div><Video className="w-8 h-8" /></div>
                <div><FormattedMessage id="flix_add" /></div>
            </Link> */}
            <Link to="/z/page/movie" className="border border-slate-800 bg-slate-900 text-sm text-slate-100 flex justify-center flex-col gap-1 items-center py-4 rounded-lg shadow-[0_0_0_1px_rgba(15,23,42,0.3)] transition-colors hover:bg-slate-800">
                <div><Videotape className="w-8 h-8" /></div>
                <div><FormattedMessage id="flix_list" /></div>
            </Link>
            {/* <Link to="/z/page/magnet" className="bg-slate-400 text-sm text-white flex justify-center flex-col gap-1 items-center py-4 rounded-lg">
                <div><Magnet className="w-8 h-8" /></div>
                <div><FormattedMessage id="magnet" /></div>
            </Link> */}
            <Link to="/z/page/user" className="border border-slate-800 bg-slate-900 text-sm text-slate-100 flex justify-center flex-col gap-1 items-center py-4 rounded-lg shadow-[0_0_0_1px_rgba(15,23,42,0.3)] transition-colors hover:bg-slate-800">
                <div><SquareUser className="w-8 h-8" /></div>
                <div><FormattedMessage id="users" /></div>
            </Link>
            {/* <Link to="/z/page/settings" className="bg-emerald-400 text-sm text-white flex justify-center flex-col gap-1 items-center py-4 rounded-lg">
                <div><Settings className="w-8 h-8" /></div>
                <div><FormattedMessage id="settings" /></div>
            </Link> */}
            <Link to="/z/page/analysis" className="border border-slate-800 bg-slate-900 text-sm text-slate-100 flex justify-center flex-col gap-1 items-center py-4 rounded-lg shadow-[0_0_0_1px_rgba(15,23,42,0.3)] transition-colors hover:bg-slate-800">
                <div><BarChart className="w-8 h-8" /></div>
                <div><FormattedMessage id="analysis" /></div>
            </Link>
            <Link to="/z/page/orders" className="border border-slate-700 bg-slate-800 text-sm text-amber-200 flex justify-center flex-col gap-1 items-center py-4 rounded-lg shadow-[0_0_0_1px_rgba(15,23,42,0.3)] transition-colors hover:bg-slate-700">
                <div><CircleDollarSign className="w-8 h-8" /></div>
                <div><FormattedMessage id="order" /></div>
            </Link>
            {/* <div className="bg-purple-400 text-sm text-white flex justify-center flex-col gap-1 items-center py-4 rounded-lg" onClick={handleWatchAd}>
                <div><TvMinimalPlay className="w-8 h-8" /></div>
                <div><FormattedMessage id="watch_ad" /></div>
            </div> */}
        </div>
    </div>
}