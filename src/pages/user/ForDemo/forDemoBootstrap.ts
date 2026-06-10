/**
 * for-demo 实验壳自举：写死 dev token + 拉 config.static。
 * 仅用于 /for-demo 局域网/iOS 测播放器，与全站 App 登录链解耦。
 */
import { api, type TData } from '@/api';
import { useConfigStore } from '@/stores/config';

/** 实验用 token（用户指定，勿用于生产页） */
export const FOR_DEMO_DEV_TOKEN =
    '272|GpUcG1IqLPXskpfkB95rp0RNy13MFJMqJAIaBL7G585d635d';

let bootstrapPromise: Promise<void> | null = null;

export function ensureForDemoBootstrap(): Promise<void> {
    if (!bootstrapPromise) {
        bootstrapPromise = (async () => {
            localStorage.setItem('token', FOR_DEMO_DEV_TOKEN);

            const configStore = useConfigStore.getState();
            if (configStore.config['static']) {
                return;
            }

            const cfg = await api<TData>('config', {
                loading: false,
                toastOnError: false,
            });
            if (cfg.c !== 0) {
                bootstrapPromise = null;
                throw new Error(cfg.m || 'config failed');
            }
            configStore.setConfig(cfg.d);
        })();
    }
    return bootstrapPromise;
}
