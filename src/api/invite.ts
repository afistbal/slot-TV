import { getAffiliateEligibility } from '@/api/affiliate';
import { normalizeInviteInfo, type InviteInfo } from '@/lib/inviteData';

let flight: { token: string; promise: Promise<InviteInfo> } | undefined;

/** Invitation rewards and eligibility share POST user/affiliate. */
export function getInviteInfo(): Promise<InviteInfo> {
    const token = localStorage.getItem('token') ?? '';
    if (flight?.token === token) return flight.promise;
    const promise = getAffiliateEligibility().then(result => {
        if (!result || typeof result !== 'object' || Array.isArray(result)) {
            throw new Error('POST /api/user/affiliate · Invalid invitation data');
        }
        return normalizeInviteInfo(result);
    }).finally(() => { if (flight?.promise === promise) flight = undefined; });
    flight = { token, promise };
    return promise;
}
