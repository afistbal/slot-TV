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
