import type { ReactNode } from "react";
import { isTikTokPlatform } from "@/platform";
import {
    legalDocumentAbsoluteUrl,
    legalDocumentPath,
    type LegalDocTitle,
} from "@/lib/legalDocumentUrl";

export function LegalDocumentLink({
    title,
    className,
    children,
}: {
    title: LegalDocTitle;
    className?: string;
    children: ReactNode;
}) {
    if (isTikTokPlatform()) {
        return (
            <a href={legalDocumentPath(title)} className={className}>
                {children}
            </a>
        );
    }

    return (
        <a href={legalDocumentAbsoluteUrl(title)} target="_blank" rel="noopener noreferrer" className={className}>
            {children}
        </a>
    );
}
