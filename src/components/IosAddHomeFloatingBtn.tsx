import { Link } from 'react-router';
import { FormattedMessage } from 'react-intl';
import { shouldShowIosAddHomeFab } from '@/lib/shouldShowIosAddHomeFab';
import { useMinWidth768 } from '@/hooks/useMinWidth768';
import usePixel from '@/hooks/usePixel';
import '@/styles/ios-pwa-add.scss';

function AddToHomeIcon() {
    return (
        <svg className="ios-pwa-add-btn__icon" viewBox="0 0 24 24" aria-hidden>
            <rect x="5.5" y="2.5" width="13" height="19" rx="3" />
            <path d="M12 7v7M8.5 10.5h7" />
            <path d="M10.25 18h3.5" />
        </svg>
    );
}

/**
 * iOS / iPad：未以主屏幕 standalone 打开时显示，点击进 `/page/ios-add-home`。
 */
export function IosAddHomeFloatingBtn() {
    const isDesktop = useMinWidth768();
    const pixel = usePixel();
    if (isDesktop || !shouldShowIosAddHomeFab()) {
        return null;
    }

    return (
        <Link
            to="/page/ios-add-home"
            className="ios-pwa-add-btn"
            role="button"
            aria-label="Add to Desktop"
            onClick={() => pixel.track('Download')}
        >
            <AddToHomeIcon />
            <span className="ios-pwa-add-btn__text">
                <FormattedMessage id="add_desktop_short" />
            </span>
        </Link>
    );
}
