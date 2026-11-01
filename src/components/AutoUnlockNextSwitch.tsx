import { useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { toast } from 'sonner';
import { readAutoUnlockNext, saveAutoUnlockNext } from '@/lib/autoUnlockNext';
import { useUserStore } from '@/stores/user';

export function AutoUnlockNextSwitch() {
    const intl = useIntl();
    const accountId = useUserStore(state => state.info?.id);
    const [enabled, setEnabled] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [failed, setFailed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [retry, setRetry] = useState(0);
    const saving = useRef(false);
    const label = intl.formatMessage({ id: 'account_auto_unlock_next' });

    useEffect(() => {
        let active = true;
        setLoaded(false); setFailed(false);
        void readAutoUnlockNext(true).then(value => {
            if (!active) return;
            setFailed(value === null);
            setLoaded(value !== null);
            setEnabled(value === true);
        });
        return () => { active = false; };
    }, [accountId, retry]);

    async function toggle() {
        if (!loaded || saving.current) return;
        const token = localStorage.getItem('token');
        const previous = enabled;
        saving.current = true;
        setBusy(true); setEnabled(!previous);
        const ok = await saveAutoUnlockNext(!previous);
        saving.current = false;
        if (token !== localStorage.getItem('token')) return;
        setBusy(false);
        if (!ok) {
            setEnabled(previous);
            toast.error(intl.formatMessage({ id: 'account_auto_unlock_save_failed' }));
        }
    }

    return <section className="rs-auto-unlock" aria-busy={busy || !loaded && !failed}>
        <div className="rs-auto-unlock__copy">
            <span id="auto-unlock-label">{label}</span>
            <p id="auto-unlock-description">{intl.formatMessage({ id: 'account_auto_unlock_description' })}</p>
            {failed && <button type="button" className="rs-auto-unlock__retry" onClick={() => setRetry(n => n + 1)}>
                {intl.formatMessage({ id: 'account_auto_unlock_retry' })}
            </button>}
        </div>
        <button type="button" role="switch" className="rs-auto-unlock__switch" aria-labelledby="auto-unlock-label"
            aria-describedby="auto-unlock-description" aria-checked={enabled} disabled={!loaded || busy} onClick={() => void toggle()}>
            <span />
        </button>
    </section>;
}
