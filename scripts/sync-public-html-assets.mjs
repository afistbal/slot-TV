import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** 与 `vite.config.ts` 中 `patchHtmlAssetRefs` 保持一致：本地静态资源加 `?v=` 清缓存。 */
const ASSET_REF_RE =
    /(href|src)="(\/(?:favorite\.svg|logo\.png|icons\/192\.png|icons\/512\.png|manifest\.json))(?:\?[^"#]*)?"/g;

export function patchHtmlAssetRefsString(html, version) {
    const q = `?v=${encodeURIComponent(version)}`;
    return html.replace(ASSET_REF_RE, (_m, attr, p) => `${attr}="${p}${q}"`);
}

const PUBLIC_HTML_FILES = ['public/reelshort-privacy-policy.html', 'public/airwallex.html'];

export async function patchPublicHtmlFiles(version) {
    const v = String(version ?? '').trim();
    if (!v) {
        throw new Error('patchPublicHtmlFiles: empty version');
    }
    for (const rel of PUBLIC_HTML_FILES) {
        const fp = resolve(process.cwd(), rel);
        const raw = await readFile(fp, 'utf8');
        const next = patchHtmlAssetRefsString(raw, v);
        if (next !== raw) {
            await writeFile(fp, next, 'utf8');
        }
    }
}

async function main() {
    const packageJsonPath = resolve(process.cwd(), 'package.json');
    const pkg = JSON.parse(await readFile(packageJsonPath, 'utf8'));
    await patchPublicHtmlFiles(pkg.version ?? '0.0.0');
    console.log('[assets] public/*.html icon refs synced to package.json version');
}

if (pathToFileURL(resolve(process.argv[1] ?? '')).href === import.meta.url) {
    await main();
}
