import { api, type TData } from '@/api';
import Loader from '@/components/Loader';
import NoContent from '@/components/NoContent';
import { Page } from '@/layouts/admin';
import { useEffect, useState } from 'react';
import { FormattedMessage } from 'react-intl';
import { Link, useParams } from 'react-router';

const ACTIVITY_TYPE: { [key: string]: string } = {
    alive: '留存',
    deny: '拒绝访问',
    deny_source: '拒绝的来源',
    list_product: '列出产品',
    load_duration: '加载时间',
    load_duration_page: '页面加载时间',
    login: '登录',
    order_active: '订单已激活',
    order_complete: '订单处理完毕',
    pay_product: '付款产品',
    play: '播放',
    play_episode: '播放剧集',
    share: '分享页',
    source: '来源',
    subscription_active: '订阅已激活',
    subscription_cancelled: '订阅已取消',
};

interface IData {
    count: number;
    data: TData[];
}

export default function Component() {
    const params = useParams();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<IData>({
        count: 0,
        data: [],
    });

    useEffect(() => {
        api<IData>('admin/user/stat', {
            data: {
                id: params['id'],
            },
            loading: false,
        }).then((res) => {
            if (res.c !== 0) {
                return;
            }
            setLoading(false);
            setData(res.d);
        });
    }, []);

    return (
        <Page title="activity_log">
            {loading ? (
                <div className="h-full w-full flex justify-center items-center">
                    <Loader />
                </div>
            ) : (
                <div className="flex flex-col h-full overflow-auto">
                    <div className="flex items-center justify-between px-4 pt-4 shrink-0">
                        <div className="shrink-0 text-slate-500">
                            <FormattedMessage
                                id="record_count"
                                values={{ total: data.count || '...' }}
                            />
                        </div>
                    </div>
                    {data.data.length === 0 ? (
                        <NoContent />
                    ) : (
                        <div className="flex flex-col m-4 rounded-md gap-4">
                            {data.data.map((v) => {
                                const action = v['action'] as string;
                                const actionType = ACTIVITY_TYPE[action.toLowerCase()];

                                return (
                                    <div
                                        key={v['id'] as number}
                                        className="flex flex-col bg-white border rounded-md overflow-hidden text-sm"
                                    >
                                        <div className="flex justify-between text-slate-500 bg-slate-100 px-4 py-3 border-b">
                                            <div>{actionType || action.toUpperCase()}</div>
                                            <div>{v['created_at'] as string}</div>
                                        </div>
                                        <div className="flex flex-col gap-2 p-4">
                                            <div className="flex gap-2 justify-between">
                                                <div className="text-slate-500">
                                                    <FormattedMessage id="target" />
                                                </div>
                                                {v['action'] === 'play' ? (
                                                    <Link
                                                        className="text-indigo-400"
                                                        to={`/z/page/movie/detail/${v['target']}`}
                                                    >
                                                        {v['target'] as string}
                                                    </Link>
                                                ) : v['action'] === 'play_episode' ? (
                                                    <Link
                                                        className="text-indigo-400"
                                                        to={`/z/page/movie/detail/${v['movie_id']}`}
                                                    >{v['episode_desc'] as string}</Link>
                                                ) : (
                                                    <div>
                                                        {v['target'] === 0
                                                            ? ''
                                                            : (v.target as string)}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex gap-2 justify-between">
                                                <div className="text-slate-500">
                                                    <FormattedMessage id="source" />
                                                </div>
                                                <div>{v['source'] as string}</div>
                                            </div>
                                            <div className="flex gap-2 justify-between">
                                                <div className="text-slate-500">
                                                    <FormattedMessage id="ip" />
                                                </div>
                                                <div>{v['ip'] as string}</div>
                                            </div>
                                            <div className="flex gap-2 justify-between">
                                                <div className="text-slate-500">
                                                    <FormattedMessage id="country" />
                                                </div>
                                                <div>{v['country'] as string}</div>
                                            </div>
                                            <div className="flex gap-2 justify-between">
                                                <div className="text-slate-500">
                                                    <FormattedMessage id="remark" />
                                                </div>
                                                <div>{v['remark'] as string}</div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </Page>
    );
}
