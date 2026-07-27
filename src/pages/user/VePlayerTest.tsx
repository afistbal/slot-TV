import { useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_VID = 'v25b90gm0018d9gquj2tgd691neu8op0';

function errorMessage(error: unknown): string {
    if (error instanceof Error) return `${error.name}: ${error.message}`;
    if (typeof error === 'string') return error;
    try {
        return JSON.stringify(error, null, 2);
    } catch {
        return String(error);
    }
}

export default function VePlayerTest() {
    const playerRef = useRef<TikTokVePlayerInstance | null>(null);
    const [status, setStatus] = useState('正在获取 TikTok VePlayer…');
    const [error, setError] = useState('');
    const vid = useMemo(() => {
        const queryVid = new URLSearchParams(window.location.search).get('vid')?.trim();
        return queryVid || DEFAULT_VID;
    }, []);

    useEffect(() => {
        let disposed = false;

        async function createPlayer() {
            const sdk = window.TTMinis;
            if (!sdk) throw new Error('window.TTMinis 不存在，请在 TikTok 小程序真机中打开。');
            if (typeof sdk.getPlayer !== 'function') {
                throw new Error('当前 TikTok 客户端不支持 TTMinis.getPlayer。');
            }

            const VePlayer = await sdk.getPlayer('byteplus');
            if (disposed) return;

            playerRef.current = new VePlayer({
                id: 'tiktok-veplayer-test-container',
                vid,
                lang: 'en',
                closeVideoClick: false,
                closeVideoDblclick: true,
                videoFillMode: 'fillWidth',
            });
            setStatus('VePlayer 已创建，只传了 vid。若画面能播放，说明该 vid 可直接使用。');
        }

        void createPlayer().catch((reason: unknown) => {
            if (disposed) return;
            setStatus('VePlayer 创建或播放失败。');
            setError(errorMessage(reason));
        });

        return () => {
            disposed = true;
            try {
                playerRef.current?.destroy();
            } catch {
                // This is only a diagnostic page; teardown errors can be ignored.
            }
            playerRef.current = null;
        };
    }, [vid]);

    function play() {
        const player = playerRef.current;
        if (!player) return;
        try {
            const result = typeof player.play === 'function'
                ? player.play()
                : player.player?.play?.();
            if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
                void Promise.resolve(result).catch((reason: unknown) => setError(errorMessage(reason)));
            }
        } catch (reason) {
            setError(errorMessage(reason));
        }
    }

    return (
        <main className="min-h-screen bg-black p-4 text-white">
            <h1 className="text-xl font-semibold">TikTok VePlayer 单 VID 测试</h1>
            <p className="mt-2 break-all text-sm text-white/70">vid：{vid}</p>
            <div
                id="tiktok-veplayer-test-container"
                className="mt-4 aspect-[9/16] w-full max-w-md overflow-hidden bg-white/10"
            />
            <button
                type="button"
                onClick={play}
                className="mt-4 rounded bg-red-500 px-4 py-2 font-medium"
            >
                手动播放
            </button>
            <p className="mt-4 whitespace-pre-wrap text-sm">{status}</p>
            {error ? (
                <pre className="mt-3 overflow-auto whitespace-pre-wrap rounded bg-red-950 p-3 text-xs text-red-200">
                    {error}
                </pre>
            ) : null}
        </main>
    );
}
