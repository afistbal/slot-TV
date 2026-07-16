function readDocumentReload(): boolean {
    if (typeof performance === 'undefined') {
        return false;
    }
    const entry = performance.getEntriesByType('navigation')[0] as
        | PerformanceNavigationTiming
        | undefined;
    return entry?.type === 'reload';
}

export const DOCUMENT_INITIAL_PATHNAME =
    typeof window !== 'undefined' ? window.location.pathname : '';

export const DOCUMENT_INITIAL_IS_RELOAD =
    typeof window !== 'undefined' && readDocumentReload();
