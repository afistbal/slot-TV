import { Page } from '@/layouts/user';
import { WalletTransactionHistory } from '@/pages/user/WalletTransactionHistory';

/** 钱包明细：沿用个人中心的圆角面板与交易列表样式。 */
export default function Component() {
    return (
        <Page
            title="wallet_page_title"
            titleClassName="rs-wallet-page__title"
            bodyClassName="rs-wallet-page__body"
            constrained
        >
            <main className="rs-wallet-page">
                <div className="rs-wallet-page__inner">
                    <WalletTransactionHistory variant="h5" />
                </div>
            </main>
        </Page>
    );
}
