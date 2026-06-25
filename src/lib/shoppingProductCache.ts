export type ShoppingProductFrom = 'shopping' | 'video';

type ShoppingProduct = {
    id: number;
    type: number;
    name: string;
    price: string;
    renewal_price: string;
    coin?: number;
    bouns?: string;
};

const shoppingProductCache = new Map<ShoppingProductFrom, ShoppingProduct[]>();

export function getShoppingProductCache(from: ShoppingProductFrom): ShoppingProduct[] | undefined {
    return shoppingProductCache.get(from);
}

export function setShoppingProductCache(from: ShoppingProductFrom, products: ShoppingProduct[]): void {
    shoppingProductCache.set(from, products);
}

export function hasShoppingProductCache(from: ShoppingProductFrom): boolean {
    return shoppingProductCache.has(from);
}

export function clearShoppingProductCache(): void {
    shoppingProductCache.clear();
}
