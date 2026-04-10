import { api } from '@/api';
import Image from '@/components/Image';
import NoContent from '@/components/NoContent';
import { Page } from '@/layouts/admin';
import { Check, HardDriveDownload, Loader2, Search } from 'lucide-react';
import { useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { toast } from 'sonner';

type TItem = { type: string, id: string, name: string, cover: string, status: number };

export default function Component() {
    const intl = useIntl();
    const [id, setId] = useState('');
    const [list, setList] = useState<TItem[]>();

    function handleIdChange(e: React.ChangeEvent<HTMLInputElement>) {
        setId(e.currentTarget.value);
    }

    function handleIdKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') {
            handleSubmit();
        }
    }

    function handleSubmit() {
        const keyword = id.trim();
        if (keyword === '') {
            toast.warning(intl.formatMessage({ id: 'form_input_keyword' }));
            return;
        }
        api<TItem[]>('admin/movie/magnet', {
            method: 'post',
            data: {
                keyword: id.trim(),
            },
        }).then(res => {
            if (res.c !== 0) {
                return;
            }
            setList(res.d);
        });
    }

    async function handleDownload(value: TItem) {
        const result = await api('admin/movie/download', {
            method: 'post',
            data: {
                name: value.type,
                id: value.id,
            },
        });

        if (result.c !== 0) {
            return;
        }
        toast.success(intl.formatMessage({ id: 'downloaded' }));
        setList([...list!.map(v => {
            if (v.id === value.id) {
                v.status = 2;
            }
            return v;
        })]);
    }

    return <Page title="magnet">
        <div className='h-full p-4'>
            <div className='flex flex-col gap-2'>
                <div className='text-sm text-muted-foreground'>
                    <FormattedMessage id="keyword" />
                </div>
                <div className='flex bg-slate-50 border border-slate-300 rounded-md overflow-hidden'>
                    <input value={id} type='text' onChange={handleIdChange} onKeyDown={handleIdKeyDown} className='focus:bg-slate-100 focus:border-[#94a3b8] w-full leading-4 px-3 h-12 m-0 outline-none text-md placeholder:leading-4 placeholder:text-md placeholder-gray-400' placeholder={intl.formatMessage({ id: 'magnet_placeholder' })} />
                    <button onClick={handleSubmit} className='border-l border-slate-300 w-16 text-slate-500 flex justify-center items-center'>
                        <Search />
                    </button>
                </div>
            </div>

            {list !== undefined && <div className='mt-4'>
                {list.length === 0 && <NoContent />}
                {list.length > 0 && <div className='flex flex-col gap-4'>
                    {list.map(v => <div key={v.id} className='flex gap-4 items-start relative bg-white p-4 rounded-md border'>
                        <div className='w-24 h-[calc(theme(spacing.24)*1.3325)] shrink-0'>
                            <Image src={v.cover} height={1.3325} alt={v.name} />
                        </div>
                        <div className='flex flex-col gap-2 justify-between flex-1'>
                            <div className='text-bold text-slate-500'>{v.type}</div>
                            <div className='text-slate-500 text-sm'>{v.id}</div>
                            <div className="wrap-anywhere">{v.name}</div>
                        </div>
                        {v.status === 0 && <button onClick={() => handleDownload(v)} className='w-10 h-10 absolute top-4 right-4 rounded-full bg-linear-to-tr from-cyan-200 to-emerald-300 flex justify-center items-center'>
                            <HardDriveDownload className='w-5 h-5' />
                        </button>}
                        {v.status === 1 && <div className='w-10 h-10 absolute top-4 right-4 rounded-full bg-linear-to-tr from-cyan-200 to-emerald-300 flex justify-center items-center'>
                            <Check className='w-5 h-5 text-slate-600' />
                        </div>}
                        {v.status === 2 && <div className='w-10 h-10 absolute top-4 right-4 rounded-full bg-linear-to-tr from-cyan-200 to-emerald-300 flex justify-center items-center'>
                            <Loader2 className='w-5 h-5 text-slate-600 animate-[spin_2s_linear_infinite]' />
                        </div>}
                    </div>)}
                </div>}
            </div>}
        </div>
    </Page>
}