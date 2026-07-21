import { api } from '@/api';
import { getPlatform } from '@/platform';

export type TikTokPayProduct = {
    id: number;
    product_id: string;
    name: string;
    beans: number;
    coin: number;
    bonus: number;
    price: string;
    type: number;
};

export type TikTokCreateOrder = {
    order_no: string;
    trade_order_id: string;
    product_id: number | string;
    beans: number;
    order_status: number;
};

export type TikTokOrderStatus = {
    order_no: string;
    trade_order_id: string;
    order_status: number;
    status: 'pending' | 'success' | 'failed' | 'cancelled' | string;
};

function apiError(message: string): Error {
    return new Error(message || 'TikTok payment request failed.');
}

export async function fetchTikTokPayProducts(): Promise<TikTokPayProduct[]> {
    const result = await api<TikTokPayProduct[]>('tkPay/products', {
        method: 'get',
        loading: false,
        toastOnError: false,
    });
    if (result.c !== 0 || !Array.isArray(result.d)) {
        throw apiError(result.m);
    }
    return result.d;
}

export async function createTikTokPayOrder(productId: number): Promise<TikTokCreateOrder> {
    const result = await api<TikTokCreateOrder>('tkPay/create', {
        method: 'post',
        loading: false,
        toastOnError: false,
        data: { product_id: productId },
    });
    if (result.c !== 0 || !result.d?.order_no || !result.d.trade_order_id) {
        throw apiError(result.m);
    }
    return result.d;
}

export async function queryTikTokPayOrder(orderNo: string): Promise<TikTokOrderStatus> {
    const result = await api<TikTokOrderStatus>('tkPay/order', {
        method: 'post',
        loading: false,
        toastOnError: false,
        data: { order_no: orderNo },
    });
    if (result.c !== 0 || !result.d?.status) {
        throw apiError(result.m);
    }
    return result.d;
}

function wait(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function payTikTokOrder(order: TikTokCreateOrder): Promise<TikTokOrderStatus> {
    const pay = getPlatform().payment.pay;
    if (!pay) {
        throw new Error('TikTok Minis payment is not available in this build.');
    }

    await pay(order.trade_order_id);

    // The SDK returning only means the native sheet has finished. The webhook
    // is the source of truth for coin delivery, so wait for the server status.
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const status = await queryTikTokPayOrder(order.order_no);
        if (status.status === 'success') return status;
        if (['failed', 'cancelled', 'closed'].includes(status.status)) {
            throw new Error(`TikTok payment ${status.status}.`);
        }
        if (attempt < 2) await wait(1500);
    }

    throw new Error('TikTok payment is still pending. Please check your balance shortly.');
}
