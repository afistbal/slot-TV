import { useState } from 'react';
import { Link } from 'react-router';
import { FormattedMessage, useIntl } from 'react-intl';
import { cn } from '@/lib/utils';
import { BRAND_DISPLAY_NAME } from '@/constants/brand';

const FOOTER_CHEVRON =
    'https://v-mps.crazymaplestudios.com/images/f0fb9400-5a1f-11ef-838e-777d81c2a9c7.png';

function IconFacebook() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" aria-hidden>
            <g transform="translate(-1199 -3564)">
                <circle cx="16" cy="16" r="16" style={{ fill: '#fff', opacity: 0.2 }} transform="translate(1199 3564)" />
                <g style={{ opacity: 0.5 }}>
                    <path
                        d="M3575.913 669.13v3.055h-1.663a1.017 1.017 0 0 0-.965.4 1.886 1.886 0 0 0-.157.921v1.394h2.83l-.337 3.077h-2.493v8.872h-3.661v-8.869h-1.8v-3.08h1.8v-1.842c0-1.886.651-3.1 1.931-3.616a4.5 4.5 0 0 1 1.73-.315Z"
                        style={{ fill: '#fff' }}
                        transform="translate(-2356.813 2903.009)"
                    />
                </g>
            </g>
        </svg>
    );
}

function IconYoutube() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" aria-hidden>
            <g transform="translate(-1243 -3564)">
                <circle cx="16" cy="16" r="16" style={{ fill: '#fff', opacity: 0.2 }} transform="translate(1243 3564)" />
                <path
                    d="M327.276 478.786a4.125 4.125 0 0 0-4.126-4.126H312.6a4.125 4.125 0 0 0-4.125 4.126v4.909a4.125 4.125 0 0 0 4.125 4.126h10.549a4.125 4.125 0 0 0 4.126-4.126Zm-6.2 2.822-4.731 2.341c-.185.1-.815-.034-.815-.245v-4.8c0-.213.635-.347.821-.242l4.529 2.464c.185.103.384.374.192.482Z"
                    style={{ fill: '#fff', opacity: 0.5 }}
                    transform="translate(941.124 3098.76)"
                />
            </g>
        </svg>
    );
}

function IconInstagram() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" aria-hidden>
            <defs>
                <style>{`.rs-ig{fill:#fff}`}</style>
            </defs>
            <g transform="translate(-1287 -3564)">
                <circle cx="16" cy="16" r="16" style={{ fill: '#fff', opacity: 0.2 }} transform="translate(1287 3564)" />
                <g style={{ opacity: 0.5 }}>
                    <path
                        d="M1307.381 3571.429h-8.762a4.2 4.2 0 0 0-4.19 4.191v8.762a4.2 4.2 0 0 0 4.19 4.191h8.762a4.2 4.2 0 0 0 4.19-4.191v-8.762a4.2 4.2 0 0 0-4.19-4.191m-8.762 1.347h8.762a2.846 2.846 0 0 1 2.843 2.844v8.762a2.846 2.846 0 0 1-2.843 2.843h-8.762a2.846 2.846 0 0 1-2.843-2.843v-8.762a2.846 2.846 0 0 1 2.844-2.844Z"
                        className="rs-ig"
                    />
                    <path
                        d="M1303.009 3584.33a4.508 4.508 0 0 0 .979-.108 4.284 4.284 0 0 0 3.233-3.233 4.341 4.341 0 0 0-5.209-5.208 4.281 4.281 0 0 0-3.233 3.232 4.336 4.336 0 0 0 4.23 5.318Zm-2.118-6.437a2.968 2.968 0 0 1 2.113-.875 3.163 3.163 0 0 1 .813.108 2.943 2.943 0 0 1 2.059 2.059 3 3 0 0 1-3.692 3.691 2.943 2.943 0 0 1-2.059-2.059 3 3 0 0 1 .767-2.925Z"
                        className="rs-ig"
                    />
                    <circle cx="0.924" cy="0.924" r="0.924" className="rs-ig" transform="rotate(-13.282 16004.837 -3823.117)" />
                </g>
            </g>
        </svg>
    );
}

function IconTiktok() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" aria-hidden>
            <defs>
                <style>{`.rs-tt{fill:rgba(255,255,255,.66)}`}</style>
            </defs>
            <g transform="translate(-1331 -3564)">
                <circle cx="16" cy="16" r="16" style={{ fill: '#fff', opacity: 0.2 }} transform="translate(1331 3564)" />
                <g style={{ opacity: 0.5 }}>
                    <path
                        d="M1354.561 3574.97v2.994a7.868 7.868 0 0 1-3.5-1.35 6.743 6.743 0 0 0 2.451.751v-2.582a3.517 3.517 0 0 0 1.049.187M1350.891 3576.527v6.5a5.794 5.794 0 0 1-5.725 5.848 5.6 5.6 0 0 1-3.291-1.066 5.591 5.591 0 0 0 2.243.467 5.794 5.794 0 0 0 5.725-5.848v-6.527a9.248 9.248 0 0 0 1.048.626"
                        className="rs-tt"
                    />
                    <path
                        d="M5730.888 477.138v2.582a6.747 6.747 0 0 1-2.452-.751l-.17-.117v.03a9.158 9.158 0 0 1-1.048-.629v6.527a5.794 5.794 0 0 1-5.725 5.848 5.6 5.6 0 0 1-2.244-.467 5.883 5.883 0 0 1-2.433-4.782 5.605 5.605 0 0 1 4.812-5.512v2.309a2.725 2.725 0 0 0-2.867 2.6 2.843 2.843 0 0 0 1.98 2.744 2.649 2.649 0 0 0 1.8.709 2.8 2.8 0 0 0 2.731-2.854V473.55l2.048-.046a4.832 4.832 0 0 0 .949 2 3.506 3.506 0 0 0 1.456 1 3.553 3.553 0 0 0 1.163.634"
                        style={{ fill: '#fff' }}
                        transform="translate(-4377.375 3097.645)"
                    />
                    <path
                        d="M1342.435 3583.021a2.9 2.9 0 0 0 .932 2.145 2.843 2.843 0 0 1-1.98-2.743 2.725 2.725 0 0 1 2.866-2.6v-2.312a6.5 6.5 0 0 1 1.048-.085v2.995a2.725 2.725 0 0 0-2.866 2.6M1352.349 3574.145a3.5 3.5 0 0 1-1.455-1 4.832 4.832 0 0 1-.949-2l.944-.021a5.126 5.126 0 0 0 1.052 2.616 3.444 3.444 0 0 0 .408.405"
                        className="rs-tt"
                    />
                </g>
            </g>
        </svg>
    );
}

function IconFandom() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" aria-hidden>
            <path fill="#fff" d="M16 32c8.837 0 16-7.163 16-16S24.837 0 16 0 0 7.163 0 16s7.163 16 16 16" opacity="0.2" />
            <path
                fill="#fff"
                fillOpacity="0.5"
                d="M12.854 6.008c.067.013.129.046.177.095l9.4 9.404A1.94 1.94 0 0 1 23 16.882v2.94a1.946 1.946 0 0 1-.567 1.373l-3.703 3.708c-.365.365-.859.57-1.374.57h-2.71a1.945 1.945 0 0 1-1.373-.57l-3.704-3.71A1.94 1.94 0 0 1 9 19.82v-8.166a.35.35 0 0 1 .415-.34c.067.013.13.046.178.094l2.847 2.848V6.349a.349.349 0 0 1 .213-.322.347.347 0 0 1 .2-.02M17.91 16.15a.584.584 0 0 0-.412.171l-1.497 1.5-1.498-1.5a.583.583 0 0 0-.824 0l-1.072 1.073a.583.583 0 0 0-.171.412v1.141c0 .154.062.302.17.41l2.976 3.002a.586.586 0 0 0 .827 0l2.986-3.001a.584.584 0 0 0 .17-.412v-1.141a.583.583 0 0 0-.171-.411l-1.072-1.073a.583.583 0 0 0-.412-.172"
            />
        </svg>
    );
}

export function ReelShortFooter() {
    const intl = useIntl();
    const year = new Date().getFullYear();
    const [aboutOpen, setAboutOpen] = useState(false);
    const [supportOpen, setSupportOpen] = useState(false);

    return (
        <footer className="reelshort-footer">
            <div>
                <div className="reelshort-footer__collapse-box">
                    <button
                        type="button"
                        className={cn(
                            'reelshort-footer__collapse-item',
                            aboutOpen && 'reelshort-footer__collapse-head--open',
                        )}
                        onClick={() => setAboutOpen((v) => !v)}
                        aria-expanded={aboutOpen}
                    >
                        <span className="reelshort-footer__title">
                            <FormattedMessage id="footer_about_us" />
                        </span>
                        <img width={12} height={10} alt="" src={FOOTER_CHEVRON} className="opacity-80" />
                    </button>
                    <div
                        className={cn('reelshort-footer__collapsible', aboutOpen && 'reelshort-footer__collapsible--open')}
                        aria-hidden={!aboutOpen}
                    >
                        <a className="reelshort-footer__collapse-item" href="/page/text" target="_blank" rel="noreferrer">
                            <FormattedMessage id="user_agreement" />
                        </a>
                        <a className="reelshort-footer__collapse-item" href="/page/text" target="_blank" rel="noreferrer">
                            <FormattedMessage id="privacy_policy" />
                        </a>
                        <a
                            className="reelshort-footer__collapse-item reelshort-footer__collapse-item--multiline"
                            href={`mailto:${intl.formatMessage({ id: 'footer_support_email' })}`}
                            target="_blank"
                            rel="noreferrer"
                        >
                            <span className="min-w-0 flex-1">
                                <FormattedMessage id="contact_us" />
                                <div className="reelshort-footer__tips">
                                    <FormattedMessage id="footer_contact_hours" />
                                </div>
                            </span>
                        </a>
                    </div>
                </div>

                <div className="reelshort-footer__collapse-box">
                    <button
                        type="button"
                        className={cn(
                            'reelshort-footer__collapse-item',
                            supportOpen && 'reelshort-footer__collapse-head--open',
                        )}
                        onClick={() => setSupportOpen((v) => !v)}
                        aria-expanded={supportOpen}
                    >
                        <span className="reelshort-footer__title">
                            <FormattedMessage id="footer_support_center" />
                        </span>
                        <img width={12} height={10} alt="" src={FOOTER_CHEVRON} className="opacity-80" />
                    </button>
                    <div
                        className={cn('reelshort-footer__collapsible', supportOpen && 'reelshort-footer__collapsible--open')}
                        aria-hidden={!supportOpen}
                    >
                        <Link className="reelshort-footer__collapse-item" to="/page/feedback">
                            <FormattedMessage id="feedback_help" />
                        </Link>
                        <a
                            className="reelshort-footer__collapse-item"
                            href={`mailto:${intl.formatMessage({ id: 'footer_media_email' })}`}
                            target="_blank"
                            rel="noreferrer"
                        >
                            <FormattedMessage id="footer_media_pr" />
                        </a>
                    </div>
                </div>

                <div className="reelshort-footer__community">
                    <div className="reelshort-footer__community-title">
                        <FormattedMessage id="footer_community" />
                    </div>
                    <div className="reelshort-footer__community-list">
                        <a href="https://www.facebook.com/ReelShortTV/" target="_blank" rel="noreferrer">
                            <IconFacebook />
                        </a>
                        <a href="https://www.youtube.com/@reelshortapp" target="_blank" rel="noreferrer">
                            <IconYoutube />
                        </a>
                        <a href="https://www.instagram.com/reelshortapp/" target="_blank" rel="noreferrer">
                            <IconInstagram />
                        </a>
                        <a href="https://www.tiktok.com/@reelshortapp" target="_blank" rel="noreferrer">
                            <IconTiktok />
                        </a>
                        <a href="https://reelshort.fandom.com/wiki/Local_Sitemap" target="_blank" rel="noreferrer">
                            <IconFandom />
                        </a>
                    </div>
                </div>

                <div className="reelshort-footer__copyright">
                    <FormattedMessage id="footer_copyright" values={{ year, site: BRAND_DISPLAY_NAME }} />
                </div>
            </div>
        </footer>
    );
}
