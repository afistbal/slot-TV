import type { ReactNode } from "react";
import { legalDocumentAbsoluteUrl, type LegalDocTitle } from "@/lib/legalDocumentUrl";

export function LegalDocumentLink({
    title,
    className,
    children,
}: {
    title: LegalDocTitle;
    className?: string;
    children: ReactNode;
}) {
    return (
        <a href={legalDocumentAbsoluteUrl(title)} target="_blank" rel="noopener noreferrer" className={className}>
            {children}
        </a>
    );
}
