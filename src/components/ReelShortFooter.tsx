import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router';
import { FormattedMessage, useIntl } from 'react-intl';
import { LegalDocumentLink } from '@/components/LegalDocumentLink';
import { BRAND_CONTACT_EMAIL, BRAND_DISPLAY_NAME, BRAND_DOMAIN_DISPLAY } from '@/constants/brand';
import { cn } from '@/lib/utils';
import '@/styles/reelshort-footer.scss';

export type ReelShortFooterProps = {
    /** H5：放在底部 Tab 上方，使用紧凑间距。 */
    dockAboveBottomTab?: boolean;
    /** Profile 等页已有反馈入口时隐藏反馈链接。 */
    hideSupportCenter?: boolean;
    hideLegalLinks?: boolean;
};

export function ReelShortFooter({
    dockAboveBottomTab = false,
    hideSupportCenter = false,
    hideLegalLinks = false,
}: ReelShortFooterProps) {
    const intl = useIntl();
    const links: Array<{ key: string; content: ReactNode }> = [];
    if (!hideLegalLinks) {
        links.push(
            { key: 'terms', content: <LegalDocumentLink title="terms_of_service"><FormattedMessage id="footer_pc_terms" /></LegalDocumentLink> },
            { key: 'privacy', content: <LegalDocumentLink title="privacy_policy"><FormattedMessage id="footer_pc_privacy" /></LegalDocumentLink> },
            { key: 'refund', content: <LegalDocumentLink title="refund_policy"><FormattedMessage id="shopping_tips_link_refund" /></LegalDocumentLink> },
        );
    }
    if (!hideSupportCenter) {
        links.push({ key: 'feedback', content: <Link to="/profile?tab=feedback"><FormattedMessage id="footer_pc_feedback" /></Link> });
    }
    links.push({ key: 'contact', content: <a href={`mailto:${BRAND_CONTACT_EMAIL}`} title={BRAND_CONTACT_EMAIL}><FormattedMessage id="footer_pc_contact" /></a> });

    return (
        <footer className={cn('reelshort-footer', dockAboveBottomTab && 'reelshort-footer--dock-tab')}>
            <div className="reelshort-footer__inner">
                <nav className="reelshort-footer__links" aria-label={intl.formatMessage({ id: 'footer_links', defaultMessage: '页脚链接' })}>
                    {links.map(({ key, content }, index) => <Fragment key={key}>
                        {index > 0 ? <span className="reelshort-footer__separator" aria-hidden>·</span> : null}
                        {content}
                    </Fragment>)}
                </nav>
                <div className="reelshort-footer__copyright">
                    <span>© {new Date().getFullYear()} {BRAND_DISPLAY_NAME}</span>
                    <span className="reelshort-footer__separator" aria-hidden>·</span>
                    <span>{BRAND_DOMAIN_DISPLAY.toLowerCase()}</span>
                    <span className="reelshort-footer__separator" aria-hidden>·</span>
                    <span><FormattedMessage id="version" /> {__APP_VERSION__}</span>
                </div>
            </div>
        </footer>
    );
}
