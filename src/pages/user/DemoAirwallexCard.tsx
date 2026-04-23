import { Cards } from '@/pages/user/Cards';

const PRODUCT_ID = 4;

/** 仅银行卡 Drop-in，`/page/demo/airwallex-card` — 与 `Cards` 同源 */
export default function DemoAirwallexCard() {
    const href = typeof window !== 'undefined' ? window.location.href : '';
    return (
        <div className="p-4 max-w-md mx-auto">
            <Cards productId={PRODUCT_ID} redirectHref={href} successAction="reload" variant="page" />
        </div>
    );
}
