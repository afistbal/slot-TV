import { useEffect, useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import { useIntl } from 'react-intl';

function formatCountdownParts(totalSeconds: number) {
    const safe = Math.max(0, totalSeconds);
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const seconds = safe % 60;
    return { hours, minutes, seconds };
}

type VideoPaywallPlanCountdownProps = {
    expiresAt: number;
    className?: string;
};

export function VideoPaywallPlanCountdown({ expiresAt, className }: VideoPaywallPlanCountdownProps) {
    const intl = useIntl();
    const [remaining, setRemaining] = useState(() =>
        Math.max(0, expiresAt - Math.floor(Date.now() / 1000)),
    );

    useEffect(() => {
        const tick = () => {
            setRemaining(Math.max(0, expiresAt - Math.floor(Date.now() / 1000)));
        };
        tick();
        const timer = window.setInterval(tick, 1000);
        return () => window.clearInterval(timer);
    }, [expiresAt]);

    const { hours, minutes, seconds } = formatCountdownParts(remaining);
    const label = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    const aria = intl.formatMessage({ id: 'shopping_countdown_aria' }, { time: label });

    return (
        <div
            className={className ?? 'rs-countdown rs-countdown--planCorner'}
            role="timer"
            aria-live="polite"
            aria-label={aria}
        >
            <Clock className="rs-countdown__clockIcon" strokeWidth={2} aria-hidden />
            <span className="rs-countdown__time tabular-nums">{label}</span>
        </div>
    );
}

type VideoPaywallPromoCountdownProps = {
    expiresAt: number;
};

export function VideoPaywallPromoCountdown({ expiresAt }: VideoPaywallPromoCountdownProps) {
    const intl = useIntl();
    const [remaining, setRemaining] = useState(() =>
        Math.max(0, expiresAt - Math.floor(Date.now() / 1000)),
    );

    useEffect(() => {
        const tick = () => {
            setRemaining(Math.max(0, expiresAt - Math.floor(Date.now() / 1000)));
        };
        tick();
        const timer = window.setInterval(tick, 1000);
        return () => window.clearInterval(timer);
    }, [expiresAt]);

    const parts = useMemo(() => formatCountdownParts(remaining), [remaining]);
    const boxes = [
        parts.hours.toString().padStart(2, '0'),
        parts.minutes.toString().padStart(2, '0'),
        parts.seconds.toString().padStart(2, '0'),
    ];
    const timeLabel = boxes.join(':');
    const aria = intl.formatMessage({ id: 'shopping_countdown_aria' }, { time: timeLabel });

    return (
        <div className="rs-video-promo__countdown">
            <span className="rs-video-promo__countdownLabel">
                {intl.formatMessage({ id: 'video_promo_ends_in_label' })}
            </span>
            <div
                className="rs-video-promo__countdownBoxes"
                role="timer"
                aria-live="polite"
                aria-label={aria}
            >
                {boxes.flatMap((box, index) => {
                    const unit = (
                        <span key={`box-${index}-${box}`} className="rs-video-promo__countdownBox tabular-nums">
                            {box}
                        </span>
                    );
                    if (index >= boxes.length - 1) {
                        return [unit];
                    }
                    return [
                        unit,
                        <span key={`sep-${index}`} className="rs-video-promo__countdownSep" aria-hidden>
                            :
                        </span>,
                    ];
                })}
            </div>
        </div>
    );
}

function formatSaveAmountValue(diff: number): string {
    const rounded = Math.round(diff * 100) / 100;
    if (Number.isInteger(rounded)) {
        return String(rounded);
    }
    return rounded.toFixed(2).replace(/\.?0+$/, '');
}

export function computeSaveAmount(price: string, renewalPrice: string): string {
    const p = Number.parseFloat(price);
    const r = Number.parseFloat(renewalPrice);
    if (!Number.isFinite(p) || !Number.isFinite(r) || r <= p) {
        return '0';
    }
    return formatSaveAmountValue(r - p);
}
