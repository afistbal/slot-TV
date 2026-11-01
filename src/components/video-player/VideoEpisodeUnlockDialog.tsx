import { useEffect, useState } from 'react';
import { Crown, LockKeyhole, X } from 'lucide-react';
import { toast } from 'sonner';

import { api } from '@/api';
import { LegacyCoinIcon as Coins } from '@/components/LegacyCoinIcon';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useUserStore } from '@/stores/user';
import type { IPlayerEpisode } from '@/types/videoPlayer';
import '@/styles/video-episode-unlock.scss';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    episodeRowId: number;
    episode?: IPlayerEpisode;
    onUnlocked: (episode: IPlayerEpisode) => void;
    onTopUp: (tab: 'coins' | 'vip') => void;
};

export function VideoEpisodeUnlockDialog({
    open,
    onOpenChange,
    title,
    episodeRowId,
    episode,
    onUnlocked,
    onTopUp,
}: Props) {
    const storedBalance = useUserStore((state) => state.balance);
    const [balance, setBalance] = useState(storedBalance);
    const [unlocking, setUnlocking] = useState(false);
    const price = Math.max(0, Number(episode?.unlock_coins ?? 0));
    const episodeNo = Math.max(1, Number(episode?.episode ?? 1));
    const shortage = Math.max(0, price - balance);

    useEffect(() => {
        if (!open) return;
        setBalance(useUserStore.getState().balance);
        void api<number>('user/balance', { loading: false, toastOnError: false }).then((result) => {
            if (result.c !== 0 || !Number.isFinite(Number(result.d))) return;
            const nextBalance = Number(result.d);
            setBalance(nextBalance);
            useUserStore.getState().setBalance(nextBalance);
        });
    }, [open, episodeRowId]);

    async function unlockCurrentEpisode() {
        if (unlocking || episodeRowId <= 0) return;
        if (shortage > 0) {
            onTopUp('coins');
            return;
        }
        setUnlocking(true);
        try {
            const result = await api<IPlayerEpisode>('movie/episode', {
                data: { id: episodeRowId, auto_unlock: 1 },
                loading: false,
                toastOnError: false,
            });
            if (result.c !== 0 || !result.d || result.d.lock) {
                toast.info(balance < price ? '金币不足，请先充值' : (result.m || '暂时无法解锁，请稍后重试'));
                if (balance < price) onTopUp('coins');
                return;
            }
            const nextBalance = Math.max(0, balance - price);
            setBalance(nextBalance);
            useUserStore.getState().setBalance(nextBalance);
            toast.success(`第 ${episodeNo} 集已解锁`);
            onUnlocked(result.d);
            onOpenChange(false);
        } finally {
            setUnlocking(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                contentPreset="plain"
                hideCloseButton
                className="video-unlock-dialog"
                overlayClassName="video-unlock-dialog__overlay"
            >
                <DialogTitle className="sr-only">解锁本集</DialogTitle>
                <DialogDescription className="sr-only">使用金币解锁当前付费剧集</DialogDescription>
                <button
                    type="button"
                    className="video-unlock-dialog__close"
                    aria-label="关闭"
                    onClick={() => onOpenChange(false)}
                >
                    <X />
                </button>
                <div className="video-unlock-dialog__eyebrow">解锁本集</div>
                <h2 className="video-unlock-dialog__title">{title} · EP.{String(episodeNo).padStart(2, '0')}</h2>
                <div className="video-unlock-dialog__price">
                    <strong>{price}</strong>
                    <span><Coins />金币</span>
                </div>
                <p className="video-unlock-dialog__balance">余额 <b>{balance}</b> · 解锁后可永久观看</p>
                {shortage > 0 ? <p className="video-unlock-dialog__shortage">还差 {shortage} 金币</p> : null}
                <p className="video-unlock-dialog__refund">购买后不支持退款</p>
                <button
                    type="button"
                    className="video-unlock-dialog__primary"
                    disabled={unlocking}
                    onClick={() => void unlockCurrentEpisode()}
                >
                    {shortage > 0 ? <Coins /> : <LockKeyhole />}
                    {unlocking ? '正在解锁…' : shortage > 0 ? '充值金币并解锁' : '立即解锁观看'}
                </button>
                <button
                    type="button"
                    className="video-unlock-dialog__secondary"
                    onClick={() => onTopUp('coins')}
                >
                    <Coins />充值金币，解锁更多剧集
                </button>
                <button
                    type="button"
                    className="video-unlock-dialog__vip"
                    onClick={() => onTopUp('vip')}
                >
                    <Crown />
                    <span>开通会员：会员剧集畅看，专属权益更多</span>
                </button>
                <button type="button" className="video-unlock-dialog__later" onClick={() => onOpenChange(false)}>
                    下次再说
                </button>
            </DialogContent>
        </Dialog>
    );
}
