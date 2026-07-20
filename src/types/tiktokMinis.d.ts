interface TikTokMinisLoginResult {
  authResponse?: {
    code?: unknown;
  };
  error?: unknown;
}

interface TikTokMinisSdk {
  init(options: { clientKey: string }): void;
  login(callback: (result: TikTokMinisLoginResult) => void): void;
}

interface Window {
  TTMinis?: TikTokMinisSdk;
}

declare const TTMinis: TikTokMinisSdk;
