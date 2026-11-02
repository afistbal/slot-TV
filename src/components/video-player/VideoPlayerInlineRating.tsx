import { Star } from 'lucide-react';
import { useIntl } from 'react-intl';
import '@/styles/video-player-inline-rating.scss';

export function VideoPlayerInlineRating({ score = 0, submitting = false, onRate }: {
    score?: number;
    submitting?: boolean;
    onRate?: (score: number) => void;
}) {
    const { locale } = useIntl();
    const traditional = locale === 'zh-TW';
    const label = score > 0 ? (traditional ? '我的評分' : '我的评分') : (traditional ? '給這部劇打分' : '给这部剧打分');
    if (!onRate) return null;

    return <section className="video-inline-rating" aria-label={label}>
        <div className="video-inline-rating__heading">
            <span>{label}</span>
            {score > 0 ? <small>{traditional ? '已評分' : '已评分'}</small> : null}
        </div>
        <div className="video-inline-rating__stars" role="radiogroup" aria-label={label}>
            {[1, 2, 3, 4, 5].map(value => <button key={value} type="button" role="radio"
                aria-label={`${value} 星`} aria-checked={score === value} disabled={submitting || score > 0}
                className={score >= value ? 'is-active' : undefined} onClick={() => onRate(value)}>
                <Star aria-hidden />
            </button>)}
        </div>
    </section>;
}
