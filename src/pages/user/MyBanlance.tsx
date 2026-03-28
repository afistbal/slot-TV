import { api } from "@/api";
import Loader from "@/components/Loader";
import NoContent from "@/components/NoContent";
import NoMore from "@/components/NoMore";
import { Page } from "@/layouts/user";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { FormattedDate, FormattedMessage } from "react-intl";
import coinIcon from '@/assets/coin.svg';
import { Link } from "react-router";

interface IBalance {
    type: number,
    change: number,
    amount: string,
    target: number,
    created_at: string,
    movie_id?: number,
    episode_index?: number,
}

export default function Component() {
    const [balance, setBalance] = useState<IBalance[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api<IBalance[]>('user/balance/history', {
            loading: false,
        }).then(res => {
            setLoading(false);
            setBalance(res.d);
        });
    }, []);

    return <Page title="my_balance">
        {loading ? <Loader /> : balance.length === 0 ? <NoContent className="h-full" /> : <div className="p-4">
            {balance.map((v, k) => <div key={k} className="flex p-4 bg-white items-center first:rounded-t-md last:rounded-b-md border-b border-slate-100 last:border-none">
                <div className="flex-1">
                    <div className="text-slate-600 text-lg flex gap-2 items-center">
                        <FormattedMessage id={v.type === 1 ? 'top_up' : 'unlock_episodes'} />
                        {v.movie_id && <Link to={`/video/${v.movie_id}/${v.episode_index}?auto_play=0`} className="text-sm text-indigo-400">
                            [<FormattedMessage id="view" />]
                        </Link>}
                    </div>
                    <div className="text-slate-400 text-sm">
                        <FormattedDate
                            year="numeric"
                            month="2-digit"
                            day="2-digit"
                            hour="2-digit"
                            minute="2-digit"
                            second="2-digit"
                            value={v.created_at}
                        />
                    </div>
                </div>
                <div className="shrink-0 text-right">
                    <div className={cn('font-bold text-lg', v.change > 0 ? 'text-green-400' : 'text-red-400')}>{v.change > 0 ? '+' : ''}{v.change}</div>
                    <div className="text-slate-400 text-sm flex gap-0.5">
                        <img src={coinIcon} width={20} height={20} />
                        {v.amount}
                    </div>
                </div>
            </div>)}
            <NoMore className="p-4" />
        </div>}
    </Page>
}