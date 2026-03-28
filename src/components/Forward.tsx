import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Forward({ className, reversed }: { className?: string, reversed?: boolean }) {
    return document.body.style.direction === 'ltr' && reversed !== true ? <ChevronRight className={className} /> : <ChevronLeft className={className} />
}