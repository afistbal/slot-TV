import { Flame, Heart, MessageCircle, Sparkles, Target, TrendingUp } from 'lucide-react';
import { useIntl } from 'react-intl';

const prompts = [
    ['被看不起，最后逆袭打脸的', '被看不起，最後逆襲打臉的', '逆袭', ['逆袭', 'revenge', 'rebirth']],
    ['下班想看点甜的', '下班想看點甜的', '甜宠', ['甜宠', 'romance', 'love']],
    ['办公室里的禁忌恋', '辦公室裡的禁忌戀', '禁忌恋', ['禁忌', 'forbidden', 'office']],
    ['豪门里的复仇', '豪門裡的復仇', '复仇', ['复仇', 'revenge']],
] as const;
const moods = [
    { title: '上头', tw: '上頭', sub: '停不下来', subTw: '停不下來', icon: Flame, query: '剧情', aliases: ['drama', '剧情'] },
    { title: '爽快', tw: '爽快', sub: '逆袭打脸', subTw: '逆襲打臉', icon: TrendingUp, query: '逆袭', aliases: ['revenge', 'rebirth', '逆袭'] },
    { title: '甜宠', tw: '甜寵', sub: '心动', subTw: '心動', icon: Heart, query: '甜宠', aliases: ['romance', 'love', '甜宠'] },
    { title: '虐心', tw: '虐心', sub: '哭一场', subTw: '哭一場', icon: MessageCircle, query: '虐恋', aliases: ['虐恋', 'tragic', 'heartbreak'] },
    { title: '刺激', tw: '刺激', sub: '禁忌感', subTw: '禁忌感', icon: Sparkles, query: '禁忌恋', aliases: ['forbidden', '禁忌'] },
    { title: '烧脑', tw: '燒腦', sub: '反转', subTw: '反轉', icon: Target, query: '悬疑', aliases: ['suspense', 'mystery', '悬疑'] },
];

export function SearchDiscovery({ onExplore }: { onExplore: (keyword: string, aliases: readonly string[]) => void }) {
    const tw = useIntl().locale === 'zh-TW';
    return <div className="rs-search-discovery">
        <div className="rs-search-discovery__prompts">
            {prompts.map(([cn, traditional, keyword, aliases]) => <button key={cn} type="button" onClick={() => onExplore(keyword, aliases)}><span aria-hidden>↳</span>{tw ? traditional : cn}</button>)}
        </div>
        <section aria-labelledby="search-mood-title">
            <h2 id="search-mood-title">{tw ? '今晚什麼心情？' : '今晚什么心情？'}</h2>
            <div className="rs-search-discovery__moods">
                {moods.map(({ title, tw: traditional, sub, subTw, icon: Icon, query, aliases }) => <button key={title} type="button" onClick={() => onExplore(query, aliases)}>
                    <Icon aria-hidden /><strong>{tw ? traditional : title}</strong><small>{tw ? subTw : sub}</small>
                </button>)}
            </div>
        </section>
    </div>;
}
