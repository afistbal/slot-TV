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

interface TikTokMinisSdk {
  init(options: { clientKey: string }): void;
  login(callback: (result: TikTokMinisLoginResult) => void): void;
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
