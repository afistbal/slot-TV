import { useState } from 'react';
import { Link } from 'react-router';
import { FormattedMessage, useIntl } from 'react-intl';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useRootStore } from '@/stores/root';
import { APP_LANGUAGES } from '@/constants/appLanguages';

function isLocaleActive(current: string, code: string): boolean {
    const c = current.toLowerCase();
    const p = code.toLowerCase();
    if (c === p) {
        return true;
    }
    if (p === 'zh') {
        return c === 'zh-tw' || c.startsWith('zh-hant') || (c.startsWith('zh-') && !c.startsWith('zh-hans') && !c.startsWith('zh-cn'));
    }
    return c.startsWith(`${p}-`) || c.startsWith(`${p}_`);
}

function AntDrawerCloseIcon({ className }: { className?: string }) {
    return (
        <svg
            fillRule="evenodd"
            viewBox="64 64 896 896"
            width="1em"
            height="1em"
            fill="currentColor"
            className={className}
            aria-hidden
        >
            <path d="M799.86 166.31c.02 0 .04.02.08.06l57.69 57.7c.04.03.05.05.06.08a.12.12 0 010 .06c0 .03-.02.05-.06.09L569.93 512l287.7 287.7c.04.04.05.06.06.09a.12.12 0 010 .07c0 .02-.02.04-.06.08l-57.7 57.69c-.03.04-.05.05-.07.06a.12.12 0 01-.07 0c-.03 0-.05-.02-.09-.06L512 569.93l-287.7 287.7c-.04.04-.06.05-.09.06a.12.12 0 01-.07 0c-.02 0-.04-.02-.08-.06l-57.69-57.7c-.04-.03-.05-.05-.06-.07a.12.12 0 010-.07c0-.03.02-.05.06-.09L454.07 512l-287.7-287.7c-.04-.04-.05-.06-.06-.09a.12.12 0 010-.07c0-.02.02-.04.06-.08l57.7-57.69c.03-.04.05-.05.07-.06a.12.12 0 01.07 0c.03 0 .05.02.09.06L512 454.07l287.7-287.7c.04-.04.06-.05.09-.06a.12.12 0 01.07 0z" />
        </svg>
    );
}

function ChevronDown({ className, open }: { className?: string; open: boolean }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 18 18"
            width="1em"
            height="1em"
            className={cn('text-white transition-transform duration-300', open && 'rotate-180', className)}
            aria-hidden
        >
            <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="m16 6-7 7-7-7"
            />
        </svg>
    );
}

export function ReelShortNavDrawer({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
}) {
    const intl = useIntl();
    const rootStore = useRootStore();
    const [langOpen, setLangOpen] = useState(false);

    function selectLocale(code: string) {
        if (rootStore.locale === code) {
            return;
        }
        localStorage.setItem('locale', code);
        window.location.reload();
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                hideCloseButton
                aria-describedby={undefined}
                className={cn(
                    'fixed left-0 top-0 z-50 flex h-full max-h-none w-full max-w-full translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 border-r border-white/10 bg-app-surface p-0 text-white shadow-xl',
                    'data-[state=closed]:slide-out-to-left-0 data-[state=open]:slide-in-from-left-0',
                    'data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100',
                    'max-w-none sm:max-w-none',
                )}
            >
                <div className="reelshort-nav-drawer__header">
                    <DialogClose
                        type="button"
                        aria-label={intl.formatMessage({ id: 'cancel' })}
                        className="reelshort-nav-drawer__close"
                    >
                        <AntDrawerCloseIcon />
                    </DialogClose>
                </div>

                <div className="reelshort-nav-drawer__scroll">
                    <div className="reelshort-nav-drawer__content">
                        <div>
                            <button
                                type="button"
                                className="flex w-full cursor-pointer select-none items-center justify-between transition-colors"
                                onClick={() => setLangOpen((v) => !v)}
                            >
                                <div className="py-[min(2.67vw,0.75rem)] pt-[min(1.6vw,0.4rem)] text-[min(5.33vw,1.25rem)] font-bold text-white">
                                    <FormattedMessage id="language" />
                                </div>
                                <div className="flex items-center">
                                    <ChevronDown open={langOpen} className="text-[min(4.8vw,1.125rem)]" />
                                </div>
                            </button>
                            <div
                                className={cn(
                                    'overflow-hidden transition-all duration-300 ease-in-out',
                                    langOpen ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0',
                                )}
                                aria-hidden={!langOpen}
                            >
                                <div className="flex flex-col pt-1">
                                    {APP_LANGUAGES.map((lang) => {
                                        const active = isLocaleActive(rootStore.locale, lang.code);
                                        return (
                                            <button
                                                key={lang.code}
                                                type="button"
                                                className="flex w-full cursor-pointer select-none items-center justify-between py-3 text-left text-[min(4.27vw,1rem)] font-bold tracking-normal transition-colors"
                                                onClick={() => selectLocale(lang.code)}
                                            >
                                                <span
                                                    className={cn(
                                                        active
                                                            ? 'text-[var(--rs-brand,#d4a853)]'
                                                            : 'text-white',
                                                    )}
                                                >
                                                    {lang.label}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div>
                            <Link
                                to="/my-list/history"
                                className="flex cursor-pointer select-none items-center justify-between py-[min(2.67vw,0.75rem)] pt-[min(1.6vw,0.4rem)] text-[min(5.33vw,1.25rem)] font-bold text-white transition-colors hover:text-white/90"
                                onClick={() => onOpenChange(false)}
                            >
                                <FormattedMessage id="nav_watch_history" />
                            </Link>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
