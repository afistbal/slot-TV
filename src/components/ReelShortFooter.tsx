import { useState } from 'react';
import { LegalDocumentLink } from '@/components/LegalDocumentLink';
import { Link } from 'react-router';
import { FormattedMessage } from 'react-intl';
import { cn } from '@/lib/utils';
import { BRAND_DISPLAY_NAME } from '@/constants/brand';

const FOOTER_CHEVRON = new URL('../assets/images/f0fb9400-5a1f-11ef-838e-777d81c2a9c7.png', import.meta.url).toString();

export function ReelShortFooter() {
    const year = new Date().getFullYear();
    const appVersion = __APP_VERSION__;
    const [aboutOpen, setAboutOpen] = useState(false);
    const [supportOpen, setSupportOpen] = useState(false);

    return (
        <footer className="reelshort-footer">
            <div className="reelshort-footer__h5">
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
                            <LegalDocumentLink title="user_agreement" className="reelshort-footer__collapse-item">
                                <FormattedMessage id="user_agreement" />
                            </LegalDocumentLink>
                            <LegalDocumentLink title="privacy_policy" className="reelshort-footer__collapse-item">
                                <FormattedMessage id="privacy_policy" />
                            </LegalDocumentLink>
                            <div className="reelshort-footer__collapse-item reelshort-footer__collapse-item--version">
                                <span className="reelshort-footer__versionLabel">
                                    <FormattedMessage id="version" />
                                </span>
                                <span className="reelshort-footer__versionValue">{appVersion}</span>
                            </div>
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
                            className={cn(
                                'reelshort-footer__collapsible',
                                supportOpen && 'reelshort-footer__collapsible--open',
                            )}
                            aria-hidden={!supportOpen}
                        >
                            <Link className="reelshort-footer__collapse-item" to="/page/feedback">
                                <FormattedMessage id="feedback_help" />
                            </Link>
                        </div>
                    </div>

                    <div className="reelshort-footer__copyright">
                        <FormattedMessage id="footer_copyright" values={{ year, site: BRAND_DISPLAY_NAME }} />
                    </div>
                </div>
            </div>

            {/* PC：与 H5 完全同内容、同链接；仅多栏 + Footer_* 类名。字号/间距见 reelshort-footer.scss 对标对站。 */}
            <div className="reelshort-footer__pc Footer_footer_box__Y_9Qb">
                <div className="Footer_footer__aIVZH">
                    <div className="Footer_footer_list__BY2Iy">
                        <div className="Footer_footer_item__Jzv7v">
                            <div className="Footer_item_title__7csub">
                                <FormattedMessage id="footer_about_us" />
                            </div>
                            <div className="Footer_item_sub_title__VYtUB">
                                <LegalDocumentLink title="user_agreement" className="Footer_item_sub_text__EQ_F8">
                                    <FormattedMessage id="user_agreement" />
                                </LegalDocumentLink>
                            </div>
                            <div className="Footer_item_sub_title__VYtUB">
                                <LegalDocumentLink title="privacy_policy" className="Footer_item_sub_text__EQ_F8">
                                    <FormattedMessage id="privacy_policy" />
                                </LegalDocumentLink>
                            </div>
                            <div className="Footer_item_sub_title__VYtUB">
                                <div className="reelshort-footer__pc-version-row">
                                    <span className="reelshort-footer__versionLabel">
                                        <FormattedMessage id="version" />
                                    </span>
                                    <span className="reelshort-footer__versionValue">{appVersion}</span>
                                </div>
                            </div>
                        </div>

                        <div className="Footer_footer_item__Jzv7v">
                            <div className="Footer_item_title__7csub">
                                <FormattedMessage id="footer_support_center" />
                            </div>
                            <div className="Footer_item_sub_title__VYtUB">
                                <Link to="/page/feedback" className="Footer_item_sub_text__EQ_F8">
                                    <FormattedMessage id="feedback_help" />
                                </Link>
                            </div>
                        </div>
                    </div>
                    <div className="Footer_copyright__ygL71">
                        <FormattedMessage id="footer_copyright" values={{ year, site: BRAND_DISPLAY_NAME }} />
                    </div>
                </div>
            </div>
        </footer>
    );
}
