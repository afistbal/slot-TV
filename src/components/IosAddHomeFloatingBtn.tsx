import { Link } from 'react-router';
import { FormattedMessage } from 'react-intl';
import { shouldShowIosAddHomeFab } from '@/lib/shouldShowIosAddHomeFab';
import { BRAND_LOGO_SRC } from '@/constants/brand';

/**
 * iOS / iPad：未以主屏幕 standalone 打开时显示，点击进 `/page/ios-add-home`。
 */
export function IosAddHomeFloatingBtn() {
    if (!shouldShowIosAddHomeFab()) {
        return null;
    }

    return (
        <Link
            to="/page/ios-add-home"
            className="ios-pwa-add-btn"
            role="button"
            aria-label="Add to Home Screen"
        >
            <img className="ios-pwa-add-btn__icon" src={BRAND_LOGO_SRC} alt="" loading="lazy" />
            <span className="ios-pwa-add-btn__text">
                <FormattedMessage id="ios_add_home_fab_text" />
            </span>
        </Link>
    );
}
