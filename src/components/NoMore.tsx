import { FormattedMessage } from 'react-intl';
import { cn } from '@/lib/utils';

export default function NoMore({ className }: { className?: string }) {
    return <div className={cn('text-slate-400 text-center', className)}><FormattedMessage id="no_more" /></div>
}