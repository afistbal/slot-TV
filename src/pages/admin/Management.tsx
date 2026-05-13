import { api } from '@/api';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useUserStore } from '@/stores/user';
import { Videotape, SquareUser, BarChart, CircleDollarSign, BellOff } from 'lucide-react';
import { FormattedMessage } from 'react-intl';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';

const tileIcon = 'w-8 h-8 shrink-0 md:w-10 md:h-10';

export default function Component() {
    const isAdmin = useUserStore((s) => s.signed && Number(s.info?.['admin'] ?? 0) > 0);
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [cancelSubmitting, setCancelSubmitting] = useState(false);

    const tileBase = cn(
        'flex w-full min-h-[88px] flex-col items-center justify-center gap-1 rounded-lg border py-4 text-sm shadow-[0_0_0_1px_rgba(15,23,42,0.3)] transition-colors',
        'md:min-h-[128px] md:gap-2 md:py-6 md:text-base',
    );

    async function handleConfirmCancelSubscription() {
        if (cancelSubmitting) return;
        setCancelSubmitting(true);
        try {
            const res = await api('subscription/cancel', {
                method: 'post',
                loading: true,
                data: {},
            });
            if (res.c !== 0) return;
            setCancelDialogOpen(false);
            toast.success('已成功取消订阅');
            setTimeout(() => {
                window.location.assign('/');
            }, 600);
        } finally {
            setCancelSubmitting(false);
        }
    }

    return (
        <div className="min-h-full bg-black p-4 pb-8 md:p-8 md:pb-12">
            <div className="mx-auto w-full max-w-full md:max-w-3xl lg:max-w-4xl">
                <section
                    className="mb-4 hidden rounded-lg border border-slate-800 bg-slate-900/90 p-4 text-slate-200 md:block md:mb-6 md:p-5"
                    aria-label="PC 说明"
                >
                    <h2 className="mb-2 text-base font-semibold text-slate-50">管理入口（电脑端）</h2>
                    <p className="text-sm leading-relaxed text-slate-400">
                        与手机端相同：影片列表、用户、数据分析、订单、一周更新表。宽屏下卡片会放大便于点击。
                        {isAdmin ? (
                            <>
                                {' '}
                                您为管理员，第三行最右侧为「取消订阅」，将请求接口 <code className="rounded bg-slate-800 px-1 text-slate-300">subscription/cancel</code>
                                ，成功后返回首页并刷新。
                            </>
                        ) : null}
                    </p>
                </section>
                <div className="grid grid-cols-3 gap-3 sm:gap-4 md:gap-5">
                    <Link
                        to="/z/page/movie"
                        className={cn(
                            tileBase,
                            'border-slate-800 bg-slate-900 text-slate-100 hover:bg-slate-800',
                        )}
                    >
                        <Videotape className={tileIcon} />
                        <div className="px-1 text-center leading-tight">
                            <FormattedMessage id="flix_list" />
                        </div>
                    </Link>
                    <Link
                        to="/z/page/user"
                        className={cn(
                            tileBase,
                            'border-slate-800 bg-slate-900 text-slate-100 hover:bg-slate-800',
                        )}
                    >
                        <SquareUser className={tileIcon} />
                        <div className="px-1 text-center leading-tight">
                            <FormattedMessage id="users" />
                        </div>
                    </Link>
                    <Link
                        to="/z/page/analysis"
                        className={cn(
                            tileBase,
                            'border-slate-800 bg-slate-900 text-slate-100 hover:bg-slate-800',
                        )}
                    >
                        <BarChart className={tileIcon} />
                        <div className="px-1 text-center leading-tight">
                            <FormattedMessage id="analysis" />
                        </div>
                    </Link>
                    <Link
                        to="/z/page/orders"
                        className={cn(
                            tileBase,
                            'border-slate-700 bg-slate-800 text-amber-200 hover:bg-slate-700',
                        )}
                    >
                        <CircleDollarSign className={tileIcon} />
                        <div className="px-1 text-center leading-tight">
                            <FormattedMessage id="order" />
                        </div>
                    </Link>
                    <Link
                        to="/page/week-data"
                        className={cn(
                            tileBase,
                            'border-slate-700 bg-slate-800 text-cyan-200 hover:bg-slate-700',
                        )}
                    >
                        <Videotape className={tileIcon} />
                        <div className="px-1 text-center leading-tight">
                            <FormattedMessage id="weekly_update_table" />
                        </div>
                    </Link>
                    {isAdmin ? (
                        <button
                            type="button"
                            className={cn(
                                tileBase,
                                'border-slate-700 bg-slate-800 text-rose-300 hover:bg-slate-700',
                            )}
                            onClick={() => setCancelDialogOpen(true)}
                        >
                            <BellOff className={tileIcon} />
                            <div className="px-1 text-center leading-tight">取消订阅</div>
                        </button>
                    ) : null}
                </div>
            </div>
            <Dialog
                open={cancelDialogOpen}
                onOpenChange={(open) => {
                    if (!cancelSubmitting) setCancelDialogOpen(open);
                }}
            >
                <DialogContent className="overflow-x-hidden bg-white text-slate-900 sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>确认取消订阅？</DialogTitle>
                        <DialogDescription className="text-slate-600">
                            将向服务器提交取消订阅；成功后将返回首页并刷新页面。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex w-full min-w-0 max-w-full flex-col gap-3 sm:flex-row sm:flex-nowrap sm:justify-end sm:gap-2">
                        <Button
                            type="button"
                            className="order-1 w-full min-w-0 shrink-0 rounded-md bg-rose-600 text-white hover:bg-rose-700 sm:order-2 sm:w-auto sm:min-w-24"
                            disabled={cancelSubmitting}
                            onClick={handleConfirmCancelSubscription}
                        >
                            确认
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            className="order-2 w-full min-w-0 shrink-0 bg-slate-200 text-slate-800 hover:bg-slate-300 sm:order-1 sm:w-auto sm:min-w-24"
                            disabled={cancelSubmitting}
                            onClick={() => setCancelDialogOpen(false)}
                        >
                            取消
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
