interface TikTokMinisLoginResult {
  authResponse?: {
    code?: unknown;
  };
  error?: unknown;
}

interface TikTokMinisPaymentResult {
  is_success?: boolean;
  trade_order_id?: string;
  error?: unknown;
}

interface TikTokRewardedVideoAd {
  show(): Promise<unknown>;
  onClose(callback: (result: { isEnded: boolean }) => void): void;
  offClose?(callback: (result: { isEnded: boolean }) => void): void;
  onError(callback: (error?: unknown) => void): void;
  offError?(callback: (error?: unknown) => void): void;
}

interface TikTokVePlayerOptions {
  id: string;
  vid: string;
  lang?: 'en' | 'zh-cn' | 'jp';
  closeVideoClick?: boolean;
  closeVideoDblclick?: boolean;
  videoFillMode?: string;
}

interface TikTokVePlayerInstance {
  play?: () => unknown;
  pause?: () => unknown;
  destroy: () => void;
  player?: {
    play?: () => unknown;
    pause?: () => unknown;
  };
}

interface TikTokVePlayerConstructor {
  new(options: TikTokVePlayerOptions): TikTokVePlayerInstance;
}

interface TikTokMinisSdk {
  init(options: { clientKey: string }): void;
  login(callback: (result: TikTokMinisLoginResult) => void): void;
  canIUse?(schema: string): boolean;
  createRewardedVideoAd?(options: { adUnitId: string }): TikTokRewardedVideoAd;
  getPlayer?(
    channel?: 'byteplus' | 'volcengine',
  ): Promise<TikTokVePlayerConstructor>;
  pay?(
    callback: (result: TikTokMinisPaymentResult) => void,
    options: { trade_order_id: string },
  ): unknown;
  game?: {
    pay(
      options: { trade_order_id: string },
      callback?: (result: unknown) => void,
    ): unknown;
  };
}

interface Window {
  TTMinis?: TikTokMinisSdk;
}

declare const TTMinis: TikTokMinisSdk;
