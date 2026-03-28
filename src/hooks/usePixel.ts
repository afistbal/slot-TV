
import { useRef } from 'react';
import { FacebookPixel, type EventData, type TrackableEventName } from 'react-use-facebook-pixel';

interface TiktokPixel {
    init(pixelId: string, advancedMatching?: {}, options?: {
        debug: boolean;
    }): Promise<void>;
    pageView(): void;
    track(event: unknown, data: unknown): void;
};

interface IPixel {
    instance: unknown | null;
    track(name: unknown, data?: unknown): void;
}

class _Facebook implements IPixel {
    instance: FacebookPixel | null = null;

    public track(name: unknown, data?: unknown) {
        this.instance?.trackEvent(name as TrackableEventName, data as EventData[TrackableEventName]);
    }
}

class _Tiktok {
    instance: TiktokPixel | null = null;

    public track(name: unknown, data?: unknown) {
        this.instance?.track(name, data);
    }
}

class Pixel {
    protected instance: Array<_Facebook | _Tiktok> = [];

    public addInstance(instance: _Facebook | _Tiktok) {
        this.instance.push(instance);
    }

    public track(name: unknown, data?: unknown) {
        this.instance.forEach(instance => {
            instance.track(name, data);
        });
    }
}

const singleton = new Pixel();
let initialized = false;

export async function init(config: { [key: string]: unknown }) {
    if (!config['analyzation']) {
        return;
    }
    if (initialized) {
        return;
    }

    const initializeFacebookPixel = async (id: string) => {
        const instance = new FacebookPixel({
            pixelID: id,
        });

        instance.init({});

        const facebook = new _Facebook();
        facebook.instance = instance;
        singleton.addInstance(facebook);
    };

    const intitalizeTiktokPixel = async (id: string) => {
        const instance = (await import('tiktok-pixel')).default;

        instance.init(id);
        const tiktok = new _Tiktok();
        tiktok.instance = instance;
        singleton.addInstance(tiktok);
    }

    const analyzation = config['analyzation'] as { type: 'facebook' | 'tiktok' | '', id: string };
    if (analyzation.type === '') {
        initialized = true;
        return;
    }

    switch (analyzation.type) {
        case 'facebook':
            initializeFacebookPixel(analyzation.id);
            break;
        case 'tiktok':
            intitalizeTiktokPixel(analyzation.id);
            break;
    }

    initialized = true;
}

const usePixel = () => {
    const pixel = useRef<Pixel>(singleton);
    return pixel.current;
};

export default usePixel;