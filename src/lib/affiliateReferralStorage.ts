const AFFILIATE_REFERRAL_STORAGE_KEY = 'affiliate-referral-code';

export function captureAffiliateReferralFromLocation(search = window.location.search): string | undefined {
    const ref = new URLSearchParams(search).get('ref')?.trim();
    if (!ref || ref === 'PREVIEW') return undefined;

    try {
        window.localStorage.setItem(AFFILIATE_REFERRAL_STORAGE_KEY, ref);
    } catch {
        // Storage may be unavailable; the page can continue without attribution persistence.
    }
    return ref;
}

export function getStoredAffiliateReferralCode(): string | undefined {
    try {
        return window.localStorage.getItem(AFFILIATE_REFERRAL_STORAGE_KEY)?.trim() || undefined;
    } catch {
        return undefined;
    }
}

export function getRegistrationReferralPayload(): { ref?: string } {
    const ref = getStoredAffiliateReferralCode();
    return ref ? { ref } : {};
}

export function clearStoredAffiliateReferralCode(): void {
    try {
        window.localStorage.removeItem(AFFILIATE_REFERRAL_STORAGE_KEY);
    } catch {
        // Storage may be unavailable; successful registration is unaffected.
    }
}
