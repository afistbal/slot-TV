import { useConfigStore } from '@/stores/config';

type RuntimeConfig = Record<string, unknown>;

function firstText(config: RuntimeConfig, keys: string[], fallback: string): string {
    for (const key of keys) {
        const value = config[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return fallback.trim();
}

function withoutTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '');
}

export type SupportChatConfig = {
    apiBaseUrl: string;
    uploadBaseUrl: string;
    websocketUrl: string;
};

/**
 * 客服地址优先读取启动接口下发的配置，环境变量只作为部署级回退。
 * 兼容旧客服配置名，便于同一套后端平滑迁移到 React 页面。
 */
export function getSupportChatConfig(): SupportChatConfig {
    const config = useConfigStore.getState().config;
    return {
        websocketUrl: firstText(
            config,
            ['support_chat_ws_url', 'chat_base_url', 'chatBaseUrl'],
            String(import.meta.env.VITE_SUPPORT_CHAT_WS_URL ?? ''),
        ),
        apiBaseUrl: withoutTrailingSlash(firstText(
            config,
            ['support_chat_api_url', 'chat_api_base_url', 'chatApiBaseUrl'],
            String(import.meta.env.VITE_SUPPORT_CHAT_API_URL ?? ''),
        )),
        uploadBaseUrl: withoutTrailingSlash(firstText(
            config,
            ['support_chat_upload_url', 'upload_base_url', 'chatUploadBaseUrl'],
            String(import.meta.env.VITE_SUPPORT_CHAT_UPLOAD_URL ?? ''),
        )),
    };
}
