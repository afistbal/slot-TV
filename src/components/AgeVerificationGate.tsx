import { useEffect, useState, type ReactNode } from 'react';
import { BRAND_DISPLAY_NAME, BRAND_TOPNAV_WORDMARK_SRC } from '@/constants/brand';
import { LegalDocumentLink } from '@/components/LegalDocumentLink';
import { useRootStore } from '@/stores/root';
import '@/styles/age-verification-gate.scss';

const AGE_VERIFIED_STORAGE_KEY = 'slot:age-verified:18-plus';

const AGE_GATE_COPY = {
    'zh-CN': {
        title: '成人内容 · 年龄验证',
        description:
            '本网站包含成人内容，仅限年满 18 周岁（或您所在地区规定的法定成年年龄）的人士访问。进入本网站即表示您确认自己已成年，并同意我们的服务条款。',
        enter: '我已年满 18 岁 — 进入',
        leave: '未满 18 岁 — 离开',
        terms: '服务条款',
        privacy: '隐私政策',
        legalLabel: '法律条款',
    },
    'zh-TW': {
        title: '成人內容 · 年齡驗證',
        description:
            '本網站包含成人內容，僅限年滿 18 歲（或您所在地區規定的法定成年年齡）的人士瀏覽。進入本網站即表示您確認自己已成年，並同意我們的服務條款。',
        enter: '我已年滿 18 歲 — 進入',
        leave: '未滿 18 歲 — 離開',
        terms: '服務條款',
        privacy: '隱私政策',
        legalLabel: '法律條款',
    },
} as const;

function hasVerifiedAge(): boolean {
    try {
        return window.localStorage.getItem(AGE_VERIFIED_STORAGE_KEY) === '1';
    } catch {
        return false;
    }
}

export function AgeVerificationGate({ children }: { children: ReactNode }) {
    const [verified, setVerified] = useState(hasVerifiedAge);
    const locale = useRootStore((state) => state.locale);
    const copy = AGE_GATE_COPY[locale === 'zh-TW' ? 'zh-TW' : 'zh-CN'];

    useEffect(() => {
        if (verified) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [verified]);

    function handleEnter() {
        try {
            window.localStorage.setItem(AGE_VERIFIED_STORAGE_KEY, '1');
        } catch {
            // Storage may be unavailable in private browsing; allow this page view in memory.
        }
        setVerified(true);
    }

    function handleLeave() {
        window.location.replace('https://www.google.com/');
    }

    if (verified) return children;

    return (
        <main className="age-verification-gate">
            <section
                className="age-verification-gate__card"
                role="dialog"
                aria-modal="true"
                aria-labelledby="age-verification-title"
                aria-describedby="age-verification-description"
            >
                <img
                    className="age-verification-gate__logo"
                    src={BRAND_TOPNAV_WORDMARK_SRC}
                    alt={BRAND_DISPLAY_NAME}
                    width={280}
                    height={80}
                />

                <div className="age-verification-gate__badge" aria-hidden="true">
                    18+
                </div>

                <div className="age-verification-gate__copy">
                    <h1 id="age-verification-title">{copy.title}</h1>
                    <p id="age-verification-description">{copy.description}</p>
                </div>

                <button type="button" className="age-verification-gate__enter" onClick={handleEnter} autoFocus>
                    {copy.enter}
                </button>

                <button type="button" className="age-verification-gate__leave" onClick={handleLeave}>
                    {copy.leave}
                </button>

                <nav className="age-verification-gate__legal" aria-label={copy.legalLabel}>
                    <LegalDocumentLink title="terms_of_service">{copy.terms}</LegalDocumentLink>
                    <span aria-hidden="true">·</span>
                    <LegalDocumentLink title="privacy_policy">{copy.privacy}</LegalDocumentLink>
                </nav>
            </section>
        </main>
    );
}
