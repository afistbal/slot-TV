import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { FormattedMessage } from 'react-intl';
import { cn } from '@/lib/utils';
import { BRAND_DISPLAY_NAME } from '@/constants/brand';

const DRAMA_WORLD_VIDEO = 'https://v-mps.crazymaplestudios.com/activity/mp4/10001_0100.mp4';
const DRAMA_WORLD_LOGO = new URL('../assets/images/211d3420-d721-11f0-84ad-6b5693b490dc.png', import.meta.url).toString();

export function ReelShortDramaWorldDialog({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                aria-describedby={undefined}
                className={cn(
                    /* 占满视口宽度，覆盖默认 max-w-lg / translate 居中窄条 */
                    '!left-0 !right-0 !mx-0 !w-full !max-w-none !translate-x-0',
                    'top-[50%] !-translate-y-1/2',
                    'gap-0 overflow-hidden rounded-none border-x-0 border-b-0 border-t border-white/10 bg-app-surface p-0',
                    'sm:border sm:border-white/10 sm:rounded-lg',
                    'data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100',
                )}
            >
                <DialogTitle className="sr-only">
                    <FormattedMessage id="nav_brand" />
                </DialogTitle>
                <div
                    className="relative w-full bg-black"
                    style={{
                        aspectRatio: '16 / 9',
                        maxHeight: 'min(85svh, calc(0.5625 * min(100vw, 960px)))',
                    }}
                >
                    <video
                        className="absolute inset-0 h-full w-full object-contain"
                        controls
                        playsInline
                        preload="metadata"
                        src={DRAMA_WORLD_VIDEO}
                    />
                    <div
                        className="pointer-events-none absolute left-0 right-0 top-0 z-[100] flex h-[70px] px-[18px] py-[14px]"
                        style={{
                            borderRadius: '8px 8px 0 0',
                            background: 'linear-gradient(rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0) 100%)',
                        }}
                    >
                        <div className="relative mr-2 h-[22px] w-[22px] shrink-0">
                            <span className="relative block h-[22px] w-[22px] overflow-hidden">
                                <img
                                    src={DRAMA_WORLD_LOGO}
                                    alt=""
                                    className="absolute inset-0 m-auto h-full w-full max-h-full max-w-full object-contain"
                                    decoding="async"
                                />
                            </span>
                        </div>
                        <span className="line-clamp-1 h-[22px] text-base leading-[22px] text-white">
                            {BRAND_DISPLAY_NAME}{' '}
                            <span className="text-white/90">
                                <FormattedMessage id="nav_brand_video_caption" />
                            </span>
                        </span>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
