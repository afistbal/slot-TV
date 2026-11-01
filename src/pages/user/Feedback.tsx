import { Page } from '@/layouts/user';
import { getSupportChatConfig } from '@/lib/supportChatConfig';
import { useConfigStore } from '@/stores/config';
import agentAvatar from '@/assets/support-chat/agent.png';
import userAvatar from '@/assets/support-chat/user.png';
import uploadIcon from '@/assets/support-chat/upload.png';
import { Loader2, MessageCircleMore, RefreshCw, X } from 'lucide-react';
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type ChangeEvent,
    type KeyboardEvent,
} from 'react';
import { useIntl } from 'react-intl';
import { toast } from 'sonner';
import '@/styles/feedback-reelshort.scss';

type ChatSide = 'left' | 'right';
type ChatConnection = 'connecting' | 'online' | 'reconnecting' | 'offline' | 'unavailable';

type ChatMessage = {
    key: string;
    id?: string | number;
    msgId?: string;
    serverMsgId?: string | number;
    side: ChatSide;
    type?: string;
    content: string;
    imageUrl?: string;
    time?: string | number;
    failed?: boolean;
    pending?: boolean;
    system?: boolean;
};

type OutboundMessage = {
    type: 'say' | 'file';
    msgId: string;
    content?: string;
    data?: string;
    time?: string;
};

type ServerPacket = Record<string, unknown> & {
    type?: string;
    msgId?: string;
    msg_id?: string | number;
    content?: string;
    data?: unknown;
    time?: string | number;
};

const MESSAGE_TIMEOUT_MS = 5_000;
const RECONNECT_DELAY_MS = 5_000;
const HISTORY_PAGE_SIZE = 15;
const MAX_OFFLINE_MESSAGES = 3;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function randomId(length = 16): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let value = '';
    for (let index = 0; index < length; index += 1) {
        value += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    return value;
}

function plainText(value: unknown): string {
    if (typeof value !== 'string') return '';
    const documentNode = new DOMParser().parseFromString(value, 'text/html');
    return documentNode.body.textContent ?? '';
}

function messageTime(value: ChatMessage['time'], locale: string): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date);
}

function firstString(...values: unknown[]): string {
    return String(values.find((value) => typeof value === 'string' && value.trim()) ?? '').trim();
}

function readToken(): string {
    const queryToken = new URLSearchParams(window.location.search).get('token')?.trim();
    const title = new URLSearchParams(window.location.search).get('title') ?? '';
    const titleToken = title.match(/(?:^|[?&])token=([^&]+)/)?.[1];
    return firstString(localStorage.getItem('token'), localStorage.getItem('op_token'), queryToken, titleToken ? decodeURIComponent(titleToken) : '');
}

function readCountryAbbr(config: Record<string, unknown>): string {
    const params = new URLSearchParams(window.location.search);
    const title = params.get('title') ?? '';
    const titleAbbr = title.match(/(?:^|[?&])h5_abbr=([^&]+)/)?.[1];
    return firstString(
        config.country_abbr,
        config.countryAbbr,
        config.abbr,
        config.country,
        params.get('h5_abbr'),
        titleAbbr ? decodeURIComponent(titleAbbr) : '',
        localStorage.getItem('op_abbr'),
        localStorage.getItem('country_abbr'),
        localStorage.getItem('abbr'),
    ).toUpperCase();
}

function SupportAvatar({ user = false }: { user?: boolean }) {
    return <span className={`support-chat__avatar${user ? ' support-chat__avatar--user' : ''}`}>
        <img src={user ? userAvatar : agentAvatar} alt="" aria-hidden />
    </span>;
}

export default function FeedbackPage({ embedded = false }: { embedded?: boolean }) {
    const intl = useIntl();
    const locale = intl.locale || 'en';
    const isTraditional = locale.toLowerCase().startsWith('zh-tw');
    const isChinese = locale.toLowerCase().startsWith('zh');
    const t = useCallback((cn: string, en: string, tw = cn) => (
        isChinese ? (isTraditional ? tw : cn) : en
    ), [isChinese, isTraditional]);
    const runtimeConfig = useConfigStore((state) => state.config);
    const config = getSupportChatConfig();
    const token = readToken();
    const countryAbbr = readCountryAbbr(runtimeConfig);

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [connection, setConnection] = useState<ChatConnection>('connecting');
    const [historyLoading, setHistoryLoading] = useState(false);
    const [allHistoryLoaded, setAllHistoryLoaded] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const messagesRef = useRef<ChatMessage[]>([]);
    const connectionRef = useRef<ChatConnection>('connecting');
    const failedQueueRef = useRef<OutboundMessage[]>([]);
    const pendingTimersRef = useRef(new Map<string, number>());
    const reconnectTimerRef = useRef<number | null>(null);
    const manuallyClosedRef = useRef(false);
    const welcomeShownRef = useRef(false);
    const hasConnectedRef = useRef(false);
    const disconnectNoticeShownRef = useRef(false);
    const offlineMessageCountRef = useRef(0);
    const historyLoadingRef = useRef(false);
    const allHistoryLoadedRef = useRef(false);
    const historyTimesRef = useRef(0);
    const connectRef = useRef<() => void>(() => undefined);
    const sendPacketRef = useRef<(packet: Record<string, unknown>) => boolean>(() => false);
    const loadHistoryRef = useRef<() => Promise<void>>(async () => undefined);

    const setConnectionState = useCallback((next: ChatConnection) => {
        connectionRef.current = next;
        setConnection(next);
    }, []);

    const replaceMessages = useCallback((updater: (current: ChatMessage[]) => ChatMessage[]) => {
        setMessages((current) => {
            const next = updater(current);
            messagesRef.current = next;
            return next;
        });
    }, []);

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        window.requestAnimationFrame(() => {
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior });
        });
    }, []);

    const addSystemMessage = useCallback((content: string) => {
        replaceMessages((current) => [...current, {
            key: `system-${randomId()}`,
            side: 'left',
            type: 'back_list',
            content,
            system: true,
        }]);
        scrollToBottom();
    }, [replaceMessages, scrollToBottom]);

    const setConnectionMessage = useCallback((content: string) => {
        replaceMessages((current) => {
            const index = current.findIndex((message) => message.key === 'system-connection');
            const statusMessage: ChatMessage = {
                key: 'system-connection',
                side: 'left',
                type: 'back_list',
                content,
                system: true,
            };
            if (index < 0) return [...current, statusMessage];
            return current.map((message, messageIndex) => messageIndex === index ? statusMessage : message);
        });
        scrollToBottom();
    }, [replaceMessages, scrollToBottom]);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    useEffect(() => {
        const element = inputRef.current;
        if (!element) return;
        element.style.height = 'auto';
        element.style.height = `${Math.max(42, Math.min(element.scrollHeight, 144))}px`;
        element.style.overflowY = element.scrollHeight > 144 ? 'auto' : 'hidden';
    }, [input]);

    useEffect(() => {
        if (!previewUrl) return;
        const close = (event: globalThis.KeyboardEvent) => {
            if (event.key === 'Escape') setPreviewUrl(null);
        };
        document.addEventListener('keydown', close);
        return () => document.removeEventListener('keydown', close);
    }, [previewUrl]);

    useEffect(() => {
        manuallyClosedRef.current = false;
        welcomeShownRef.current = false;
        offlineMessageCountRef.current = 0;
        historyTimesRef.current = 0;
        setAllHistoryLoaded(false);
        allHistoryLoadedRef.current = false;

        const clearPendingTimer = (msgId?: string) => {
            if (!msgId) return;
            const timer = pendingTimersRef.current.get(msgId);
            if (timer !== undefined) window.clearTimeout(timer);
            pendingTimersRef.current.delete(msgId);
        };

        const startPendingTimer = (packet: OutboundMessage) => {
            clearPendingTimer(packet.msgId);
            const timer = window.setTimeout(() => {
                pendingTimersRef.current.delete(packet.msgId);
                if (!failedQueueRef.current.some((queued) => queued.msgId === packet.msgId)) {
                    failedQueueRef.current.push(packet);
                }
                replaceMessages((current) => current.map((message) => message.msgId === packet.msgId
                    ? { ...message, failed: true, pending: false }
                    : message));
            }, MESSAGE_TIMEOUT_MS);
            pendingTimersRef.current.set(packet.msgId, timer);
        };

        const sendPacket = (packet: Record<string, unknown>): boolean => {
            const ws = wsRef.current;
            if (!ws || ws.readyState !== WebSocket.OPEN) return false;
            const payload = {
                ...packet,
                token,
                countryAbbr,
                msgId: packet.msgId || randomId(),
            };
            try {
                ws.send(JSON.stringify(payload));
                return true;
            } catch {
                return false;
            }
        };
        sendPacketRef.current = sendPacket;

        const acknowledge = (packet: ServerPacket, packetType: string) => {
            const msgId = String(packet.msgId ?? '');
            clearPendingTimer(msgId);
            const content = plainText(packet.content);
            replaceMessages((current) => {
                const matchedIndex = msgId
                    ? current.findIndex((message) => message.msgId === msgId)
                    : -1;
                if (matchedIndex >= 0) {
                    return current.map((message, index) => index === matchedIndex ? {
                        ...message,
                        content: content || message.content,
                        serverMsgId: packet.msg_id ?? packet.msgId,
                        time: packet.time,
                        type: packetType,
                        failed: false,
                        pending: false,
                    } : message);
                }
                return [...current, {
                    key: `server-${String(packet.msg_id ?? packet.msgId ?? randomId())}`,
                    side: packetType === 'sayAdmin' ? 'left' : 'right',
                    type: packetType,
                    content,
                    serverMsgId: packet.msg_id ?? packet.msgId,
                    time: packet.time,
                }];
            });
            sendPacket({ type: 'read' });
            scrollToBottom();
        };

        const scheduleReconnect = () => {
            if (manuallyClosedRef.current || reconnectTimerRef.current !== null) return;
            setConnectionState('reconnecting');
            reconnectTimerRef.current = window.setTimeout(() => {
                reconnectTimerRef.current = null;
                connectRef.current();
            }, RECONNECT_DELAY_MS);
        };

        const resendFailedMessages = () => {
            const queue = [...failedQueueRef.current];
            failedQueueRef.current = [];
            queue.forEach((packet, index) => {
                window.setTimeout(() => {
                    const sent = sendPacket(packet);
                    if (!sent) {
                        failedQueueRef.current.push(packet);
                        return;
                    }
                    replaceMessages((current) => current.map((message) => message.msgId === packet.msgId
                        ? { ...message, failed: false, pending: true }
                        : message));
                    startPendingTimer(packet);
                }, index * 60);
            });
        };

        const handleLogin = () => {
            setConnectionState('online');
            if (hasConnectedRef.current) {
                setConnectionMessage(t('客服连接已恢复。', 'Support connection restored.', '客服連線已恢復。'));
            }
            hasConnectedRef.current = true;
            disconnectNoticeShownRef.current = false;
            if (reconnectTimerRef.current !== null) {
                window.clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
            resendFailedMessages();
            if (!welcomeShownRef.current) {
                const indiaHour = Number(new Intl.DateTimeFormat('en-US', {
                    timeZone: 'Asia/Kolkata',
                    hour: '2-digit',
                    hour12: false,
                }).format(new Date()));
                if (indiaHour >= 23 || indiaHour < 8) {
                    addSystemMessage(t(
                        '人工客服工作时间为 08:00–23:00。非工作时间最多可留言三条，我们会在上线后回复。',
                        'Live support hours are 08:00–23:00. You may leave up to three messages while support is offline.',
                        '人工客服工作時間為 08:00–23:00。非工作時間最多可留言三則，我們會在線後回覆。',
                    ));
                }
                welcomeShownRef.current = true;
            }
            window.setTimeout(() => sendPacket({ type: 'lea', pageSize: 999 }), 200);
        };

        const handlePacket = (packet: ServerPacket) => {
            const packetType = String(packet.type ?? '');
            switch (packetType) {
                case 'ping':
                    sendPacket({ type: 'pong' });
                    break;
                case 'login':
                    handleLogin();
                    break;
                case 'say':
                case 'sayAdmin':
                    offlineMessageCountRef.current = 0;
                    acknowledge(packet, packetType);
                    break;
                case 'leaveMsg': {
                    const msgId = String(packet.msgId ?? '');
                    clearPendingTimer(msgId);
                    const imageUrl = typeof packet.data === 'string' && /^https?:\/\//i.test(packet.data) ? packet.data : undefined;
                    replaceMessages((current) => {
                        const matchedIndex = msgId
                            ? current.findIndex((message) => message.msgId === msgId)
                            : -1;
                        if (matchedIndex >= 0) {
                            return current.map((message, index) => index === matchedIndex
                                ? { ...message, time: packet.time, pending: false, failed: false, imageUrl: imageUrl ?? message.imageUrl }
                                : message);
                        }
                        return [...current, {
                            key: `leave-${msgId || randomId()}`,
                            msgId,
                            side: 'right',
                            type: imageUrl ? 'file' : 'say',
                            content: plainText(packet.content),
                            imageUrl,
                            time: packet.time,
                        }];
                    });
                    offlineMessageCountRef.current += 1;
                    scrollToBottom();
                    break;
                }
                case 'leave': {
                    const rows = Array.isArray((packet as { list?: unknown }).list)
                        ? ([...(packet as { list: ServerPacket[] }).list].reverse())
                        : [];
                    if (rows.length) {
                        replaceMessages((current) => {
                            const known = new Set(current.map((message) => String(message.serverMsgId ?? message.id ?? '')));
                            const incoming = rows.filter((row) => !known.has(String(row.msg_id ?? ''))).map((row) => {
                                const rowType = String(row.type ?? '');
                                const file = rowType === 'file' || rowType === 'fileAdmin';
                                return {
                                    key: `leave-list-${String(row.msg_id ?? randomId())}`,
                                    serverMsgId: row.msg_id,
                                    side: rowType === 'say' || rowType === 'file' ? 'right' as const : 'left' as const,
                                    type: rowType,
                                    content: file ? '' : plainText(row.content),
                                    imageUrl: file ? String(row.content ?? '') : undefined,
                                    time: row.time ?? packet.time,
                                };
                            });
                            return [...current, ...incoming];
                        });
                        sendPacket({ type: 'read' });
                        scrollToBottom('auto');
                    }
                    break;
                }
                case 'file':
                case 'fileAdmin': {
                    const msgId = String(packet.msgId ?? '');
                    const imageUrl = typeof packet.data === 'string' ? packet.data : '';
                    clearPendingTimer(msgId);
                    let matched = false;
                    replaceMessages((current) => {
                        const updated = current.map((message) => {
                            if (!msgId || message.msgId !== msgId) return message;
                            matched = true;
                            return { ...message, imageUrl: imageUrl || message.imageUrl, time: packet.time, pending: false, failed: false };
                        });
                        return matched ? updated : [...updated, {
                            key: `file-${msgId || randomId()}`,
                            msgId,
                            side: packet.to_client_id ? 'left' : 'right',
                            type: packetType,
                            content: '',
                            imageUrl,
                            time: packet.time,
                        }];
                    });
                    scrollToBottom();
                    break;
                }
                case 'loginFail':
                    setConnectionState('offline');
                    setConnectionMessage(t('登录客服失败，请重新登录后再试。', 'Support login failed. Sign in and try again.', '登入客服失敗，請重新登入後再試。'));
                    break;
                case 'logout':
                    wsRef.current?.close();
                    break;
                default:
                    break;
            }
        };

        const connect = () => {
            if (!config.websocketUrl) {
                setConnectionState('unavailable');
                return;
            }
            const existing = wsRef.current;
            if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) return;
            setConnectionState(connectionRef.current === 'reconnecting' ? 'reconnecting' : 'connecting');
            try {
                const ws = new WebSocket(config.websocketUrl);
                wsRef.current = ws;
                ws.onopen = () => {
                    if (!token) {
                        setConnectionState('offline');
                        addSystemMessage(t('请先登录账号，再联系在线客服。', 'Sign in before contacting live support.', '請先登入帳號，再聯絡線上客服。'));
                        return;
                    }
                    sendPacket({ type: 'login', source: { platform: 'web', locale } });
                };
                ws.onmessage = (event) => {
                    try {
                        handlePacket(JSON.parse(String(event.data)) as ServerPacket);
                    } catch {
                        // 忽略非 JSON 服务消息，保持连接继续工作。
                    }
                };
                ws.onclose = () => {
                    if (wsRef.current === ws) wsRef.current = null;
                    if (!manuallyClosedRef.current) {
                        if (!disconnectNoticeShownRef.current) {
                            disconnectNoticeShownRef.current = true;
                            setConnectionMessage(t('客服连接已断开，正在自动重连…', 'Connection lost. Reconnecting…', '客服連線已中斷，正在自動重連…'));
                        }
                        scheduleReconnect();
                    }
                };
                ws.onerror = () => {
                    setConnectionState('reconnecting');
                };
            } catch {
                scheduleReconnect();
            }
        };
        connectRef.current = connect;

        const loadHistory = async () => {
            if (historyLoadingRef.current || allHistoryLoadedRef.current || !config.apiBaseUrl) return;
            historyLoadingRef.current = true;
            setHistoryLoading(true);
            const scroller = scrollRef.current;
            const beforeHeight = scroller?.scrollHeight ?? 0;
            const firstMessage = messagesRef.current.find((message) => message.id != null);
            try {
                const response = await fetch(`${config.apiBaseUrl}/user/chat/historyUser`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { authorization: token } : {}),
                    },
                    body: JSON.stringify({
                        recordId: firstMessage?.id ?? '',
                        countryAbbr,
                        pageSize: String(HISTORY_PAGE_SIZE),
                        scene: 'gold',
                    }),
                });
                const payload = await response.json() as {
                    code?: number;
                    c?: number;
                    data?: { rows?: ServerPacket[] };
                    d?: { rows?: ServerPacket[] };
                };
                const success = payload.code === 200 || payload.c === 0;
                const rows = payload.data?.rows ?? payload.d?.rows ?? [];
                if (!response.ok || !success) throw new Error(t('历史消息加载失败', 'Could not load message history', '歷史訊息載入失敗'));
                if (!rows.length) {
                    allHistoryLoadedRef.current = true;
                    setAllHistoryLoaded(true);
                    return;
                }
                replaceMessages((current) => {
                    const known = new Set(current.map((message) => String(message.serverMsgId ?? message.id ?? '')));
                    const incoming = rows.map((row) => {
                        const type = String(row.type ?? '');
                        const file = type === 'file' || type === 'fileAdmin';
                        return {
                            key: `history-${String(row.id ?? row.msg_id ?? randomId())}`,
                            id: row.id as string | number | undefined,
                            serverMsgId: row.msg_id,
                            side: type === 'say' || type === 'file' ? 'right' as const : 'left' as const,
                            type,
                            content: file ? '' : plainText(row.content),
                            imageUrl: file ? String(row.content ?? '') : undefined,
                            time: row.msg_time as string | number | undefined,
                        };
                    }).filter((message) => !known.has(String(message.serverMsgId ?? message.id ?? '')));
                    return [...incoming.reverse(), ...current];
                });
                historyTimesRef.current += 1;
                window.requestAnimationFrame(() => {
                    if (scroller) scroller.scrollTop = Math.max(40, scroller.scrollHeight - beforeHeight);
                });
            } catch (reason) {
                toast.error(reason instanceof Error ? reason.message : String(reason));
            } finally {
                historyLoadingRef.current = false;
                setHistoryLoading(false);
            }
        };
        loadHistoryRef.current = loadHistory;

        connect();
        const pendingTimers = pendingTimersRef.current;
        return () => {
            manuallyClosedRef.current = true;
            if (reconnectTimerRef.current !== null) window.clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
            pendingTimers.forEach((timer) => window.clearTimeout(timer));
            pendingTimers.clear();
            const ws = wsRef.current;
            wsRef.current = null;
            if (ws) {
                ws.onopen = null;
                ws.onmessage = null;
                ws.onclose = null;
                ws.onerror = null;
                ws.close();
            }
        };
    }, [addSystemMessage, config.apiBaseUrl, config.websocketUrl, countryAbbr, locale, replaceMessages, scrollToBottom, setConnectionMessage, setConnectionState, t, token]);

    const queuePendingTimeout = useCallback((packet: OutboundMessage) => {
        const previous = pendingTimersRef.current.get(packet.msgId);
        if (previous !== undefined) window.clearTimeout(previous);
        const timer = window.setTimeout(() => {
            pendingTimersRef.current.delete(packet.msgId);
            if (!failedQueueRef.current.some((queued) => queued.msgId === packet.msgId)) {
                failedQueueRef.current.push(packet);
            }
            replaceMessages((current) => current.map((message) => message.msgId === packet.msgId
                ? { ...message, failed: true, pending: false }
                : message));
        }, MESSAGE_TIMEOUT_MS);
        pendingTimersRef.current.set(packet.msgId, timer);
    }, [replaceMessages]);

    const sendOutbound = useCallback((packet: OutboundMessage, optimistic: ChatMessage) => {
        replaceMessages((current) => [...current, optimistic]);
        const sent = sendPacketRef.current(packet);
        if (sent) {
            queuePendingTimeout(packet);
        } else {
            failedQueueRef.current.push(packet);
            replaceMessages((current) => current.map((message) => message.msgId === packet.msgId
                ? { ...message, failed: true, pending: false }
                : message));
        }
        scrollToBottom();
    }, [queuePendingTimeout, replaceMessages, scrollToBottom]);

    const sendText = useCallback(() => {
        const content = input.trim();
        if (!content) return;
        if (!token) {
            addSystemMessage(t('请先登录账号，再发送消息。', 'Sign in before sending a message.', '請先登入帳號，再傳送訊息。'));
            return;
        }
        if (offlineMessageCountRef.current >= MAX_OFFLINE_MESSAGES) {
            addSystemMessage(t('客服当前离线，最多可留言三条。', 'Support is offline. You can leave up to three messages.', '客服目前離線，最多可留言三則。'));
            return;
        }
        const msgId = randomId();
        const packet: OutboundMessage = { type: 'say', msgId, content, time: '' };
        sendOutbound(packet, {
            key: `local-${msgId}`,
            msgId,
            side: 'right',
            type: 'say',
            content,
            time: Date.now(),
            pending: connectionRef.current === 'online',
        });
        if (connectionRef.current !== 'online') offlineMessageCountRef.current += 1;
        setInput('');
    }, [addSystemMessage, input, sendOutbound, t, token]);

    const resendMessage = useCallback((message: ChatMessage) => {
        if (!message.msgId) return;
        const packet: OutboundMessage = message.type === 'file'
            ? { type: 'file', msgId: message.msgId, data: message.imageUrl }
            : { type: 'say', msgId: message.msgId, content: message.content, time: '' };
        failedQueueRef.current = failedQueueRef.current.filter((queued) => queued.msgId !== message.msgId);
        const sent = sendPacketRef.current(packet);
        replaceMessages((current) => current.map((item) => item.msgId === message.msgId
            ? { ...item, failed: !sent, pending: sent }
            : item));
        if (sent) queuePendingTimeout(packet);
        else failedQueueRef.current.push(packet);
    }, [queuePendingTimeout, replaceMessages]);

    const handleImageUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (!file || uploading) return;
        if (!['image/jpeg', 'image/png'].includes(file.type)) {
            toast.warning(t('仅支持 JPG 或 PNG 图片', 'Only JPG and PNG images are supported', '僅支援 JPG 或 PNG 圖片'));
            return;
        }
        if (file.size > MAX_IMAGE_BYTES) {
            toast.warning(t('图片不能超过 10 MB', 'Images must be 10 MB or smaller', '圖片不能超過 10 MB'));
            return;
        }
        if (!token) {
            addSystemMessage(t('请先登录账号，再上传图片。', 'Sign in before uploading an image.', '請先登入帳號，再上傳圖片。'));
            return;
        }
        if (!config.uploadBaseUrl) {
            toast.error(t('客服图片上传服务未配置', 'Image upload is not configured', '客服圖片上傳服務未設定'));
            return;
        }
        setUploading(true);
        try {
            const form = new FormData();
            form.append('file', file);
            form.append('scene', 'gold');
            const response = await fetch(`${config.uploadBaseUrl}/user/file/image`, {
                method: 'POST',
                headers: { authorization: token },
                body: form,
            });
            const payload = await response.json() as {
                code?: number;
                c?: number;
                data?: Array<{ webPath?: string } | string>;
                d?: Array<{ webPath?: string } | string>;
                message?: string;
                m?: string;
            };
            const success = payload.code === 200 || payload.c === 0;
            const first = (payload.data ?? payload.d ?? [])[0];
            const imageUrl = typeof first === 'string' ? first : first?.webPath;
            if (!response.ok || !success || !imageUrl) throw new Error(payload.message || payload.m || t('图片上传失败', 'Image upload failed', '圖片上傳失敗'));
            const msgId = randomId();
            const packet: OutboundMessage = { type: 'file', msgId, data: imageUrl };
            sendOutbound(packet, {
                key: `local-file-${msgId}`,
                msgId,
                side: 'right',
                type: 'file',
                content: '',
                imageUrl,
                time: Date.now(),
                pending: connectionRef.current === 'online',
            });
        } catch (reason) {
            toast.error(reason instanceof Error ? reason.message : String(reason));
        } finally {
            setUploading(false);
        }
    }, [addSystemMessage, config.uploadBaseUrl, sendOutbound, t, token, uploading]);

    const handleScroll = useCallback(() => {
        if ((scrollRef.current?.scrollTop ?? 1) <= 1) void loadHistoryRef.current();
    }, []);

    const handleKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
        event.preventDefault();
        sendText();
    }, [sendText]);

    const connectionLabel = connection === 'online'
        ? t('在线', 'Online', '線上')
        : connection === 'connecting'
            ? t('连接中', 'Connecting', '連線中')
            : connection === 'reconnecting'
                ? t('重连中', 'Reconnecting', '重新連線中')
                : connection === 'unavailable'
                    ? t('未配置', 'Not configured', '未設定')
                    : t('离线', 'Offline', '離線');

    const chat = <main className={`support-chat${embedded ? ' support-chat--embedded' : ''}`} data-connection={connectionLabel}>
        <div ref={scrollRef} className="support-chat__messages" onScroll={handleScroll}>
            <div className="support-chat__history">
                {historyLoading ? <span><Loader2 className="is-spinning" aria-hidden />{t('加载中…', 'Loading…', '載入中…')}</span>
                    : allHistoryLoaded ? <span>{t('已加载全部历史消息', 'All messages loaded', '已載入全部歷史訊息')}</span>
                        : <button type="button" onClick={() => void loadHistoryRef.current()}>{t('加载历史消息', 'Load history', '載入歷史訊息')}</button>}
            </div>

            {!messages.length ? <div className="support-chat__empty"><MessageCircleMore aria-hidden /><p>{t('您好，请输入您遇到的问题。', 'Hi! Tell us how we can help.', '您好，請輸入您遇到的問題。')}</p></div> : null}

            {messages.map((message) => (
                <div key={message.key} className={`support-chat__message support-chat__message--${message.side}${message.system ? ' support-chat__message--system' : ''}`}>
                    {message.side === 'left' && !message.system ? <SupportAvatar /> : null}
                    <div className="support-chat__bubbleWrap">
                        <div className="support-chat__bubble">
                            {message.imageUrl ? <button type="button" className="support-chat__image" onClick={() => setPreviewUrl(message.imageUrl ?? null)}><img src={message.imageUrl} alt={t('聊天图片', 'Chat attachment', '聊天圖片')} /></button> : <p>{message.content}</p>}
                            {message.failed ? <button type="button" className="support-chat__retry" aria-label={t('重新发送', 'Retry', '重新傳送')} onClick={() => resendMessage(message)}><RefreshCw aria-hidden /></button> : null}
                        </div>
                        <div className="support-chat__meta">
                            <time>{messageTime(message.time, locale)}</time>
                            {message.pending ? <span>{t('发送中', 'Sending', '傳送中')}</span> : null}
                            {message.failed ? <span className="is-error">{t('发送失败，点击重试', 'Failed. Tap to retry.', '傳送失敗，點擊重試')}</span> : null}
                        </div>
                    </div>
                    {message.side === 'right' && !message.system ? <SupportAvatar user /> : null}
                </div>
            ))}
        </div>

        <footer className="support-chat__composerBar">
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" hidden onChange={handleImageUpload} />
            <button type="button" className="support-chat__upload" disabled={uploading} aria-label={t('上传图片', 'Upload image', '上傳圖片')} onClick={() => fileInputRef.current?.click()}>
                {uploading ? <Loader2 className="is-spinning" aria-hidden /> : <img src={uploadIcon} alt="" aria-hidden />}
            </button>
            <textarea ref={inputRef} rows={1} value={input} maxLength={2000} autoComplete="off" placeholder={t('请输入您的问题', 'Please enter your question', '請輸入您的問題')} onChange={(event) => setInput(event.currentTarget.value)} onKeyDown={handleKeyDown} />
            <button type="button" className="support-chat__send" onClick={sendText}>{t('发送', 'Send', '傳送')}</button>
        </footer>

        {previewUrl ? <div className="support-chat__preview" role="dialog" aria-modal="true" aria-label={t('图片预览', 'Image preview', '圖片預覽')} onClick={() => setPreviewUrl(null)}>
            <button type="button" aria-label={t('关闭', 'Close', '關閉')} onClick={() => setPreviewUrl(null)}><X aria-hidden /></button>
            <img src={previewUrl} alt="" onClick={(event) => event.stopPropagation()} />
        </div> : null}
    </main>;

    if (embedded) return chat;
    return <Page title="feedback_help" bodyClassName="support-chat-page" constrained>{chat}</Page>;
}
