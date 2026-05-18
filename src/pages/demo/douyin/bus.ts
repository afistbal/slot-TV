type BusHandler = (val?: unknown) => void;

const eventMap = new Map<string, BusHandler[]>();

export const demoBus = {
    on(eventType: string, cb: BusHandler) {
        const cbs = eventMap.get(eventType) ?? [];
        cbs.push(cb);
        eventMap.set(eventType, cbs);
    },
    off(eventType: string, fn?: BusHandler) {
        if (!eventMap.has(eventType)) {
            return;
        }
        if (!fn) {
            eventMap.delete(eventType);
            return;
        }
        const cbs = eventMap.get(eventType)!;
        const rIndex = cbs.findIndex((v) => v === fn);
        if (rIndex > -1) {
            cbs.splice(rIndex, 1);
        }
        eventMap.set(eventType, cbs);
    },
    emit(eventType: string, val?: unknown) {
        const cbs = eventMap.get(eventType);
        if (cbs) {
            cbs.forEach((cb) => cb(val));
        }
    },
};

export const DEMO_EVENT_KEY = {
    SINGLE_CLICK: 'SINGLE_CLICK',
    SINGLE_CLICK_BROADCAST: 'SINGLE_CLICK_BROADCAST',
    ITEM_TOGGLE: 'ITEM_TOGGLE',
    ITEM_PLAY: 'ITEM_PLAY',
    ITEM_STOP: 'ITEM_STOP',
    REMOVE_MUTED: 'REMOVE_MUTED',
    HIDE_MUTED_NOTICE: 'HIDE_MUTED_NOTICE',
    CURRENT_ITEM: 'CURRENT_ITEM',
} as const;

export type DemoBroadcastPayload = {
    uniqueId: string;
    index: number;
    type: string;
};
