const STORAGE_KEY = 'profile-membership-renewal-at';

let memoryRenewalAt: string | null = null;

export function getProfileMembershipRenewalAt(): string | null {
    if (memoryRenewalAt) {
        return memoryRenewalAt;
    }
    try {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        if (stored) {
            memoryRenewalAt = stored;
            return stored;
        }
    } catch {
        /* ignore */
    }
    return null;
}

export function setProfileMembershipRenewalAt(value: string) {
    memoryRenewalAt = value;
    try {
        sessionStorage.setItem(STORAGE_KEY, value);
    } catch {
        /* ignore */
    }
}

export function clearProfileMembershipRenewalAt() {
    memoryRenewalAt = null;
    try {
        sessionStorage.removeItem(STORAGE_KEY);
    } catch {
        /* ignore */
    }
}
