import { matchPath } from 'react-router';

const SEARCH_FAMILY_PATHS = [
    '/search',
    '/categories',
    '/tagSearch',
    '/:locale/search',
    '/:locale/categories',
    '/:locale/tagSearch',
] as const;

/** `/search`、`/categories`、`/tagSearch`（含 locale 前缀） */
export function matchSearchFamilyPath(pathname: string): boolean {
    return SEARCH_FAMILY_PATHS.some((p) => matchPath({ path: p, end: true }, pathname) != null);
}

export function matchCategoriesPath(pathname: string): boolean {
    return (
        matchPath({ path: '/categories', end: true }, pathname) != null ||
        matchPath({ path: '/:locale/categories', end: true }, pathname) != null
    );
}

export function matchTagSearchPath(pathname: string): boolean {
    return (
        matchPath({ path: '/tagSearch', end: true }, pathname) != null ||
        matchPath({ path: '/:locale/tagSearch', end: true }, pathname) != null
    );
}

export function matchSearchOnlyPath(pathname: string): boolean {
    return (
        matchPath({ path: '/search', end: true }, pathname) != null ||
        matchPath({ path: '/:locale/search', end: true }, pathname) != null
    );
}

export type SearchPageType = 'search' | 'categories' | 'tagSearch';

export function resolveSearchPageType(pathname: string): SearchPageType {
    if (matchCategoriesPath(pathname)) {
        return 'categories';
    }
    if (matchTagSearchPath(pathname)) {
        return 'tagSearch';
    }
    return 'search';
}
