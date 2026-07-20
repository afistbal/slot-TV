import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router';
import { LegalDocumentLink } from '@/components/LegalDocumentLink';
import { FormattedMessage } from 'react-intl';
import '@/styles/tiktok-terms-policy.scss';

const rows = [
    { title: 'terms_of_service', legalTitle: 'terms_of_service' as const },
    { title: 'shopping_tips_link_refund', legalTitle: 'refund_policy' as const },
    { title: 'privacy_policy', legalTitle: 'privacy_policy' as const },
];

export default function TikTokTermsPolicy() {
    const navigate = useNavigate();
    const direction = document.body.style.direction === 'rtl' ? 'rtl' : 'ltr';

    return (
        <main className="tiktok-terms-policy" dir={direction}>
            <header className="tiktok-terms-policy__header">
                <button
                    type="button"
                    className="tiktok-terms-policy__back"
                    onClick={() => navigate(-1)}
                    aria-label="Back"
                >
                    {direction === 'rtl' ? <ChevronRight /> : <ChevronLeft />}
                </button>
                <h1>Terms &amp; Policy</h1>
            </header>
            <section className="tiktok-terms-policy__card" aria-label="Terms and policy">
                {rows.map((row) => (
                    <LegalDocumentLink
                        key={row.legalTitle}
                        title={row.legalTitle}
                        className="tiktok-terms-policy__row"
                    >
                        <span><FormattedMessage id={row.title} /></span>
                        <ChevronRight aria-hidden />
                    </LegalDocumentLink>
                ))}
            </section>
        </main>
    );
}
