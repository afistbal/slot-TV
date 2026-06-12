import { feedDbg } from './feedDebugLog';

let chainAutoplayPending = false;

export function markChainAutoplay() {
    chainAutoplayPending = true;
    feedDbg('chain mark');
}

export function consumeChainAutoplay(): boolean {
    if (!chainAutoplayPending) return false;
    chainAutoplayPending = false;
    feedDbg('chain consume');
    return true;
}
