import { Page } from '@/layouts/user';
import RadixRcApplePayNativeButton from '@/pages/user/RadixRcApplePayNativeButton';

/**
 * Apple Pay Native 按钮调试页（固定参数）。
 * 仅用于排查 Native ApplePaySession 流程，不参与正式购物页。
 */
export default function ApplePayNativeButtonDemo() {
    return (
        <Page title="Apple Pay Native Demo" bodyClassName="p-4 max-w-md mx-auto">
            <div className="rounded-md border border-white/10 bg-white/5 p-3 text-xs text-white/70 mb-4">
                固定上下文：productId=1，disabled=false
            </div>
            <RadixRcApplePayNativeButton productId={1} disabled={false} />
        </Page>
    );
}
