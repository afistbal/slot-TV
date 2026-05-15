import { Page } from '@/layouts/user';
import { WalletTransactionHistory } from '@/pages/user/WalletTransactionHistory';

/** H5 钱包：交易记录（无余额卡） */
export default function Component() {
    return (
        <Page title="profile_wallet" bodyClassName="bg-app-canvas">
            <div className="rs-wallet-page">
                <div className="rs-wallet-page__scroll">
                    <div className="rs-wallet-page__inner">
                        <WalletTransactionHistory variant="h5" />
                    </div>
                </div>
            </div>
        </Page>
    );
}
