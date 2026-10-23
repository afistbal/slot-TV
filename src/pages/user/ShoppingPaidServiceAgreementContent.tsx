/** 购物付费弹层内“用户付费服务协议”正文。 */
export function ShoppingPaidServiceAgreementContent() {
    return (
        <div className="rs-shopping__paidAgreementContainer">
            <div className="rs-shopping__paidAgreementInner">
                <section className="rs-shopping__paidAgreementSection">
                    <div className="rs-shopping__paidAgreementCard">
                        <p className="rs-shopping__paidAgreementLead">
                            请在付款前认真阅读并确认本协议。点击“确认”“购买”或勾选同意，即表示您已充分理解并同意本协议全部内容。
                        </p>

                        <h3 className="rs-shopping__paidAgreementH3">1. 付费服务类型</h3>
                        <p className="rs-shopping__paidAgreementP">
                            金币及单次购买
                            <br />- 您可以购买金币，用于解锁剧集或其他付费内容；也可以购买页面展示的单次数字商品。
                            <br />- 商品名称、数量、价格、币种和可用范围以订单确认页面为准。
                            <br />- 金币或内容到账后，请及时核对；如未到账，请保留订单号和支付凭证并联系客服。
                        </p>
                        <p className="rs-shopping__paidAgreementP">
                            自动续费订阅
                            <br />- 您可以选择会员订阅，以持续享受购买页面展示的会员权益。
                            <br />- 订阅可以通过 Apple App Store、Google Play、银行卡或页面支持的其他支付方式开通。
                            <br />- 订阅周期可能为周、月、季度或年，具体以购买页面为准。
                            <br />- 开启自动续费后，系统将在每个订阅周期结束前通过原支付方式扣除下一周期费用。
                            <br />- 订阅成功后，权益立即绑定当前账户并开始计算有效期。
                            <br />- 如需取消自动续费，请至少在当前周期结束前 24 小时，通过对应应用商店、支付渠道或账户设置关闭。
                        </p>

                        <h3 className="rs-shopping__paidAgreementH3">2. 用户权利与义务</h3>
                        <p className="rs-shopping__paidAgreementP">
                            - 您有权自主决定是否购买金币、数字内容或会员订阅，并在遵守规则的前提下使用相应服务。
                            <br />- 您应保证账户信息和支付方式真实、有效并已获得合法授权，对当前账户下的购买行为负责。
                            <br />- 付款前请核对商品、数量、价格、订阅周期和自动续费说明；提交订单后，不得仅以未仔细阅读为由要求撤销。
                            <br />- 因系统故障、支付渠道异常或其他非用户原因导致商品未正确发放时，请及时联系客服，我们将协助核查处理。
                        </p>

                        <h3 className="rs-shopping__paidAgreementH3">3. 退款与取消</h3>
                        <p className="rs-shopping__paidAgreementP">
                            - 已经解锁、观看或消费的数字内容和金币通常不予退款，但适用法律另有规定的除外。
                            <br />- 取消自动续费仅停止下一周期扣费，不会自动退还当前周期费用；当前权益可使用至周期结束。
                            <br />- 通过第三方应用商店完成的订单，应按照相应平台的退款规则申请。
                            <br />- 重复扣款、金额错误或未经授权的扣款，可以凭订单号和支付凭证联系客服核查。
                        </p>

                        <h3 className="rs-shopping__paidAgreementH3">4. 风险提示与责任</h3>
                        <p className="rs-shopping__paidAgreementP">
                            - 因用户误操作、重复付款、账户选择错误或未妥善保管账户造成的损失，由用户依法承担相应责任。
                            <br />- 因设备、网络、第三方支付平台或应用商店故障导致服务异常时，我们会协助向相关渠道核查。
                            <br />- 我们可以根据法律、运营或产品变化调整付费服务条款，并在重大变更生效前通过页面公告、站内通知或其他合理方式说明。
                        </p>

                        <h3 className="rs-shopping__paidAgreementH3">5. 其他说明</h3>
                        <p className="rs-shopping__paidAgreementP">
                            - 本协议自您勾选同意并完成付款时生效。
                            <br />- 如对金币购买、订阅、自动续费或退款政策有疑问，请在付款前联系客服或查阅帮助文档。
                            <br />- 本协议应与本应用的《服务条款》《隐私政策》和《退款政策》一并阅读。
                        </p>
                    </div>
                </section>
            </div>
        </div>
    );
}
