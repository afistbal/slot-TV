import { useEffect, useState } from 'react';

export function useDelayedVisible(active: boolean, delayMs: number): boolean {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!active) {
            setVisible(false);
            return;
        }

        const timer = window.setTimeout(() => {
            setVisible(true);
        }, delayMs);

        return () => {
            window.clearTimeout(timer);
        };
    }, [active, delayMs]);

    return visible;
}
