import { useEffect, useState } from 'react';
import { FormattedMessage } from 'react-intl';

export default function Countdown() {
    const [countdown, setCountdown] = useState(0);

    useEffect(() => {
        let time = parseInt(localStorage.getItem('promotion-countdown-timeout')?.toString() || 'NaN', 10);
        const now = Math.floor((new Date()).getTime() / 1000);
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

    return (
        <div className="flex gap-1 items-center justify-center">
            <div className="text-sm leading-3.5 p-2 rounded-sm bg-pink-400 text-white">
                <FormattedMessage id="limited_time" />
            </div>
            <div className="flex gap-1">
                <div className="bg-pink-400 text-white text-sm leading-3.5 p-2 rounded-sm">
                    {Math.floor(countdown / 3600)
                        .toString()
                        .padStart(2, '0')}
                </div>
                <div className="bg-pink-400 text-white text-sm leading-3.5 p-2 rounded-sm">
                    {Math.floor((countdown % 3600) / 60)
                        .toString()
                        .padStart(2, '0')}
                </div>
                <div className="bg-pink-400 text-white text-sm leading-3.5 p-2 rounded-sm">
                    {((countdown % 3600) % 60).toString().padStart(2, '0')}
                </div>
            </div>
        </div>
    );
}
