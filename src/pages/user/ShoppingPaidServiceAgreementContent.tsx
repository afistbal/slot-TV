/**
 * 购物付费弹层内「用户付费服务协议」全文（英文）。
 * 标题在 `RadixRc` 的 `paidAgreementHead`；此处仅正文卡片。
 */
export function ShoppingPaidServiceAgreementContent() {
    return (
        <div className="rs-shopping__paidAgreementContainer">
            <div className="rs-shopping__paidAgreementInner">
                <section className="rs-shopping__paidAgreementSection">
                    <div className="rs-shopping__paidAgreementCard">
                        <p className="rs-shopping__paidAgreementLead">
                            Please read and confirm the contents of this agreement carefully before making the payment.
                            By clicking &quot;Confirm&quot; or &quot;Check&quot;, you indicate that you have fully
                            understood and agreed to all the terms of this agreement.
                        </p>

                        <h3 className="rs-shopping__paidAgreementH3">1. Service type description</h3>
                        <p className="rs-shopping__paidAgreementP">
                            Automatic renewal subscription service
                            <br />- Users can also choose the subscription method to enjoy continuous membership services
                            or other exclusive benefits;
                            <br />- The subscription service will be activated through the Apple App Store, Google Play
                            or credit card, etc., and the auto-renewal function will be enabled by default;
                            <br />- The subscription period can be weekly, monthly or annual, subject to the display on
                            the user&apos;s purchase page;
                            <br />- Approximately 24 hours before the end of each subscription cycle, the system will
                            automatically deduct the subscription fee for the next cycle through your original payment
                            method;
                            <br />- After a successful subscription, the benefits will take effect immediately and apply
                            to the current account;
                            <br />- If you wish to cancel the auto-renewal, please do so at least 24 hours before the end
                            of the current cycle through your Apple ID, Google account, or our account Settings page.
                            Failure to do so within the specified time will be deemed as consent to the renewal.
                        </p>

                        <h3 className="rs-shopping__paidAgreementH3">2. User Rights and Obligations</h3>
                        <p className="rs-shopping__paidAgreementP">
                            - Users have the right to independently choose whether to purchase gold coins or subscribe,
                            and can enjoy corresponding services under the premise of abiding by relevant rules;
                            <br />- Users should ensure that the account information and payment methods provided are
                            true and valid, and bear full responsibility for all account actions;
                            <br />- If the service is not correctly distributed due to system failure, abnormal payment
                            channels or other reasons not attributable to the user, please contact the official customer
                            service in a timely manner and we will assist in handling it.
                        </p>

                        <h3 className="rs-shopping__paidAgreementH3">3. Risk Warning and Exemption Clauses</h3>
                        <p className="rs-shopping__paidAgreementP">
                            - Losses caused by user misoperations (such as duplicate payments, account errors, etc.) shall
                            be borne by the user themselves;
                            <br />- In the event of service failure due to system limitations of the equipment or
                            malfunctions of the third-party payment platform, we will assist you in applying for
                            verification to the payment channel, but we will not be held directly responsible for any
                            resulting consequences;
                            <br />- We reserve the right to adjust the terms of service in accordance with laws and
                            regulations, operational strategies or product optimization, and will explain the changes
                            through in-app notifications, page announcements and other means before making any changes.
                        </p>

                        <h3 className="rs-shopping__paidAgreementH3">4. Other explanations</h3>
                        <p className="rs-shopping__paidAgreementP">
                            - This agreement shall come into effect from the time when the user clicks &quot;Agree&quot;
                            and completes the payment;
                            <br />- If you have any questions about the gold coin purchase, subscription service or
                            automatic renewal policy, it is recommended that you consult customer service or refer to
                            relevant help documents before making the payment;
                            <br />- The content of this agreement should be understood and adhered to together with the
                            &quot;User Agreement&quot; and &quot;Privacy Policy&quot; of the application.
                            <br />- By checking ✅, you indicate that you have read, understood and agreed to this
                            &quot;User Paid Service Agreement&quot;.
                        </p>
                    </div>
                </section>
            </div>
        </div>
    );
}
