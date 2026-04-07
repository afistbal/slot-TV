import { useEffect, useRef, useState } from 'react';
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
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) {
            return;
        }
        function onDoc(e: MouseEvent) {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);

    function submit() {
        const q = query.trim();
        setOpen(false);
        if (q) {
            navigate(`/page/search?q=${encodeURIComponent(q)}`);
        } else {
            navigate('/page/search');
        }
    }

    return (
        <div
            ref={rootRef}
            role="search-container"
            className="group relative flex h-full select-none items-center"
            data-query={query ? 'true' : 'false'}
        >
            <button
                type="button"
                role="search-control"
                aria-expanded={open}
                aria-label={intl.formatMessage({ id: 'flix_search' })}
                className={cn(
                    'relative flex cursor-pointer flex-col items-center justify-center text-white',
                    'hover:text-[var(--rs-brand,#d4a853)]',
                )}
                onClick={() => setOpen((o) => !o)}
            >
                <span role="img" className="text-[min(6vw,1.5rem)] text-current md:text-2xl">
                    <SearchIcon16 className="h-[1em] w-[1em]" />
                </span>
                <div className="hidden text-base lg:block">
                    <FormattedMessage id="nav_search_label" />
                </div>
            </button>

            {open ? (
                <div
                    role="search-panel"
                    className={cn(
                        'fixed right-0 top-[min(11rem,22vw)] z-[40] w-full max-w-[100vw] text-white',
                        'md:absolute md:right-0 md:top-[15px] md:w-[min(480px,92vw)]',
                        !query && 'md:left-1/2 md:right-auto md:max-w-[680px] md:-translate-x-1/2',
                    )}
                >
                    <div
                        role="search-bar"
                        className={cn(
                            'relative z-10 flex items-center overflow-hidden bg-black px-[min(4.27vw,1rem)] py-[min(1.6vw,0.5rem)]',
                            'md:rounded-md md:bg-black/60 md:px-0 md:py-0 md:backdrop-blur-md',
                        )}
                    >
                        <div
                            className={cn(
                                'flex h-[min(11.2vw,2.625rem)] w-full items-center rounded-[min(2.13vw,8px)] border border-solid border-white/50 bg-white/10 px-[min(3.2vw,0.75rem)]',
                                'md:h-[42px] md:rounded-md',
                                !query && 'md:h-[60px] md:rounded-xl',
                            )}
                        >
                            <SearchIcon16
                                className={cn(
                                    'h-[min(6.4vw,1.5rem)] w-[min(6.4vw,1.5rem)] text-white md:h-6 md:w-6 md:opacity-50',
                                )}
                            />
                            <input
                                type="search"
                                maxLength={100}
                                value={query}
                                placeholder={intl.formatMessage({ id: 'nav_search_placeholder' })}
                                className={cn(
                                    'w-full border-0 bg-transparent px-[min(2.13vw,0.5rem)] text-[min(4.27vw,1rem)] text-white placeholder:text-white/50 focus:outline-none',
                                    'md:px-2 md:text-base',
                                    !query && 'md:text-xl',
                                )}
                                autoFocus
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        submit();
                                    }
                                    if (e.key === 'Escape') {
                                        setOpen(false);
                                    }
                                }}
                            />
                            <div className="flex w-[30px] shrink-0 justify-end" />
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
