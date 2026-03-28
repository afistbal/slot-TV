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
    return <div className="p-4">
        <div className="grid grid-cols-3 gap-4">
            {/* <Link to="/z/page/movie/detail" className="bg-emerald-400 text-sm text-white flex justify-center flex-col gap-1 items-center py-4 rounded-lg">
                <div><Video className="w-8 h-8" /></div>
                <div><FormattedMessage id="flix_add" /></div>
            </Link> */}
            <Link to="/z/page/movie" className="bg-red-400 text-sm text-white flex justify-center flex-col gap-1 items-center py-4 rounded-lg">
                <div><Videotape className="w-8 h-8" /></div>
                <div><FormattedMessage id="flix_list" /></div>
            </Link>
            {/* <Link to="/z/page/magnet" className="bg-slate-400 text-sm text-white flex justify-center flex-col gap-1 items-center py-4 rounded-lg">
                <div><Magnet className="w-8 h-8" /></div>
                <div><FormattedMessage id="magnet" /></div>
            </Link> */}
            <Link to="/z/page/user" className="bg-blue-400 text-sm text-white flex justify-center flex-col gap-1 items-center py-4 rounded-lg">
                <div><SquareUser className="w-8 h-8" /></div>
                <div><FormattedMessage id="users" /></div>
            </Link>
            {/* <Link to="/z/page/settings" className="bg-emerald-400 text-sm text-white flex justify-center flex-col gap-1 items-center py-4 rounded-lg">
                <div><Settings className="w-8 h-8" /></div>
                <div><FormattedMessage id="settings" /></div>
            </Link> */}
            <Link to="/z/page/analysis" className="bg-orange-400 text-sm text-white flex justify-center flex-col gap-1 items-center py-4 rounded-lg">
                <div><BarChart className="w-8 h-8" /></div>
                <div><FormattedMessage id="analysis" /></div>
            </Link>
            <Link to="/z/page/orders" className="bg-pink-400 text-sm text-white flex justify-center flex-col gap-1 items-center py-4 rounded-lg">
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