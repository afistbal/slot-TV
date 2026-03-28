

export function emailVerify(email: string): boolean {
    return /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(email.trim());
}

export function emailMask(email: string) {
    const [localPart, domain] = email.split('@');
    if (localPart.length <= 4) {
        return email;
    }
    const maskedPart = localPart.slice(2, -2).replace(/./g, '*');
    return `${localPart.slice(0, 2)}${maskedPart}${localPart.slice(-2)}@${domain}`;
}