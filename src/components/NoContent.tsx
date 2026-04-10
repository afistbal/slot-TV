import { FormattedMessage } from 'react-intl';
import empty from '@/assets/images/empty.webp';
import { cn } from '@/lib/utils';

export default function NoContent({ className }: { className?: string }) {
    return <div className={cn('flex justify-center items-center flex-col gap-0 flex-1', className)}>
        <img src={empty} className='w-40 h-40' />
        <div className='text-slate-400'><FormattedMessage id="no_content" /></div>
    </div>
}