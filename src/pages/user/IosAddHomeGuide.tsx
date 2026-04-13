import { Page } from '@/layouts/user';

/** iOS 添加主屏幕说明：留白 + 顶栏返回 + 标题 */
export default function Component() {
    return (
        <Page title="ios_add_home_page_title" bodyClassName="bg-app-canvas">
            <div className="min-h-[50vh]" aria-hidden />
        </Page>
    );
}
