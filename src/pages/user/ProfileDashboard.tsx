import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { useIntl } from 'react-intl';
import { ChevronDown, ChevronRight, Coins, Crown, Gift, Globe2, Heart, HelpCircle, History, LockKeyhole, LogIn, LogOut, Plus, Search, Settings, Sparkles, Star, X } from 'lucide-react';
import { toast } from 'sonner';
import { TopUpPanel } from '@/components/TopUpDialog';
import { InviteCard } from '@/components/InviteCard';
import { ReelShortTopNav } from '@/components/ReelShortTopNav';
import { useUserStore } from '@/stores/user';
import { useLuckyStore } from '@/stores/lucky';
import { useTopUpStore } from '@/stores/topUp';
import { useConfigStore } from '@/stores/config';
import { useAuthPromptStore } from '@/stores/authPrompt';
import { useRequireAccount } from '@/hooks/useRequireAccount';
import { useMinWidth768 } from '@/hooks/useMinWidth768';
import { useProfileDashboardData } from '@/hooks/useProfileDashboardData';
import { getUserAvatarDisplayUrl } from '@/lib/userAvatar';
import { getUserUidForDisplay } from '@/lib/formatUserUniqueIdForDisplay';
import { logoutToAnonymousSession } from '@/lib/logoutToAnonymousSession';
import { movieCoverUrl } from '@/lib/movieCoverUrl';
import { APP_LANGUAGES } from '@/constants/appLanguages';
import { LanguageDialog } from '@/components/LanguageDialog';
import { submitLuckyRating } from '@/api/lucky';
import type { TData } from '@/api';
import { FORYOU_PATH } from '@/constants/foryouRoute';
import '@/styles/profile-dashboard.scss';

type LibraryTab = 'history' | 'unlocked' | 'favorites';
const libraryNames: Record<LibraryTab, [string, string]> = { history: ['观看历史', 'History'], unlocked: ['已解锁', 'Unlocked'], favorites: ['收藏', 'Favorites'] };

function Card({ children, className = '', id }: { children: ReactNode; className?: string; id?: string }) {
    return <section className={`me-card ${className}`} id={id}>{children}</section>;
}

function positiveNumber(value: unknown): number | null {
    if (typeof value !== 'number' && typeof value !== 'string') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function HistoryRating({ row }: { row: TData }) {
    const intl = useIntl();
    const zh = intl.locale.startsWith('zh');
    const [saved, setSaved] = useState<number>();
    const [busy, setBusy] = useState(false);
    const fromApi = positiveNumber(row.my_rating ?? row.myRating ?? row.rating ?? row.score);
    const score = saved ?? (fromApi && Number.isInteger(fromApi) && fromApi <= 5 ? fromApi : 0);
    const dramaId = String(row.movie_id ?? row.movieId ?? '').trim();
    if (!dramaId) return null;
    async function rate(value: number) {
        if (busy || score > 0) return;
        setBusy(true);
        try {
            await submitLuckyRating(dramaId, value);
            setSaved(value);
            toast.success(zh ? '评分成功' : 'Rating submitted');
        } catch (reason) { toast.error(reason instanceof Error ? reason.message : String(reason)); }
        finally { setBusy(false); }
    }
    return <div className="me-library-rating" aria-label={zh ? '评分' : 'Rating'}><span>{zh ? '评分' : 'Rating'}</span>{[1, 2, 3, 4, 5].map(value => <button key={value} type="button" aria-label={zh ? `${value} 星` : `${value} stars`} disabled={busy || score > 0} onClick={() => void rate(value)}><Star size={14} fill={score >= value ? 'currentColor' : 'none'} className={score >= value ? 'me-gold' : ''} /></button>)}</div>;
}

export default function ProfileDashboard() {
    const intl = useIntl();
    const zh = intl.locale.startsWith('zh');
    const text = (cn: string, en: string) => zh ? cn : en;
    const user = useUserStore();
    const isPc = useMinWidth768();
    const badge = useLuckyStore(state => state.badge) ?? 0;
    const luckyRevision = useLuckyStore(state => state.revision);
    const data = useProfileDashboardData(luckyRevision);
    const requireAccount = useRequireAccount();
    const requestLogin = useAuthPromptStore(state => state.requestLogin);
    const staticBase = useConfigStore(state => state.config.static as string | undefined);
    const [params, setParams] = useSearchParams();
    const location = useLocation();
    const [languageOpen, setLanguageOpen] = useState(Boolean((location.state as { openLanguage?: boolean } | null)?.openLanguage));
    const navigate = useNavigate();
    const scrollRef = useRef<HTMLDivElement>(null);
    const libraryRef = useRef<HTMLDivElement>(null);
    const coinlogRef = useRef<HTMLDivElement>(null);
    const [libraryTab, setLibraryTab] = useState<LibraryTab>('history');
    const [query, setQuery] = useState('');
    const [showAllLogs, setShowAllLogs] = useState(false);
    const signed = user.signed && !user.isAnonymous();
    const name = signed ? String(user.info?.name || user.info?.nickname || user.info?.username || user.info?.email || text('用户', 'User')) : text('游客', 'Guest');
    const uid = getUserUidForDisplay(user.info);
    const photo = signed ? getUserAvatarDisplayUrl(user.info) : undefined;
    const balance = user.signed ? Math.max(0, user.balance) : 0;
    const num = (value: unknown) => intl.formatNumber(Number.isFinite(Number(value)) ? Number(value) : 0);
    const topUp = () => useTopUpStore.getState().show();
    const history = data.history;
    const unlocked = data.logs.filter(row => row.change < 0 && row.movie_id);
    const title = (row: TData) => String(row.title ?? row.movie_name ?? row.movie_title ?? '');
    const movieId = (row: TData) => String(row.movie_id ?? row.id ?? '');
    const episode = (row: TData) => positiveNumber(row.current_episode ?? row.currentEpisode ?? row.episode ?? row.ep ?? row.last_episode);
    const poster = (row: TData) => movieCoverUrl(row, staticBase) ?? undefined;
    const libraryRows = (libraryTab === 'favorites' ? data.favorites : libraryTab === 'unlocked' ? [] : history)
        .filter(row => title(row).toLowerCase().includes(query.toLowerCase()));

    useEffect(() => {
        if (params.get('tab') === 'topup') {
            useTopUpStore.getState().show();
            setParams(previous => { const next = new URLSearchParams(previous); next.delete('tab'); return next; }, { replace: true });
        }
        if (params.get('login') === '1') {
            requestLogin();
            setParams(previous => { const next = new URLSearchParams(previous); next.delete('login'); return next; }, { replace: true });
        }
    }, [params, setParams, requestLogin]);

    useEffect(() => {
        if (!(location.state as { openLanguage?: boolean } | null)?.openLanguage) return;
        setLanguageOpen(true);
        const state = { ...location.state };
        delete state.openLanguage;
        navigate({ pathname: location.pathname, search: location.search, hash: location.hash }, { replace: true, state });
    }, [location.state, location.pathname, location.search, location.hash, navigate]);

    useEffect(() => {
        if (!(location.state as { openPcLogin?: boolean } | null)?.openPcLogin) return;
        requestLogin();
        navigate({ pathname: location.pathname, search: location.search, hash: location.hash }, { replace: true, state: {} });
    }, [location.state, location.pathname, location.search, location.hash, navigate, requestLogin]);

    function showLibrary(tab: LibraryTab) {
        setLibraryTab(tab);
        libraryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    const quickEntries = [
        { name: text('福利', 'Rewards'), Icon: Gift, to: '/lucky', tone: 'gold', count: badge },
        { name: text('推广赚现金', 'Affiliate'), Icon: Coins, to: '/affiliate', tone: 'green' },
        { name: text('创作者中心', 'Creator'), Icon: Sparkles, to: '/creator' },
        { name: intl.formatMessage({ id: 'feedback_help' }), Icon: HelpCircle, to: '/page/feedback' },
    ];

    return <div className="me-page-shell">
        <div className="me-page-scroll" ref={scrollRef}>
            <ReelShortTopNav scrollParentRef={scrollRef} showPrimaryNav={isPc} showSearch showProfile />
            <main className="me-page" aria-label={text('个人中心', 'My account')}>
                <h1 className="sr-only">{text('我的', 'My account')}</h1>
                <div className="me-dashboard">
                    <aside className="me-dashboard__account">
                        <Card className="me-dashboard__wide">
                            <div className="me-user">
                                <Link to="/user/detail" onClick={event => { if (!requireAccount()) event.preventDefault(); }} className="me-user__avatar" aria-label={text('个人资料', 'Profile')}>
                                    {photo ? <img src={photo} alt="" referrerPolicy="no-referrer" onError={() => user.update({ avatar: '' })} /> : <span>{name.slice(0, 1).toUpperCase()}</span>}
                                </Link>
                                <div className="me-user__info"><strong>{name}</strong><div><span>UID: {uid || '0'}</span></div></div>
                            </div>
                            <div className="me-user__actions">
                                <Link to="/user/detail" onClick={event => { if (!requireAccount()) event.preventDefault(); }}><Settings size={15} /><span>{text('设置', 'Settings')}</span></Link>
                                <button type="button" onClick={() => setLanguageOpen(true)} aria-haspopup="dialog"><Globe2 size={15} /><span>{APP_LANGUAGES.find(language => language.code === intl.locale)?.label ?? 'Language'}</span></button>
                                <button type="button" onClick={() => { if (signed) void logoutToAnonymousSession(); else requestLogin(); }}>{signed ? <LogOut size={15} /> : <LogIn size={15} />}<span>{signed ? text('退出登录', 'Log out') : text('登录', 'Log in')}</span></button>
                            </div>
                        </Card>
                        <Card>
                            <div className="me-between"><div><h2 className="me-muted-title">{text('我的金币', 'My coins')}</h2><div className="me-balance"><Coins size={22} />{num(balance)}</div></div><button type="button" className="me-btn" onClick={topUp}><Plus size={16} />{text('充值金币', 'Top up')}</button></div>
                            <div className="me-assets">
                                <button type="button" onClick={() => showLibrary('unlocked')}><span>{text('已解锁', 'Unlocked')}<strong>{num(unlocked.length)} {text('集 · ', 'episodes · ')}{num(new Set(unlocked.map(row => row.movie_id)).size)} {text('部', 'dramas')}</strong></span><ChevronRight size={14} /></button>
                                <button type="button" onClick={() => coinlogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><span>{text('金币明细', 'Coin history')}<strong className="me-green">{data.logs[0]?.change > 0 ? '+' : ''}{num(data.logs[0]?.change)}</strong></span><ChevronRight size={14} /></button>
                            </div>
                        </Card>
                        <InviteCard className="me-dashboard__wide" />
                        <Card className="me-vip">
                            <span className="me-vip__crown"><Crown size={22} /></span><div><h2>{user.isVIP() ? text('VIP 会员', 'VIP member') : text('升级会员，畅享更多', 'Enjoy more with VIP')}</h2><p className="me-subtle">{text('专属会员权益', 'Exclusive member benefits')}</p></div><button type="button" className="me-btn me-btn--gold" onClick={() => useTopUpStore.getState().show('vip')}>{text('查看', 'View')}</button>
                        </Card>
                        <nav className="me-quick me-dashboard__wide" aria-label={text('快捷入口', 'Quick links')}>
                            {quickEntries.map(({ name: entryName, Icon, to, tone, count }) => {
                                const content = <><span className={`me-quick__icon ${tone ? `me-quick__icon--${tone}` : ''}`}><Icon size={20} />{count !== undefined && count > 0 ? <b className="me-quick__badge">{num(count)}</b> : null}</span><span>{entryName}</span></>;
                                return <Link key={entryName} to={to} onClick={event => { if (to === '/creator' && !requireAccount()) event.preventDefault(); }}>{content}</Link>;
                            })}
                        </nav>
                    </aside>
                    <div className="me-dashboard__activity">
                        <TopUpPanel embedded />
                        <div className="me-dashboard__wide" ref={libraryRef} id="library">
                            <Card><div className="me-between"><h2>{text('我的片库', 'My library')}</h2><span className="me-subtle">{num(history.length + data.favorites.length)}{text(' 部', ' dramas')}</span></div>
                                <div className="me-library-tabs" role="tablist" aria-label={text('我的片库', 'My library')}>{(Object.keys(libraryNames) as LibraryTab[]).map(tab => <button key={tab} type="button" role="tab" id={`me-library-${tab}`} aria-controls="me-library-panel" aria-selected={libraryTab === tab} onClick={() => { setLibraryTab(tab); setQuery(''); }}>{text(...libraryNames[tab])}<small>{num(tab === 'history' ? history.length : tab === 'unlocked' ? unlocked.length : data.favorites.length)}</small></button>)}</div>
                                <div id="me-library-panel" role="tabpanel" aria-labelledby={`me-library-${libraryTab}`}>
                                    <label className="me-search"><Search size={15} /><input aria-label={text('搜索片库', 'Search library')} placeholder={text('搜索剧名', 'Search dramas')} value={query} onChange={event => setQuery(event.target.value)} />{query ? <button type="button" aria-label={text('清空', 'Clear')} onClick={() => setQuery('')}><X size={14} /></button> : null}</label>
                                    {libraryRows.length ? <div className={`me-library-list ${libraryTab === 'favorites' ? 'me-library-list--posters' : ''}`}>{libraryRows.slice(0, 12).map((row, index) => <div className="me-library-item" key={String(row.id ?? index)}><Link to={`/drama/${movieId(row)}`}><img src={poster(row)} alt="" /></Link><div className="me-library-item__info"><Link to={`/drama/${movieId(row)}`}><strong>{title(row)}</strong></Link>{episode(row) !== null ? <small>{text('第 ', 'Episode ')}{num(episode(row))}{text(' 集', '')}</small> : null}{libraryTab === 'history' ? <HistoryRating row={row} /> : positiveNumber(row.rating ?? row.score) !== null ? <small>{text('评分 ', 'Rating ')}{num(row.rating ?? row.score)}</small> : null}</div><Link to={`/drama/${movieId(row)}`} aria-label={title(row)}><ChevronRight size={14} /></Link></div>)}</div> : libraryTab === 'unlocked' && unlocked.length ? <div className="me-library-list">{unlocked.slice(0, 12).map((row, index) => <Link key={index} className="me-library-item" to={`/drama/${row.movie_id}`}><LockKeyhole size={18} /><span><strong>{row.movie_name ?? row.movie_title ?? text('已解锁剧集', 'Unlocked episode')}</strong>{positiveNumber(row.episode_index) !== null ? <small>{text('第 ', 'Episode ')}{num(row.episode_index)}{text(' 集', '')}</small> : null}</span><ChevronRight size={14} /></Link>)}</div> : <div className="me-empty"><span>{libraryTab === 'favorites' ? <Heart size={20} /> : libraryTab === 'unlocked' ? <LockKeyhole size={20} /> : <History size={20} />}</span><strong>{text('暂无内容', 'No content yet')}</strong><p>{text('喜欢的好剧，都会留在这里', 'Your dramas will appear here')}</p><Link className="me-btn" to={FORYOU_PATH}>{text('发现好剧', 'Discover dramas')}</Link></div>}
                                </div>
                            </Card>
                        </div>
                        <div className="me-dashboard__wide" ref={coinlogRef} id="coinlog"><Card><div className="me-between"><h2><Coins size={15} className="me-gold" />{text('金币明细', 'Coin history')}</h2><span className="me-subtle">{num(data.logs.length)}{text(' 条', ' entries')}</span></div>
                            {data.logs.length ? <><div className="me-coinlogs">{data.logs.slice(0, showAllLogs ? undefined : 5).map((row, index) => <div key={index}><span className={`me-coinlogs__icon ${row.change > 0 ? 'me-green' : 'me-gold'}`}>{row.change > 0 ? <Plus size={14} /> : <LockKeyhole size={14} />}</span><span><strong>{row.movie_name ?? row.movie_title ?? text(row.change > 0 ? '金币收入' : '解锁剧集', row.change > 0 ? 'Coins received' : 'Episode unlocked')}</strong><small>{row.created_at ? intl.formatDate(new Date(row.created_at.replace(' ', 'T')), { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '0'}</small></span><b className={row.change > 0 ? 'me-green' : 'me-gold'}>{row.change > 0 ? '+' : ''}{num(row.change)}</b></div>)}</div>{data.logs.length > 5 ? <button type="button" className="me-disclosure" onClick={() => setShowAllLogs(value => !value)}>{showAllLogs ? text('收起', 'Show less') : text('查看更多', 'View more')}<ChevronDown size={14} /></button> : null}</> : <div className="me-empty me-empty--small"><span><Coins size={20} /></span><strong>{text('暂无金币记录', 'No coin activity yet')}</strong><p>{text('签到、充值或解锁剧集后会显示在这里', 'Check-ins, top-ups and unlocks appear here')}</p></div>}
                        </Card></div>
                    </div>
                </div>
            </main>
        </div>
        <LanguageDialog open={isPc && languageOpen} onOpenChange={setLanguageOpen} />
    </div>;
}
