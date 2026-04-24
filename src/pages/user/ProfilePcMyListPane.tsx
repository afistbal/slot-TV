import UserFavorite from '@/pages/user/Favorite';
import UserHistory from '@/pages/user/History';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FormattedMessage } from 'react-intl';
import { cn } from '@/lib/utils';

export type ProfileMyListSubTab = 'favorite' | 'history';

type Props = {
    subTab: ProfileMyListSubTab;
    onSubTabChange: (v: ProfileMyListSubTab) => void;
    /** PC /profile：侧栏已分「My List / Watch history」时隐藏顶部重复 Tabs */
    hideSubTabs?: boolean;
};

/**
 * PC /profile 右栏：与全页 `/my-list` 相同的「收藏 | 观看历史」Tab，内容复用 Favorite / History。
 */
export function ProfilePcMyListPane({ subTab, onSubTabChange, hideSubTabs }: Props) {
    if (hideSubTabs) {
        return (
            <div className="rs-profile__pc-my-list flex min-h-0 min-w-0 flex-1 flex-col text-white">
                <div
                    className={cn(
                        'rs-profile__pc-my-list-body flex min-h-0 min-w-0 flex-1 flex-col',
                        'rs-profile__pc-my-list-body--cabinet',
                    )}
                >
                    <div className="rs-profile__pc-cabinet">
                        {subTab === 'favorite' ? (
                            <UserFavorite variant="cabinet" />
                        ) : (
                            <UserHistory variant="cabinet" />
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="rs-profile__pc-my-list flex min-h-0 min-w-0 flex-1 flex-col text-white">
            <Tabs
                value={subTab}
                onValueChange={(v) => onSubTabChange(v as ProfileMyListSubTab)}
                className="flex min-h-0 min-w-0 flex-1 flex-col"
            >
                <TabsList className="rs-profile__pc-my-list-tabs flex w-full shrink-0 flex-wrap items-stretch justify-start gap-x-8 gap-y-2 rounded-none border-0 border-b border-white/10 bg-black p-4 pb-[calc(1.5rem+2px)] text-sm shadow-none">
                    <TabsTrigger
                        value="favorite"
                        className="rs-my-list__tabTrigger rounded-none border-0 bg-transparent px-0 py-1 text-inherit font-normal leading-normal text-white/60 shadow-none ring-offset-0 transition-colors hover:text-white/80 data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none"
                    >
                        <FormattedMessage id="my_list" />
                    </TabsTrigger>
                    <TabsTrigger
                        value="history"
                        className="rs-my-list__tabTrigger rounded-none border-0 bg-transparent px-0 py-1 text-inherit font-normal leading-normal text-white/60 shadow-none ring-offset-0 transition-colors hover:text-white/80 data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none"
                    >
                        <FormattedMessage id="nav_watch_history" />
                    </TabsTrigger>
                </TabsList>
                <div className="rs-profile__pc-my-list-body flex min-h-0 min-w-0 flex-1 flex-col">
                    {subTab === 'favorite' ? <UserFavorite /> : <UserHistory />}
                </div>
            </Tabs>
        </div>
    );
}
