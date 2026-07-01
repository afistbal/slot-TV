import { useEffect, useState } from 'react';
import { FormattedMessage } from 'react-intl';
import { Clock } from 'lucide-react';

const DEFAULT_DURATION_SECONDS = 30 * 60;
const DEFAULT_STORAGE_KEY = 'promotion-countdown-timeout';

type CountdownProps = {
    storageKey?: string;
    durationSeconds?: number;
    compact?: boolean;
    showLabel?: boolean;
    className?: string;
};

function formatCountdownParts(totalSeconds: number) {
    const safe = Math.max(0, totalSeconds);
    const days = Math.floor(safe / 86400);
    const hours = Math.floor((safe % 86400) / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const seconds = safe % 60;
    return { days, hours, minutes, seconds };
}

function readPromotionDeadline(storageKey: string, durationSeconds: number, now: number) {
    let deadline = Number.NaN;
    try {
        deadline = Number.parseInt(localStorage.getItem(storageKey) ?? '', 10);
    } catch {
        deadline = Number.NaN;
    }

    if (!Number.isFinite(deadline) || deadline <= now) {
        deadline = now + durationSeconds;
        try {
            localStorage.setItem(storageKey, String(deadline));
        } catch {
            // localStorage may be unavailable in private or embedded webviews.
        }
    }

    return deadline;
}

function pad2(n: number) {
    return n.toString().padStart(2, '0');
}

export default function Countdown({
    storageKey = DEFAULT_STORAGE_KEY,
    durationSeconds = DEFAULT_DURATION_SECONDS,
    compact = false,
    showLabel = true,
    className,
}: CountdownProps = {}) {
    const duration = Math.max(1, Math.floor(durationSeconds));
    const [countdown, setCountdown] = useState(duration);

    useEffect(() => {
        let mounted = true;

        const syncCountdown = () => {
            const now = Math.floor(Date.now() / 1000);
            const deadline = readPromotionDeadline(storageKey, duration, now);
            if (mounted) {
                setCountdown(Math.max(0, deadline - now));
            }
        };

        syncCountdown();
        const timer = window.setInterval(syncCountdown, 1000);

        return () => {
            mounted = false;
            window.clearInterval(timer);
        };
    }, [duration, storageKey]);

    const { hours, minutes, seconds } = formatCountdownParts(countdown);
    const timeText = `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;

    if (compact) {
        return (
            <div className={className ? `rs-countdown-compact ${className}` : 'rs-countdown-compact'}>
                {showLabel ? (
                    <span className="rs-countdown-compact__label">
                        <FormattedMessage id="limited_time" />
                    </span>
                ) : (
                    <Clock className="rs-countdown-compact__clockIcon" strokeWidth={2} aria-hidden />
                )}
                <span className="rs-countdown-compact__time">{timeText}</span>
            </div>
        );
    }

    return (
        <div className="flex gap-1 items-center justify-center">
            <div className="text-sm leading-3.5 p-2 rounded-sm bg-pink-400 text-white">
                <FormattedMessage id="limited_time" />
            </div>
            <div className="flex gap-1">
                <div className="bg-pink-400 text-white text-sm leading-3.5 p-2 rounded-sm tabular-nums">
                    {pad2(hours)}
                </div>
                <div className="bg-pink-400 text-white text-sm leading-3.5 p-2 rounded-sm tabular-nums">
                    {pad2(minutes)}
                </div>
                <div className="bg-pink-400 text-white text-sm leading-3.5 p-2 rounded-sm tabular-nums">
                    {pad2(seconds)}
                </div>
            </div>
        </div>
    );
}
