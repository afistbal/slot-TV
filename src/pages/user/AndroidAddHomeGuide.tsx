import { FormattedMessage } from 'react-intl';
import { Page } from '@/layouts/user';
import '@/styles/ios-pwa-add.scss';

/** Manual fallback for Android browsers that do not expose a native PWA install prompt. */
export default function Component() {
    return (
        <Page title="add_desktop_short" bodyClassName="bg-app-canvas">
            <div className="rs-ios-add-home">
                <p className="rs-ios-add-home__lead"><FormattedMessage id="android_add_home_guide_lead" /></p>
                <ol className="rs-ios-add-home__steps">
                    <li className="rs-ios-add-home__step"><FormattedMessage id="android_add_home_guide_step_1" /></li>
                    <li className="rs-ios-add-home__step"><FormattedMessage id="android_add_home_guide_step_2" /></li>
                    <li className="rs-ios-add-home__step"><FormattedMessage id="android_add_home_guide_step_3" /></li>
                </ol>
                <p className="rs-ios-add-home__lead mt-4"><FormattedMessage id="android_add_home_guide_fallback" /></p>
            </div>
        </Page>
    );
}
