import { api } from '@/api';
import Loader from '@/components/Loader';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { FormattedMessage } from 'react-intl';
import { Link } from 'react-router';

export default function Component() {
    const [data, setData] = useState<{ [key: string]: unknown }>();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api('admin/home', {
            loading: false,
        }).then((res) => {
            if (res.c !== 0) {
                return;
            }
            setLoading(false);
            setData(res.d);
        });
    }, []);

    return loading ? (
        <div className="w-full h-full flex justify-center items-center">
            <Loader />
        </div>
    ) : (
        <div>
            <div className="p-4 grid grid-cols-2 gap-4">
                <div className="col-span-full bg-emerald-100 border border-emerald-300 rounded-md p-4 text-slate-500">
                    <FormattedMessage
                        id="today_uploaded"
                        values={{
                            today: data!['today_uploaded'] as number,
                            total: data!['total_uploaded'] as number,
                        }}
                    />
                </div>
                <div className="bg-white rounded-md p-4 flex flex-col gap-2 border">
                    <div className="text-slate-500 text-sm">
                        <FormattedMessage id="uv_today" />
                    </div>
                    <div className="text-2xl text-blue-400">{data!['uv'] as number}</div>
                </div>
                {/* <div className="bg-white rounded-md p-4 flex flex-col gap-2 border">
                <div className="text-slate-500">
                    <FormattedMessage id="uv_weekly" />
                </div>
                <div className="text-3xl text-blue-400">{data!['uv_weekly'] as number}</div>
            </div> */}
                <div className="bg-white rounded-md p-4 flex flex-col gap-2 border">
                    <div className="text-slate-500 text-sm">
                        <FormattedMessage id="pv_today" />
                    </div>
                    <div className="text-2xl text-blue-400">{data!['pv'] as number}</div>
                </div>
                {/* <div className="bg-white rounded-md p-4 flex flex-col gap-2 border">
                <div className="text-slate-500">
                    <FormattedMessage id="pv_weekly" />
                </div>
                <div className="text-3xl text-pink-400">{data!['pv_weekly'] as number}</div>
            </div> */}
                <div className="bg-white rounded-md p-4 flex flex-col gap-2 border">
                    <div className="text-slate-500 text-sm">
                        <FormattedMessage id="unlock_today" />
                    </div>
                    <div className="text-2xl text-purple-400">{data!['unlock'] as number}</div>
                </div>
                {/* <div className="bg-white rounded-md p-4 flex flex-col gap-2 border">
                <div className="text-slate-500">
                    <FormattedMessage id="unlock_weekly" />
                </div>
                <div className="text-3xl text-red-400">{data!['unlock_weekly'] as number}</div>
            </div> */}
                <div className="bg-white rounded-md p-4 flex flex-col gap-2 border">
                    <div className="text-slate-500 text-sm">
                        <FormattedMessage id="play_today" />
                    </div>
                    <div className="text-2xl text-purple-400">{data!['play'] as number}</div>
                </div>
                {/* <div className="bg-white rounded-md p-4 flex flex-col gap-2 border">
                <div className="text-slate-500">
                    <FormattedMessage id="play_weekly" />
                </div>
                <div className="text-3xl text-purple-400">{data!['play_weekly'] as number}</div>
            </div> */}
                <div className="bg-white rounded-md p-4 flex flex-col gap-2 border">
                    <div className="text-slate-500 text-sm">
                        <FormattedMessage id="registered_user" />
                    </div>
                    <div className="text-2xl text-cyan-400">
                        {data!['registered_user'] as number}
                    </div>
                </div>
                <div className="bg-white rounded-md p-4 flex flex-col gap-2 border">
                    <div className="text-slate-500 text-sm">
                        <FormattedMessage id="unpaid_orders" />
                    </div>
                    <div className="text-2xl text-cyan-400">{data!['unpaid_order'] as number}</div>
                </div>
                <div className="bg-white rounded-md p-4 flex flex-col gap-2 border">
                    <div className="text-slate-500 text-sm">
                        <FormattedMessage id="paid_orders" />
                    </div>
                    <div className="text-2xl text-red-400">{data!['paid_order'] as number}</div>
                </div>
                <div className="bg-white rounded-md p-4 flex flex-col gap-2 border">
                    <div className="text-slate-500 text-sm">
                        <FormattedMessage id="subscription" />
                    </div>
                    <div className="text-2xl text-red-400">{data!['subscription'] as number}</div>
                </div>
                <div className="bg-white rounded-md p-4 flex flex-col gap-2 border">
                    <div className="text-slate-500 text-sm">
                        <FormattedMessage id="retention_time" />(<FormattedMessage id="hour" />)
                    </div>
                    <div className="text-2xl text-orange-400">
                        {parseFloat(data!['total_alive_time'] as string).toFixed(2)}
                    </div>
                </div>
                <div className="bg-white rounded-md p-4 flex flex-col gap-2 border">
                    <div className="text-slate-500 text-sm">
                        <FormattedMessage id="average_retention" />(<FormattedMessage id="minute" />)
                    </div>
                    <div className="text-2xl text-orange-400">
                        {parseFloat(data!['average_alive_time'] as string).toFixed(2)}
                    </div>
                </div>
            </div>
            <div className="p-4 pt-0">
                <div className="bg-white rounded-md p-4 border">
                    <div className="text-slate-500 text-sm mb-2">
                        <FormattedMessage id="play_ranking" />
                    </div>
                    <div className="flex flex-col gap-2">
                        {(data!['play_rank'] as []).length > 0 ? (
                            (data!['play_rank'] as []).map((v, k) => (
                                <div key={k} className="flex gap-2">
                                    <div
                                        className={cn(
                                            'font-bold',
                                            k === 0
                                                ? 'text-red-400'
                                                : k === 1
                                                ? 'text-amber-400'
                                                : k === 2
                                                ? 'text-purple-400'
                                                : '',
                                        )}
                                    >
                                        {k + 1}
                                    </div>
                                    <Link
                                        to={`/z/page/movie/detail/${v['target']}`}
                                        className="underline"
                                    >
                                        {v['title']}
                                    </Link>
                                </div>
                            ))
                        ) : (
                            <div>
                                <FormattedMessage id="no_more" />
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div className="p-4 pt-0">
                <div className="bg-white rounded-md p-4 border">
                    <div className="text-slate-500 text-sm mb-2">
                        <FormattedMessage id="retention_ranking" />(<FormattedMessage id="minute" />)
                    </div>
                    <div className="flex flex-col gap-2">
                        {(data!['alive_ranking'] as []).length > 0 ? (
                            (data!['alive_ranking'] as []).map((v, k) => (
                                <div key={k} className="flex gap-2">
                                    <div
                                        className={cn(
                                            'font-bold',
                                            k === 0
                                                ? 'text-red-400'
                                                : k === 1
                                                ? 'text-amber-400'
                                                : k === 2
                                                ? 'text-purple-400'
                                                : '',
                                        )}
                                    >
                                        {k + 1}
                                    </div>
                                    <Link
                                        to={`/z/page/user/${v['user_id']}`}
                                        className="underline flex justify-between flex-1"
                                    >
                                        <div>{v['user_id']}</div>
                                        <div>{parseFloat(v['time'] as string).toFixed(2)}</div>
                                    </Link>
                                </div>
                            ))
                        ) : (
                            <div>
                                <FormattedMessage id="no_more" />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
