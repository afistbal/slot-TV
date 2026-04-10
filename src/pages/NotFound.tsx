import notFoundImg from '@/assets/images/98f35500-5ae1-11ef-838e-777d81c2a9c7.webp';
import { Link } from 'react-router';
import { ReelShortTopNav } from '@/components/ReelShortTopNav';
import { useEffect, useRef, useState } from 'react';
import { FormattedMessage } from 'react-intl';
import { api } from '@/api';
import { skipRemoteApi } from '@/env';
import { useConfigStore } from '@/stores/config';
import { HomeBookItem, type HomeBookItemData } from '@/components/home/HomeBookItem';
import type { IData } from '@/stores/home';
import { ReelShortFooter } from '@/components/ReelShortFooter';
import { cn } from '@/lib/utils';

function normalizeEpisodeSlug(raw?: string) {
  if (!raw) return undefined;
  let v = String(raw).trim();
  if (!v) return undefined;

  if (v.startsWith('http://') || v.startsWith('https://')) {
    try {
      const u = new URL(v);
      v = u.pathname;
    } catch {
      // ignore
    }
  }

  v = v.replace(/^[#/]/, '');
  const m = v.match(/(?:^|\/)episodes\/([^/?#]+)$/i);
  if (m) return decodeURIComponent(m[1]);
  if (v.startsWith('episodes/')) return decodeURIComponent(v.slice('episodes/'.length));
  return decodeURIComponent(v);
}

function toEpisodeOrVideoHref(item: { id: number; episodeSlug?: string }) {
  const slug = normalizeEpisodeSlug(item.episodeSlug);
  return slug ? `/episodes/${slug}` : `/video/${item.id}`;
}

function itemsFromHomeRail(items: IData['recommend']): HomeBookItemData[] {
  return (items ?? []).map((v) => ({
    id: v.id,
    title: v.title,
    image: v.image,
    episodeSlug: normalizeEpisodeSlug(
      // @ts-expect-error - keep compatibility with snake_case payloads
      v.episodeSlug ?? v.episode_slug ?? v.episodeHref ?? v.episode_href ?? v.episodeUrl ?? v.episode_url,
    ),
    // @ts-expect-error - keep compatibility with snake_case payloads
    movieSlug: v.movieSlug ?? v.movie_slug,
    views: v.views,
    currentEp: v.currentEp,
    totalEp: v.totalEp,
    progressPercent: v.progressPercent,
    showPlayMask: v.showPlayMask,
    showExpo: v.showExpo,
  }));
}

export default function Component() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const configStore = useConfigStore();
  const [recommend, setRecommend] = useState<HomeBookItemData[]>([]);

  useEffect(() => {
    if (skipRemoteApi) {
      setRecommend([]);
      return;
    }
    api<IData>('home', { loading: false }).then((res) => {
      setRecommend(itemsFromHomeRail(res.d?.recommend ?? []));
    });
  }, []);

  return (
    <div className="flex h-full flex-col bg-app-canvas text-white">
      <div className="min-w-0 flex-1 overflow-y-auto" ref={scrollRef}>
        <ReelShortTopNav scrollParentRef={scrollRef} showSearch={true} />

        <div className="flex flex-col items-center justify-center px-6 py-10">
          <img
            src={notFoundImg}
            alt=""
            className="w-[min(40vw,180px)] max-w-full select-none"
            draggable={false}
          />
          <div className="mt-6 text-center text-white/80">
            <FormattedMessage id="page_not_found" />
          </div>
          <Link
            to="/"
            className="mt-6 inline-flex h-12 w-[min(72vw,320px)] items-center justify-center rounded-md bg-[#ff3b5c] text-lg font-semibold text-white/90"
          >
            <FormattedMessage id="home" />
          </Link>
        </div>

        <div className="rs-notfound-like">
          <div className="HomePage_main__BzEnK">
            <div data-uistyle="5" className="HomePage_bookShelf__W2tPD">
              <div className="HomePage_shelfHead">
                <h2>
                  <Link to="/">
                    <FormattedMessage id="you_might_like" />
                  </Link>
                </h2>
              </div>
              <div className="HomePage_content__DZ4dU HomePage_type_5__SK5Rv">
                {[0, 1, 2].map((col) => (
                  <div key={col} className={cn('HomePage_colunm__1XbhV', col === 2 && 'rs-notfound-like__colLast')}>
                    {recommend.filter((_, idx) => idx % 3 === col).map((item) => (
                      <HomeBookItem
                        key={item.id}
                        to={toEpisodeOrVideoHref(item)}
                        staticBase={(configStore.config['static'] as string) ?? ''}
                        item={{ ...item, showExpo: true, showPlayMask: false }}
                        variant="style5"
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <ReelShortFooter />
        </div>
      </div>
    </div>
  );
}

