import { useCallback, useState } from 'react';
import { useRequireAccount } from '@/hooks/useRequireAccount';
import { useUserStore } from '@/stores/user';

const AMBIENT_STORAGE_KEY = 'video-player:ambient-enabled';

function readAmbientPreference(): boolean {
    try {
        return window.localStorage.getItem(AMBIENT_STORAGE_KEY) === '1';
    } catch {
        return false;
    }
}

export function useVideoPlayerAmbient() {
    const requireAccount = useRequireAccount();
    const signed = useUserStore((state) => state.signed);
    const anonymous = useUserStore((state) => state.isAnonymous());
    const [ambientEnabled, setAmbientEnabled] = useState(readAmbientPreference);

    const toggleAmbient = useCallback(() => {
        if (!requireAccount()) return;
        setAmbientEnabled((enabled) => {
            const next = !enabled;
            try {
                window.localStorage.setItem(AMBIENT_STORAGE_KEY, next ? '1' : '0');
            } catch {
                /* Local storage may be unavailable in private browsing. */
            }
            return next;
        });
    }, [requireAccount]);

    return { ambientEnabled: signed && !anonymous && ambientEnabled, toggleAmbient };
}
