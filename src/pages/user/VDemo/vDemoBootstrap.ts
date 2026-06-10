/**
 * v-demo 实验壳自举：写死 dev token + 拉 config.static（与 for-demo 解耦）。
 */
import { api, type TData } from '@/api';
import { useConfigStore } from '@/stores/config';

const V_DEMO_DEV_TOKEN =
    '272|GpUcG1IqLPXskpfkB95rp0RNy13MFJMqJAIaBL7G585d635d';

let bootstrapPromise: Promise<void> | null = null;

export function ensureVDemoBootstrap(): Promise<void> {
    if (!bootstrapPromise) {
        bootstrapPromise = (async () => {
            localStorage.setItem('token', V_DEMO_DEV_TOKEN);

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
