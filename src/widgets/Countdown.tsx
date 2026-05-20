import { useEffect, useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import { FormattedMessage, useIntl } from 'react-intl';

export type CountdownVariant = 'default' | 'planCorner';

type CountdownProps = {
    /** `planCorner`：购物周卡右上角单条粉徽章（时钟 + HH:MM:SS / DD:HH:MM:SS） */
    variant?: CountdownVariant;
};

function formatCountdownParts(totalSeconds: number) {
    const safe = Math.max(0, totalSeconds);
    const days = Math.floor(safe / 86400);
    const hours = Math.floor((safe % 86400) / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const seconds = safe % 60;
    return { days, hours, minutes, seconds };
}

export default function Countdown({ variant = 'default' }: CountdownProps) {
    const intl = useIntl();
    const [countdown, setCountdown] = useState(0);

    useEffect(() => {
        let time = parseInt(localStorage.getItem('promotion-countdown-timeout')?.toString() || 'NaN', 10);
        const now = Math.floor(new Date().getTime() / 1000);
        const count = 30 * 60;
        if (isNaN(time) || time <= now) {
            time = count + now;
            localStorage.setItem('promotion-countdown-timeout', time.toString());
        }

        setCountdown(time - now);
        const timer = window.setInterval(() => {
            setCountdown((current) => {
                if (current === 0) {
                    localStorage.setItem('promotion-countdown-timeout', '0');
                    return 0;
                }
                return current - 1;
            });
        }, 1000);

        return () => {
            window.clearInterval(timer);
        };
    }, []);

    const { days, hours, minutes, seconds } = formatCountdownParts(countdown);

    const planCornerTime = useMemo(() => {
        const hh = hours.toString().padStart(2, '0');
        const mm = minutes.toString().padStart(2, '0');
        const ss = seconds.toString().padStart(2, '0');
        if (days > 0) {
            return `${days.toString().padStart(2, '0')}:${hh}:${mm}:${ss}`;
        }
        return `${hh}:${mm}:${ss}`;
    }, [days, hours, minutes, seconds]);

    if (variant === 'planCorner') {
        return (
            <div
                className="rs-countdown rs-countdown--planCorner"
                role="timer"
                aria-live="polite"
                aria-label={intl.formatMessage(
                    { id: 'shopping_countdown_aria' },
                    { time: planCornerTime },
                )}
            >
                <Clock className="rs-countdown__clockIcon" strokeWidth={2} aria-hidden />
                <span className="rs-countdown__time tabular-nums">{planCornerTime}</span>
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
                    {hours.toString().padStart(2, '0')}
                </div>
                <div className="bg-pink-400 text-white text-sm leading-3.5 p-2 rounded-sm tabular-nums">
                    {minutes.toString().padStart(2, '0')}
                </div>
                <div className="bg-pink-400 text-white text-sm leading-3.5 p-2 rounded-sm tabular-nums">
                    {seconds.toString().padStart(2, '0')}
                </div>
            </div>
        </div>
    );
}
