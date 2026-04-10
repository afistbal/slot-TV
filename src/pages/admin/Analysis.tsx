import { api } from '@/api';
import Loader from '@/components/Loader';
import { Page } from '@/layouts/admin';
import { useEffect, useState } from 'react';
import { FormattedMessage } from 'react-intl';

interface IData {
    source_all: {
        source: string,
        count: number,
    }[],
    source_week: {
        source: string,
        count: number,
    }[],
    source_today: {
        source: string,
        count: number,
    }[],
}

export default function Component() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<IData>();

    function loadData() {
        api<IData>('admin/analysis', {
            loading: false,
        }).then(res => {
            setData(res.d);
            setLoading(false);
        });
    }

    useEffect(() => {
        loadData();
    }, []);

    return <Page title="analysis">
        {loading ? <Loader /> : <div className='p-4 flex flex-col gap-4'>
            <div className='bg-white p-4 rounded-md border'>
                <div className='font-bold text-slate-500'>
                    <FormattedMessage id="today" />
                </div>
                <div className='flex flex-col gap-4 mt-4'>
                    {data!.source_today.length > 0 ? data?.source_today.map((v, k) => {
                        const total = data?.source_today.reduce((a, b) => a + b.count, 0);
                        const percent = ((v.count / total) * 100).toFixed(2);
                        return <div key={k} className='bg-[#94a3b8] text-white rounded-sm relative overflow-hidden'>
                            <div className='bg-amber-400 absolute h-full left-0 top-0' style={{ width: percent + '%' }} />
                            <div className='flex justify-between items-center relative px-4 py-2'>
                                <div className='flex gap-4'>
                                    <div>{v.count}</div>
                                    <div className='font-bold'>{v.source}</div>
                                </div>
                                <div className='text-sm'>{percent}%</div>
                            </div>
                        </div>;
                    }) : <div className='text-slate-500'>
                        <FormattedMessage id="no_more" />
                    </div>}
                </div>
            </div>
            <div className='bg-white p-4 rounded-md border'>
                <div className='font-bold text-slate-500'>
                    <FormattedMessage id="week" />
                </div>
                <div className='flex flex-col gap-4 mt-4'>
                    {data!.source_week.length > 0 ? data?.source_week.map((v, k) => {
                        const total = data?.source_week.reduce((a, b) => a + b.count, 0);
                        const percent = ((v.count / total) * 100).toFixed(2);
                        return <div key={k} className='bg-[#94a3b8] text-white rounded-sm relative overflow-hidden'>
                            <div className='bg-emerald-400 absolute h-full left-0 top-0' style={{ width: percent + '%' }} />
                            <div className='flex justify-between items-center relative px-4 py-2'>
                                <div className='flex gap-4'>
                                    <div>{v.count}</div>
                                    <div className='font-bold'>{v.source}</div>
                                </div>
                                <div className='text-sm'>{percent}%</div>
                            </div>
                        </div>;
                    }) : <div className='text-slate-500'>
                        <FormattedMessage id="no_more" />
                    </div>}
                </div>
            </div>
            <div className='bg-white p-4 rounded-md border'>
                <div className='font-bold text-slate-500'>
                    <FormattedMessage id="all" />
                </div>
                <div className='flex flex-col gap-4 mt-4'>
                    {data!.source_all.length > 0 ? data?.source_all.map((v, k) => {
                        const total = data?.source_all.reduce((a, b) => a + b.count, 0);
                        const percent = ((v.count / total) * 100).toFixed(2);
                        return <div key={k} className='bg-[#94a3b8] text-white rounded-sm relative overflow-hidden'>
                            <div className='bg-indigo-400 absolute h-full left-0 top-0' style={{ width: percent + '%' }} />
                            <div className='flex justify-between items-center relative px-4 py-2'>
                                <div className='flex gap-4'>
                                    <div>{v.count}</div>
                                    <div className='font-bold'>{v.source}</div>
                                </div>
                                <div className='text-sm'>{percent}%</div>
                            </div>
                        </div>;
                    }) : <div className='text-slate-500'>
                        <FormattedMessage id="no_more" />
                    </div>}
                </div>
            </div>
        </div>}
    </Page>
}