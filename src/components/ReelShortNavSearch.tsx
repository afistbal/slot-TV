import { useNavigate } from 'react-router';
import { FormattedMessage, useIntl } from 'react-intl';
import { cn } from '@/lib/utils';

function SearchIcon16({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="1em"
            height="1em"
            viewBox="0 0 16 16"
            fill="currentColor"
            className={cn('shrink-0 text-current', className)}
            aria-hidden
        >
            <path
                fill="currentColor"
                fillRule="evenodd"
                d="M6.5 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9M1 6.5a5.5 5.5 0 1 1 9.727 3.52l3.127 3.126-.708.708-3.126-3.127A5.5 5.5 0 0 1 1 6.5"
                clipRule="evenodd"
            />
        </svg>
    );
}

export function ReelShortNavSearch() {
    const intl = useIntl();
    const navigate = useNavigate();

    return (
        <button
            type="button"
            role="search-control"
            aria-label={intl.formatMessage({ id: 'flix_search' })}
            className={cn(
                'relative flex cursor-pointer flex-col items-center justify-center text-white',
                'hover:text-[var(--rs-brand,#d4a853)]',
            )}
            onClick={() => navigate('/search')}
        >
            <span role="img" className="text-[min(6vw,1.5rem)] text-current md:text-2xl">
                <SearchIcon16 className="h-[1em] w-[1em]" />
            </span>
            <div className="hidden text-base lg:block">
                <FormattedMessage id="nav_search_label" />
            </div>
        </button>
    );
}
