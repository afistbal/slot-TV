import { Crown, Lock } from 'lucide-react';
import { FormattedMessage } from 'react-intl';
import { cn } from '@/lib/utils';

/**
 * 非当前播放格占位：滑动经过时用深色底 + 文案即可。
 * VIP 锁集：琥珀底 + 皇冠/锁角标，与普通集区分。
 * 不用剧封 `object-cover` 铺满（会与竖屏视频「一整张图」观感混淆）；封面仅在 Player 内「拉剧集接口」时展示。
 */
export function VideoReelSlideBackdrop({
    episodeCurrent,
    episodeTotal,
    vipLocked,
    className,
}: {
    episodeCurrent: number;
    episodeTotal: number;
    /** 列表 meta：VIP 且锁集 */
    vipLocked?: boolean;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'pointer-events-none absolute inset-0 z-0 flex flex-col',
                vipLocked
                    ? 'bg-gradient-to-b from-amber-950 via-[#0f0805] to-black'
                    : 'bg-black',
                className,
            )}
        >
            <div
                className={cn(
                    'absolute inset-0',
                    vipLocked
                        ? 'bg-[radial-gradient(ellipse_75%_55%_at_50%_38%,rgba(217,119,6,0.28),rgba(0,0,0,0.92))]'
                        : 'bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(39,39,42,0.55),rgba(0,0,0,0.95))]',
                )}
                aria-hidden
            />
            <div className="relative z-[1] flex flex-1 flex-col items-center justify-center gap-4 px-6">
                {vipLocked ? (
                    <div className="flex items-center gap-2 rounded-full border border-amber-400/45 bg-black/40 px-4 py-2 backdrop-blur-sm">
                        <Crown className="h-6 w-6 text-amber-300" strokeWidth={1.75} />
                        <Lock className="h-5 w-5 text-amber-200/90" strokeWidth={2} />
                    </div>
                ) : null}
                <div
                    className={cn(
                        'max-w-[85%] text-center text-base font-medium tracking-wide',
                        vipLocked ? 'text-amber-100/85' : 'text-white/45',
                    )}
                >
                    <FormattedMessage id="episode" /> {episodeCurrent} / {episodeTotal}
                </div>
                {vipLocked ? (
                    <div className="max-w-[90%] text-center text-sm font-medium text-amber-200/75">
                        <FormattedMessage
                            id="video_reel_vip_locked_hint"
                            defaultMessage="VIP 专享剧集，滑动继续浏览"
                        />
                    </div>
                ) : null}
            </div>
        </div>
    );
}
