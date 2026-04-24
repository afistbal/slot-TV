import type { ReactNode } from "react";
import { Link } from "react-router";
import { useMinWidth768 } from "@/hooks/useMinWidth768";
import { legalDocumentAbsoluteUrl, legalDocumentPath, type LegalDocTitle } from "@/lib/legalDocumentUrl";

export function LegalDocumentLink({
    title,
    className,
    children,
}: {
    title: LegalDocTitle;
    className?: string;
    children: ReactNode;
}) {
    const mdUp = useMinWidth768();

    if (mdUp) {
        return (
            <a href={legalDocumentAbsoluteUrl(title)} target="_blank" rel="noopener noreferrer" className={className}>
                {children}
            </a>
        );
    }
    return (
        <Link to={legalDocumentPath(title)} className={className}>
            {children}
        </Link>
    );
}
