import { BRAND_DISPLAY_NAME } from '@/constants/brand';

export function RefundPolicyContent() {
    return (
        <>
            <h1 className="rs-legal-doc__title">Refund Policy</h1>

            <h2 className="rs-legal-doc__h2">1. Overview</h2>
            <p>
                {BRAND_DISPLAY_NAME} (&quot;{BRAND_DISPLAY_NAME},&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;)
                provides online short-drama streaming services through its App, H5 web pages, and related platforms.
                This Refund Policy explains how {BRAND_DISPLAY_NAME} handles payments, virtual currency (coins / bonus
                coins), subscriptions (VIP membership), auto-renewal, cancellation, and refunds.
            </p>
            <p>
                When you purchase coins, unlock episodes, or subscribe to any membership plan, you agree to the terms
                described here.
            </p>

            <h2 className="rs-legal-doc__h2">2. Types of Purchases</h2>
            <p>
                <span className="rs-legal-doc__emph">Coins / Bonus coins (virtual currency): </span>
                Used to unlock episodes and access paid content. Coins are a paid item; bonus coins are typically granted
                through promotions or rewards.
            </p>
            <p>
                <span className="rs-legal-doc__emph">VIP / Membership subscriptions: </span>
                Recurring plans (e.g., weekly, monthly, quarterly, yearly) that unlock membership benefits and renew
                automatically unless cancelled.
            </p>
            <p>
                <span className="rs-legal-doc__emph">One-time purchases: </span>
                Certain content or promotional bundles may be sold as single, non-recurring purchases.
            </p>

            <h2 className="rs-legal-doc__h2">3. Refund Eligibility</h2>
            <h3 className="rs-legal-doc__h3">3.1 Virtual currency (coins / bonus coins)</h3>
            <p>
                Coins are a consumable digital good. Once coins have been used to unlock content, that portion is
                considered delivered and consumed and is generally non-refundable.
            </p>
            <p>
                Unused coins may be eligible for a refund only where required by applicable law, or in the case of a
                mistaken purchase where the coins from that order have not yet been consumed.
            </p>
            <p>Bonus coins and promotional coins have no cash value and are non-refundable.</p>

            <h3 className="rs-legal-doc__h3">3.2 Subscriptions and auto-renewal</h3>
            <p>
                Unless auto-renewal is turned off, subscriptions renew automatically at the end of each billing cycle.
            </p>
            <p>
                To avoid being charged for the next cycle, cancel at least 24 hours before the current cycle ends.
            </p>
            <p>
                Cancelling a subscription only stops future renewals; it does not by itself refund the current billing
                cycle. Membership benefits continue until the end of the paid period.
            </p>
            <p>
                Fees for a completed or in-progress billing cycle are generally non-refundable, except where required by
                applicable law.
            </p>

            <h3 className="rs-legal-doc__h3">3.3 Mistaken or unauthorized charges</h3>
            <p>
                If you believe you were charged in error, charged more than once, or charged without authorization,
                please contact us as soon as possible so we can review the issue and, where appropriate, issue a refund.
            </p>

            <h2 className="rs-legal-doc__h2">4. Non-Refundable Items</h2>
            <p>Coins or content that have been unlocked, used, or consumed.</p>
            <p>Gifted, complimentary, reward, or promotional coins.</p>
            <p>Subscription fees for a billing cycle that has already begun (except where required by law).</p>
            <p>Transactions that have already been refunded.</p>

            <h2 className="rs-legal-doc__h2">5. Purchases Through App Stores (Apple App Store / Google Play)</h2>
            <p>
                If you purchase coins or subscriptions through the Apple App Store or Google Play, those transactions are
                processed by the respective app store. Refunds for such purchases are governed by that store&apos;s refund
                policy, and you may need to request the refund directly from the store:
            </p>
            <p>
                <span className="rs-legal-doc__emph">Apple App Store: </span>
                Request a refund through Apple (reportaproblem.apple.com) or your Apple account settings.
            </p>
            <p>
                <span className="rs-legal-doc__emph">Google Play: </span>
                Request a refund through Google Play. Refunds within a short window after purchase may be handled by
                Google, while later requests may be forwarded to the developer.
            </p>
            <p>
                We will assist where we can, but we may be unable to directly refund amounts collected and controlled by a
                third-party store.
            </p>

            <h2 className="rs-legal-doc__h2">6. How to Request a Refund</h2>
            <p>To request a refund, please contact customer support and provide the following:</p>
            <p>1. The account email or user ID associated with the purchase.</p>
            <p>2. The order / transaction number and the purchase date.</p>
            <p>3. The payment method and platform used (in-app, H5, Apple, Google Play, etc.).</p>
            <p>4. A brief explanation of the reason for the refund.</p>
            <p>
                Contact: In the App/H5, go to &quot;Profile → Feedback &amp; Help&quot;
            </p>

            <h2 className="rs-legal-doc__h2">7. Refund Processing</h2>
            <p>
                We will review refund requests within a reasonable time after receiving all required information.
            </p>
            <p>
                Approved refunds are returned to the original payment method. The time to appear in your account depends
                on your payment provider or app store.
            </p>

            <h2 className="rs-legal-doc__h2">8. Changes to This Policy</h2>
            <p>
                We may update this Refund Policy and its related terms from time to time. Material changes will be
                announced through the App or website. Your continued use of {BRAND_DISPLAY_NAME} after changes take
                effect constitutes acceptance of the updated terms.
            </p>
        </>
    );
}
