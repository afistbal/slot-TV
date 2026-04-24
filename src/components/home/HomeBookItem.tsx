import { Link } from 'react-router';

export interface HomeBookItemData {
    id: number;
    title: string;
    image: string;
    /**
     * 新 episodes 详情页 slug（优先级最高）。
     * 形如：`episode-2-田園情緣-694507047c33a39ff605a96d-r7jxhoxjsb`
     */
    episodeSlug?: string;
    /** ReelShort movie slug（可选，后续可接 `/movie/:slug` 页）。 */
    movieSlug?: string;
    /** 对标镜像播放量文案，如 `544k` */
    views?: string;
    /** Continue Watching：当前集数（如 1） */
    currentEp?: number;
    /** Continue Watching：总集数（如 70） */
    totalEp?: number;
    /** Continue Watching：进度百分比（0-100） */
    progressPercent?: number;
    /** Continue Watching：显示播放遮罩层 */
    showPlayMask?: boolean;
    /** 只影响 DOM 对齐：镜像里有 `data-report="expo"` */
    showExpo?: boolean;
}

export function HomeBookItem({
    to,
    staticBase,
    item,
    variant,
}: {
    to: string;
    staticBase: string;
    item: HomeBookItemData;
    variant?: 'default' | 'style5';
}) {
    const src =
        item.image.startsWith('http://') || item.image.startsWith('https://')
            ? item.image
            : `${staticBase}/${item.image}`;

    return (
        <div
            className={[
                'book-item',
                'BookItem_bookItem__wWmbf',
                variant === 'style5' ? 'BookItem_bookStyle5__Hn17I' : '',
            ]
                .filter(Boolean)
                .join(' ')}
        >
            <Link to={to} className="absolute left-0 top-0 z-10 h-full w-full" aria-label={item.title} />
            {item.showExpo ? <div data-report="expo" className="BookItem_expoItem__EbMPA" /> : null}
            <div className="BookItem_cover__W2qbR">
                <img src={src} alt={item.title} loading="lazy" decoding="async" />
                <div className="BookItem_mask__bz19c" aria-hidden />
                {item.showPlayMask ? null : (
                    <>
                        {/* 对站 fb8bb5c8… .BookItem_item_mask__EE98C + .BookItem_coverIconPlay__7iBKQ，hover 时与封面动效同现 */}
                        <div className="BookItem_item_mask__EE98C" aria-hidden />
                        <div className="BookItem_coverIconPlay__7iBKQ" aria-hidden />
                    </>
                )}
                {item.showPlayMask ? (
                    <div className="BookItem_playMask__lJJFO" aria-hidden>
                        <div className="BookItem_playIconBg__pZ9wk">
                            <div className="BookItem_playIcon__ObTw9" />
                        </div>
                    </div>
                ) : null}
                {typeof item.progressPercent === 'number' ? (
                    <div className="BookItem_read_progress_bar__5HCyD" aria-hidden>
                        <div className="BookItem_read_progress__q_bYT" style={{ width: `${item.progressPercent}%` }} />
                    </div>
                ) : null}
                {item.views ? (
                    <div className="BookItem_playCount__klKNX" aria-hidden>
                        <span className="BookItem_icon__mPHYB" aria-hidden />
                        <span>{item.views}</span>
                    </div>
                ) : null}
            </div>
            <div className="BookItem_bookInfo__RMtO7">
                <h3 className="BookItem_title__85fqs">{item.title}</h3>
                {typeof item.currentEp === 'number' && typeof item.totalEp === 'number' ? (
                    <div className="BookItem_chapter__8RIez">
                        <span className="BookItem_chapter_progress__Ev8ed">{`EP.${item.currentEp}`}</span> /{' '}
                        <span>{`EP.${item.totalEp}`}</span>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
