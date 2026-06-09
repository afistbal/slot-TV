const DEFAULT_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA9/nIau81/YdWgmJ+0Wmn
PvBrAgKetBow45w3eT6dLcKkY8yo9KbJC/5Sqn4CD+vdCemgYDTcYSPSkQArfluW
xDP1n03mvGZOFKPUDv8CRyUHGPwoYnRp/pChfsSC0OkP6T3eTkP7rEPG3bqo3dD+
Pxe0bVriogp2+3K8TQne4E+9xOqfzX27g7wtmn+wHvt31s/PKVS4e/LvlGEYaXA0
u+xVk3B7WfJve4MWEqaXvtzpPMi2tFJOdKAolqzFPV2gwP7YlYwE4P8+p4fDhFeO
TWLC3JK1p5mwJTGqn8RO5FF25Wtffy8s+rjPFUnpbWXz0k6Z2mmzsB8yOHKFcnHR
owIDAQAB
-----END PUBLIC KEY-----`;

const textEncoder = new TextEncoder();

export type EncryptRequestOptions = {
    publicKeyPem?: string;
};

export type EncryptedRequestPayload = {
    headers: Record<string, string>;
    body: string;
};

function browserCrypto(): Crypto {
    if (!globalThis.crypto?.subtle) {
        throw new Error('Web Crypto API is not available');
    }

    return globalThis.crypto;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
    const base64 = pem
        .replace(/-----BEGIN PUBLIC KEY-----/g, '')
        .replace(/-----END PUBLIC KEY-----/g, '')
        .replace(/\s+/g, '');
    return base64ToBytes(base64).buffer as ArrayBuffer;
}

function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });

    return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
}

async function importPublicKey(publicKeyPem: string): Promise<CryptoKey> {
    return browserCrypto().subtle.importKey(
        'spki',
        pemToArrayBuffer(publicKeyPem),
        {
            name: 'RSA-OAEP',
            hash: 'SHA-1',
        },
        false,
        ['encrypt'],
    );
}

export async function encryptRequestPayload(
    payload: Record<string, unknown>,
    options: EncryptRequestOptions = {},
): Promise<EncryptedRequestPayload> {
    const publicKeyPem = options.publicKeyPem || DEFAULT_PUBLIC_KEY;
    const cryptoApi = browserCrypto();
    const publicKey = await importPublicKey(publicKeyPem);

    const aesKey = await cryptoApi.subtle.generateKey(
        {
            name: 'AES-GCM',
            length: 256,
        },
        true,
        ['encrypt'],
    );
    const rawAesKey = new Uint8Array(await cryptoApi.subtle.exportKey('raw', aesKey));
    const iv = cryptoApi.getRandomValues(new Uint8Array(12));
    const plaintext = textEncoder.encode(JSON.stringify(payload));

    const encryptedBuffer = await cryptoApi.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv,
            tagLength: 128,
        },
        aesKey,
        plaintext,
    );
    const encrypted = new Uint8Array(encryptedBuffer);
    const ciphertext = encrypted.slice(0, encrypted.length - 16);
    const tag = encrypted.slice(encrypted.length - 16);
    const encryptedKey = new Uint8Array(
        await cryptoApi.subtle.encrypt(
            {
                name: 'RSA-OAEP',
            },
            publicKey,
            rawAesKey,
        ),
    );

    return {
        headers: {
            'X-Encrypted-Key': bytesToBase64(encryptedKey),
            'X-Encrypted-Iv': bytesToBase64(iv),
            'X-Encrypted-Tag': bytesToBase64(tag),
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            data: bytesToBase64(ciphertext),
        }),
    };
}

/** POST 走 RSA-OAEP + AES-GCM；GET 返回 false（由 api.ts 总开关决定是否启用） */
export function shouldEncryptApiRequest(method: string | undefined): boolean {
    return (method || 'get').toUpperCase() !== 'GET';
}

export { DEFAULT_PUBLIC_KEY };
