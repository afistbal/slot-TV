import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { FormattedMessage, useIntl } from 'react-intl';
import { Bookmark, BriefcaseBusiness, CircleDollarSign, History, LogIn, LogOut, ShoppingBag, Sparkles, UserRound } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useRequireAccount } from '@/hooks/useRequireAccount';

const accountEntries = [
    { to: '/profile', label: 'profile_menu_account', Icon: UserRound },
    { to: '/my-list/history', label: 'profile_menu_history', Icon: History },
    { to: '/my-list', label: 'profile_h5_favorites', Icon: Bookmark },
];

const creatorEntries = [
    { to: '/creator?tab=dashboard', label: 'creator_dashboard_title', Icon: Sparkles },
    { to: '/creator', label: 'nav_join_creator', Icon: BriefcaseBusiness },
    { to: '/creator?tab=products', label: 'profile_menu_marketplace', Icon: ShoppingBag },
    { to: '/creator?tab=commissions', label: 'creator_dashboard_commissions', Icon: CircleDollarSign },
];

export function DesktopProfileMenu({ children, signed, onLogout }: {
    children: ReactNode;
    signed: boolean;
    onLogout: () => Promise<void>;
}) {
    const intl = useIntl();
    const location = useLocation();
    const requireAccount = useRequireAccount();
    const [open, setOpen] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const currentHref = location.pathname + location.search;

    function renderEntry({ to, label, Icon }: typeof accountEntries[number]) {
        const active = to.includes('?') ? currentHref === to : location.pathname === to && (to !== '/creator' || !location.search);
        return <DropdownMenuItem key={to} asChild className="reelshort-topnav__profile-menu-item">
            <Link to={to} aria-current={active ? 'page' : undefined} onClick={(event) => {
                if (to !== '/profile' && !requireAccount()) event.preventDefault();
                setOpen(false);
            }}><Icon aria-hidden /><span><FormattedMessage id={label} /></span></Link>
        </DropdownMenuItem>;
    }

    return <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
        <DropdownMenuTrigger asChild>
            <button type="button" className="reelshort-topnav__profile-link reelshort-topnav__profile-trigger" aria-label={intl.formatMessage({ id: 'profile_menu_account' })}>
                {children}
            </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="reelshort-topnav__profile-menu reelshort-topnav__profile-menu--list">
            <DropdownMenuGroup>
                {accountEntries.map(renderEntry)}
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="reelshort-topnav__profile-menu-separator" />
            <DropdownMenuGroup>{creatorEntries.map(renderEntry)}</DropdownMenuGroup>
            <DropdownMenuSeparator className="reelshort-topnav__profile-menu-separator" />
            <DropdownMenuItem disabled={loggingOut} className="reelshort-topnav__profile-menu-item reelshort-topnav__profile-menu-session" onSelect={() => {
                if (!signed) { requireAccount(); return; }
                setLoggingOut(true);
                void onLogout().finally(() => setLoggingOut(false));
            }}>
                {signed ? <LogOut aria-hidden /> : <LogIn aria-hidden />}<span><FormattedMessage id={signed ? 'logout' : 'login'} /></span>
            </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>;
}
