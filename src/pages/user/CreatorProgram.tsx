import { ProgramSelect } from '@/components/ProgramSelect';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useIntl } from 'react-intl';
import { useNavigate, useSearchParams } from 'react-router';
import {
    AlertTriangle,
    BarChart3,
    Ban,
    CheckCircle2,
    MessageCircle,
    Package,
    ScrollText,
    Sparkles,
    Target,
    UploadCloud,
    WalletCards,
} from 'lucide-react';
import { toast } from 'sonner';
import { ProgramFlowPreview } from '@/components/ProgramFlowPreview';
import { ProgramIcon, type ProgramIconName } from '@/components/ProgramIcon';
import { ReelShortTopNav } from '@/components/ReelShortTopNav';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { BRAND_DISPLAY_NAME } from '@/constants/brand';
import { apiBaseURL } from '@/api/baseURL';
import { api, formatApiFailure } from '@/api';
import { useRootStore } from '@/stores/root';
import { useUserStore } from '@/stores/user';
import '@/styles/creator-program.scss';
import { CreatorWorkspace, loadCreatorWorkspace } from '@/components/CreatorWorkspace';
import type { CreatorRecord } from '@/api/creator';
import { creatorDemoDashboard, isCreatorDemo } from '@/data/creatorDemo';

type CreatorStatus = 'none' | 'pending' | 'rejected' | 'suspended' | 'approved';
type CreatorTab = 'dashboard' | 'feedback' | 'upload' | 'products' | 'commissions' | 'earnings' | 'licenses' | 'settings';

type CreatorApplication = {
    status: Exclude<CreatorStatus, 'none'>;
    displayName: string;
    contact: string;
    intro: string;
    sampleUrl: string;
    tools: string[];
    monthlyOutput: string;
    payoutMethod: string;
    submittedAt: string;
    reviewNote?: string;
};

const CREATOR_UPLOAD_CHUNK_SIZE = 50 * 1024 * 1024;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function valueFrom(source: UnknownRecord, ...keys: string[]): unknown {
    for (const key of keys) {
        if (source[key] !== undefined && source[key] !== null) return source[key];
    }
    return undefined;
}

function normalizeAuthor(data: unknown): CreatorApplication | null {
    if (data == null) return null;
    if (!isRecord(data)) return null;
    const nested = valueFrom(data, 'author', 'creator', 'application', 'data');
    const source = isRecord(nested) ? nested : data;
    const rawStatus = String(valueFrom(source, 'status', 'state', 'applicationStatus', 'application_status') ?? 'none');
    if (!['pending', 'rejected', 'suspended', 'approved'].includes(rawStatus)) return null;
    const rawTools = valueFrom(source, 'tools', 'tool_list');

    return {
        status: rawStatus as CreatorApplication['status'],
        displayName: String(valueFrom(source, 'displayName', 'display_name', 'name') ?? ''),
        contact: String(valueFrom(source, 'contact', 'contact_info') ?? ''),
        intro: String(valueFrom(source, 'intro', 'introduction', 'bio') ?? ''),
        sampleUrl: String(valueFrom(source, 'sampleUrl', 'sample_url') ?? ''),
        tools: Array.isArray(rawTools) ? rawTools.map(String) : typeof rawTools === 'string' ? rawTools.split(',').map((item) => item.trim()).filter(Boolean) : [],
        monthlyOutput: String(valueFrom(source, 'monthlyOutput', 'monthly_output') ?? ''),
        payoutMethod: String(valueFrom(source, 'payoutMethod', 'payout_method') ?? ''),
        submittedAt: String(valueFrom(source, 'submittedAt', 'submitted_at', 'created_at') ?? ''),
        reviewNote: String(valueFrom(source, 'reviewNote', 'review_note', 'reason') ?? '') || undefined,
    };
}

type CreatorSubmissionResponse = {
    data?: { submissionId?: string } | string | null;
    error?: { message?: string } | string | null;
    submissionId?: string;
};

function creatorApiUrl(path: string): string {
    const baseUrl = new URL(apiBaseURL, window.location.origin);
    return new URL(path.replace(/^\/+/, ''), baseUrl).toString();
}

function responseErrorMessage(payload: unknown, fallback: string): string {
    if (!payload || typeof payload !== 'object') return fallback;
    const error = (payload as { error?: unknown }).error;
    if (typeof error === 'string' && error.trim()) return error;
    if (error && typeof error === 'object') {
        const message = (error as { message?: unknown }).message;
        if (typeof message === 'string' && message.trim()) return message;
    }
    return fallback;
}

function formatFetchFailure(method: 'GET' | 'POST', path: string, response: Response, payload: unknown, fallback: string): string {
    const backendMessage = responseErrorMessage(payload, fallback);
    const statusText = response.statusText ? `${response.status} ${response.statusText}` : String(response.status);
    return `${method} /api/${path.replace(/^\/+/, '')}：${statusText} · ${backendMessage}`;
}

async function uploadCreatorEpisode({
    file,
    title,
    description,
    sequence,
    onProgress,
}: {
    file: File;
    title: string;
    description: string;
    sequence: number;
    onProgress: (progress: number) => void;
}): Promise<void> {
    const accessToken = localStorage.getItem('token')?.trim();
    if (!accessToken) throw new Error('请先登录后再上传');

    const authorization = { Authorization: `Bearer ${accessToken}` };
    const createResponse = await fetch(creatorApiUrl('creator/submissions'), {
        method: 'POST',
        headers: {
            ...authorization,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, description, seq: sequence }),
    });
    const createPayload = await createResponse.json().catch(() => null) as CreatorSubmissionResponse | null;
    if (!createResponse.ok || createPayload?.error) {
        throw new Error(formatFetchFailure('POST', 'creator/submissions', createResponse, createPayload, '创建剧集失败'));
    }

    const submissionId = typeof createPayload?.data === 'string'
        ? createPayload.data
        : createPayload?.data?.submissionId ?? createPayload?.submissionId;
    if (!submissionId) throw new Error('创建剧集后未返回 submissionId');

    const uploadUrl = creatorApiUrl(`creator/upload?sub=${encodeURIComponent(submissionId)}`);
    const initResponse = await fetch(`${uploadUrl}&action=init`, {
        method: 'POST',
        headers: authorization,
    });
    const initPayload = await initResponse.json().catch(() => null) as { uploadId?: string; error?: unknown } | null;
    if (!initResponse.ok || !initPayload?.uploadId) {
        throw new Error(formatFetchFailure('POST', 'creator/upload?action=init', initResponse, initPayload, '初始化上传失败'));
    }

    const partCount = Math.ceil(file.size / CREATOR_UPLOAD_CHUNK_SIZE);
    const parts: Array<{ partNumber: number; etag: string }> = [];
    for (let index = 0; index < partCount; index += 1) {
        const partNumber = index + 1;
        const chunk = file.slice(
            index * CREATOR_UPLOAD_CHUNK_SIZE,
            Math.min(file.size, partNumber * CREATOR_UPLOAD_CHUNK_SIZE),
        );
        const partResponse = await fetch(
            `${uploadUrl}&action=part&uploadId=${encodeURIComponent(initPayload.uploadId)}&partNumber=${partNumber}`,
            {
                method: 'POST',
                headers: {
                    ...authorization,
                    'Content-Type': 'application/octet-stream',
                },
                body: chunk,
            },
        );
        const partPayload = await partResponse.json().catch(() => null) as { etag?: string; error?: unknown } | null;
        if (!partResponse.ok || !partPayload?.etag) {
            throw new Error(formatFetchFailure('POST', 'creator/upload?action=part', partResponse, partPayload, `第 ${partNumber} 个分片上传失败`));
        }
        parts.push({ partNumber, etag: partPayload.etag });
        onProgress(Math.round((partNumber / partCount) * 100));
    }

    const completeResponse = await fetch(
        `${uploadUrl}&action=complete&uploadId=${encodeURIComponent(initPayload.uploadId)}`,
        {
            method: 'POST',
            headers: {
                ...authorization,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ parts }),
        },
    );
    if (!completeResponse.ok) {
        const completePayload = await completeResponse.json().catch(() => null);
        throw new Error(formatFetchFailure('POST', 'creator/upload?action=complete', completeResponse, completePayload, '完成上传失败'));
    }
}

function ProgramFeature({
    icon,
    title,
    description,
    points,
    tone,
}: {
    icon: ProgramIconName;
    title: string;
    description: string;
    points: string[];
    tone: 'green' | 'gold';
}) {
    return (
        <article className={`creator-program__feature-card creator-program__feature-card--${tone}`}>
            <div className="creator-program__feature-heading">
                <span className="creator-program__icon"><ProgramIcon name={icon} /></span>
                <h3>{title}</h3>
            </div>
            <p>{description}</p>
            <ul>
                {points.map((point) => (
                    <li key={point}><ProgramIcon name="check" />{point}</li>
                ))}
            </ul>
        </article>
    );
}

function ProgramAdvantage({ icon, title, description, tone }: { icon: ProgramIconName; title: string; description: string; tone: 'green' | 'gold' }) {
    return (
        <article className={`creator-program__advantage-card creator-program__advantage-card--${tone}`}>
            <span><ProgramIcon name={icon} /></span>
            <h3>{title}</h3>
            <p>{description}</p>
        </article>
    );
}

function ProgramReasonCard({ title, description, tone }: { title: string; description: string; tone: 'green' | 'gold' }) {
    return <article className={`creator-program__reason-card creator-program__reason-card--${tone}`}><span><ProgramIcon name="check" /></span><div><h3>{title}</h3><p>{description}</p></div></article>;
}

function ProgramRequirementCard({ icon, title, description }: { icon: ProgramIconName | 'age'; title: string; description: string }) {
    return <article className="creator-program__requirement-card"><span>{icon === 'age' ? '18+' : <ProgramIcon name={icon} />}</span><h3>{title}</h3><p>{description}</p></article>;
}

function CreatorApplicationDialog({
    open,
    onOpenChange,
    onSubmitted,
    onPreviewSubmitted,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmitted: (application: CreatorApplication) => void;
    onPreviewSubmitted?: () => void;
}) {
    const intl = useIntl();
    const t = (id: string) => intl.formatMessage({ id });
    const [agreed, setAgreed] = useState(false);
    const [tools, setTools] = useState<string[]>([]);
    const [toolDraft, setToolDraft] = useState('');
    const toolInputRef = useRef<HTMLInputElement>(null);
    const [introLength, setIntroLength] = useState(0);
    const [submitting, setSubmitting] = useState(false);

    function addTool() {
        const nextTool = toolDraft.trim();
        if (!nextTool) {
            toolInputRef.current?.focus();
            toast.error(t('creator_apply_tools_empty'));
            return;
        }
        if (tools.includes(nextTool)) {
            toolInputRef.current?.focus();
            toast.error(t('creator_apply_tools_duplicate'));
            return;
        }
        setTools((current) => [...current, nextTool]);
        setToolDraft('');
        toolInputRef.current?.focus();
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (onPreviewSubmitted) {
            onPreviewSubmitted();
            onOpenChange(false);
            return;
        }
        const form = event.currentTarget;
        const data = new FormData(form);
        const payoutMethod = Number(data.get('payoutMethod'));
        if (![1, 2, 3, 4].includes(payoutMethod)) {
            toast.error(t('creator_apply_payout'));
            return;
        }
        const normalizedTools = Array.from(new Set([...tools, toolDraft.trim()].filter(Boolean)));
        const application: CreatorApplication = {
            status: 'pending',
            displayName: String(data.get('displayName') ?? '').trim(),
            contact: String(data.get('contact') ?? '').trim(),
            intro: String(data.get('intro') ?? '').trim(),
            sampleUrl: String(data.get('sampleUrl') ?? '').trim(),
            tools: normalizedTools,
            monthlyOutput: String(data.get('monthlyOutput') ?? ''),
            payoutMethod: String(payoutMethod),
            submittedAt: new Date().toISOString(),
        };
        setSubmitting(true);
        const result = await api<unknown>('user/author', {
            method: 'post',
            loading: false,
            toastOnError: false,
            data: {
                displayName: application.displayName,
                contact: application.contact,
                intro: application.intro,
                sampleUrl: application.sampleUrl,
                tools: application.tools,
                monthlyOutput: application.monthlyOutput,
                payoutMethod,
            },
        });
        if (result.c !== 0) {
            setSubmitting(false);
            toast.error(formatApiFailure('POST', 'user/author', result));
            return;
        }

        const statusResult = await api<unknown>('creator/dashboard', {
            method: 'post',
            loading: false,
            toastOnError: false,
        });
        setSubmitting(false);
        const confirmedApplication = statusResult.c === 0 ? normalizeAuthor(statusResult.d) : null;
        if (statusResult.c !== 0) {
            toast.error(formatApiFailure('POST', 'creator/dashboard', statusResult));
        } else if (!confirmedApplication) {
            toast.error('POST /api/creator/dashboard：200 · 申请成功，但状态接口未返回 pending 状态');
        }
        onSubmitted(confirmedApplication ?? application);
        onOpenChange(false);
        toast.success(t('creator_apply_success'));
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="creator-apply-dialog">
                <DialogHeader>
                    <DialogTitle>{t('creator_apply_title')}</DialogTitle>
                    <DialogDescription>{t('creator_apply_description')}</DialogDescription>
                </DialogHeader>
                <form id="creator-application-form" className="creator-apply-dialog__form" onSubmit={handleSubmit}>
                    <label className="creator-apply-dialog__full">
                        <span>{t('creator_apply_name')} <b aria-hidden="true">*</b></span>
                        <input name="displayName" required maxLength={30} placeholder={t('creator_apply_name_placeholder')} />
                    </label>
                    <label className="creator-apply-dialog__full">
                        <span>{t('creator_apply_contact')} <b aria-hidden="true">*</b></span>
                        <input name="contact" required maxLength={100} placeholder={t('creator_apply_contact_placeholder')} />
                    </label>
                    <label className="creator-apply-dialog__full">
                        <span>{t('creator_apply_intro')} <b aria-hidden="true">*</b></span>
                        <small className="creator-apply-dialog__hint">{t('creator_apply_intro_placeholder')}</small>
                        <textarea name="intro" required minLength={50} maxLength={1000} rows={4} placeholder={t('creator_apply_intro_placeholder')} onChange={(event) => setIntroLength(event.target.value.length)} />
                        <small className="creator-apply-dialog__counter">{introLength}/1000</small>
                    </label>
                    <label className="creator-apply-dialog__full">
                        <span>{t('creator_apply_sample')} <b aria-hidden="true">*</b></span>
                        <input name="sampleUrl" required type="url" maxLength={300} pattern="https://.*" placeholder="https://" />
                    </label>
                    <div className="creator-apply-dialog__tools creator-apply-dialog__full">
                        <span>{t('creator_apply_tools')}</span>
                        <small className="creator-apply-dialog__hint">{t('creator_apply_tools_hint')}</small>
                        {tools.length ? <div className="creator-apply-dialog__tags">{tools.map((tool) => <button key={tool} type="button" onClick={() => setTools((current) => current.filter((item) => item !== tool))}>{tool}<span>×</span></button>)}</div> : null}
                        <div className="creator-apply-dialog__tool-input"><input ref={toolInputRef} value={toolDraft} maxLength={40} placeholder={t('creator_apply_tools_placeholder')} onChange={(event) => setToolDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTool(); } }} /><button type="button" aria-label={t('creator_apply_tools_add')} title={t('creator_apply_tools_add')} onClick={addTool}>+</button></div>
                    </div>
                    <label>
                        <span>{t('creator_apply_output')}</span>
                        <input name="monthlyOutput" maxLength={50} placeholder={t('creator_apply_output_placeholder')} />
                    </label>
                    <label>
                        <span>{t('creator_apply_payout')}</span>
                        <ProgramSelect aria-label={t('creator_apply_payout')} name="payoutMethod" required defaultValue={1} options={[
                            { value: 1, label: 'USDT (TRC20)' },
                            { value: 2, label: 'PayPal' },
                            { value: 3, label: t('creator_apply_payout_alipay') + ' / Alipay' },
                            { value: 4, label: t('creator_apply_payout_bank') + ' / Bank Wire' },
                        ]} />
                    </label>
                    <details className="creator-apply-dialog__agreement-details creator-apply-dialog__full">
                        <summary>{t('creator_apply_agreement_title')}</summary>
                        <p>{t('creator_apply_agreement_content')}</p>
                    </details>
                    <label className="creator-apply-dialog__agreement-check creator-apply-dialog__full">
                        <input type="checkbox" required checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
                        <span>{t('creator_apply_agree')}</span>
                    </label>
                    <button type="submit" className="creator-program__button creator-apply-dialog__submit creator-apply-dialog__full" disabled={!agreed || submitting}>
                        {submitting ? t('loading') : t('creator_apply_submit')}
                    </button>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function CreatorPending() {
    const intl = useIntl();
    const t = (id: string) => intl.formatMessage({ id });

    return (
        <main className="creator-program__status-shell">
            <section className="creator-program__status-card">
                <span className="creator-program__status-icon creator-program__status-icon--pending"><ProgramIcon name="clock" /></span>
                <h1>{t('creator_review_title')}</h1>
                <p>{t('creator_review_description')}</p>
            </section>
        </main>
    );
}

function CreatorRejected({ application, onReapply }: { application: CreatorApplication | null; onReapply: () => void }) {
    const intl = useIntl();
    const t = (id: string) => intl.formatMessage({ id });

    return (
        <main className="creator-program__status-shell">
            <section className="creator-program__status-card">
                <span className="creator-program__status-icon creator-program__status-icon--rejected"><AlertTriangle /></span>
                <span className="creator-program__status-badge creator-program__status-badge--rejected">{t('creator_rejected_badge')}</span>
                <h1>{t('creator_rejected_title')}</h1>
                <p>{application?.reviewNote || t('creator_rejected_description')}</p>
                <button type="button" className="creator-program__button creator-program__button--large" onClick={onReapply}>{t('creator_reapply')}</button>
            </section>
        </main>
    );
}

function CreatorSuspended() {
    const intl = useIntl();
    const t = (id: string) => intl.formatMessage({ id });

    return (
        <main className="creator-program__status-shell">
            <section className="creator-program__status-card">
                <span className="creator-program__status-icon creator-program__status-icon--suspended"><Ban /></span>
                <span className="creator-program__status-badge creator-program__status-badge--suspended">{t('creator_suspended_badge')}</span>
                <h1>{t('creator_suspended_title')}</h1>
                <p>{t('creator_suspended_description')}</p>
            </section>
        </main>
    );
}

function CreatorDashboard({ application, data, demoMode = false }: { application: CreatorApplication | null; data: CreatorRecord; demoMode?: boolean }) {
    const intl = useIntl();
    const t = (id: string) => intl.formatMessage({ id });
    const [dashboardSearchParams, setDashboardSearchParams] = useSearchParams();
    const requestedTab = dashboardSearchParams.get('tab') as CreatorTab | null;
    const validTabs: CreatorTab[] = ['dashboard', 'feedback', 'upload', 'products', 'commissions', 'earnings', 'licenses', 'settings'];
    const [activeTab, setActiveTab] = useState<CreatorTab>(requestedTab && validTabs.includes(requestedTab) ? requestedTab : 'dashboard');
    function selectTab(tab: CreatorTab) {
        setActiveTab(tab);
        const next = new URLSearchParams(dashboardSearchParams);
        next.set('tab', tab);
        setDashboardSearchParams(next);
    }
    useEffect(() => {
        if (requestedTab && validTabs.includes(requestedTab)) setActiveTab(requestedTab);
    }, [requestedTab]);
    const [workspace, setWorkspace] = useState(data);
    useEffect(() => { setWorkspace(data); }, [data]);
    async function refreshWorkspace() { setWorkspace(await loadCreatorWorkspace()); }
    const uploadInputRef = useRef<HTMLInputElement>(null);
    const [uploadTitle, setUploadTitle] = useState('');
    const [uploadDescription, setUploadDescription] = useState('');
    const [uploadSequence, setUploadSequence] = useState(1);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState(-1);
    const canMutate = application?.status === 'approved' && !demoMode && !isCreatorDemo(workspace) && !dashboardSearchParams.has('preview');
    const tabs: Array<{ id: CreatorTab; label: string; icon: ReactNode }> = [
        { id: 'dashboard', label: t('creator_dashboard_overview'), icon: <BarChart3 /> },
        { id: 'feedback', label: t('creator_dashboard_feedback'), icon: <MessageCircle /> },
        { id: 'upload', label: t('creator_dashboard_upload'), icon: <UploadCloud /> },
        { id: 'products', label: t('creator_dashboard_products'), icon: <Package /> },
        { id: 'commissions', label: t('creator_dashboard_commissions'), icon: <Target /> },
        { id: 'earnings', label: t('creator_dashboard_earnings'), icon: <WalletCards /> },
        { id: 'licenses', label: t('creator_dashboard_licenses'), icon: <ScrollText /> },
        { id: 'settings', label: t('creator_dashboard_settings'), icon: <Sparkles /> },
    ];

    function selectUploadFile(file: File | null) {
        if (file && !file.name.toLowerCase().endsWith('.mp4')) {
            toast.error(t('creator_upload_mp4_only'));
            if (uploadInputRef.current) uploadInputRef.current.value = '';
            setUploadFile(null);
            return;
        }
        setUploadFile(file);
    }

    async function submitUpload(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!canMutate) return;
        if (!uploadTitle.trim() || !uploadDescription.trim() || !uploadFile || uploadProgress >= 0) return;
        if (uploadFile.size <= 0) {
            toast.error(t('creator_upload_empty_file'));
            return;
        }
        setUploadProgress(0);
        try {
            await uploadCreatorEpisode({
                file: uploadFile,
                title: uploadTitle.trim(),
                description: uploadDescription.trim(),
                sequence: uploadSequence,
                onProgress: setUploadProgress,
            });
            await refreshWorkspace();
            toast.success(t('creator_upload_ready'));
            setUploadTitle('');
            setUploadDescription('');
            setUploadSequence(1);
            setUploadFile(null);
            if (uploadInputRef.current) uploadInputRef.current.value = '';
        } catch (error) {
            toast.error(error instanceof Error ? error.message : t('creator_upload_failed'));
        } finally {
            setUploadProgress(-1);
        }
    }

    return (
        <main className="creator-dashboard">
            <div className="creator-dashboard__heading">
                <div>
                    <span className="creator-program__status-badge creator-program__status-badge--approved"><CheckCircle2 />{t(demoMode || isCreatorDemo(workspace) ? 'creator_demo_title' : 'creator_dashboard_approved')}</span>
                    <h1>{t('creator_dashboard_title')}</h1>
                    <p>{application?.displayName || t('creator_dashboard_welcome')}</p>
                </div>
                <button className="creator-program__button" type="button" onClick={() => selectTab('upload')}>
                    <UploadCloud />{t('creator_dashboard_upload_work')}
                </button>
            </div>

            <nav className="creator-dashboard__tabs" aria-label={t('creator_dashboard_title')}>
                {tabs.map((tab) => (
                    <button key={tab.id} type="button" className={activeTab === tab.id ? 'is-active' : ''} onClick={() => selectTab(tab.id)}>
                        {tab.icon}<span>{tab.label}</span>
                    </button>
                ))}
            </nav>

            {isCreatorDemo(workspace) ? <p className="creator-workspace__demo">{t('creator_demo_notice')}</p> : null}
            <CreatorWorkspace key={activeTab} tab={activeTab} data={workspace} onRefresh={refreshWorkspace} canMutate={canMutate} />

            {activeTab === 'upload' ? (
                <div className="creator-upload">
                    <section className="creator-dashboard__panel creator-upload__card">
                        <div className="creator-dashboard__panel-heading">
                            <div><h2>{t('creator_dashboard_upload_title')}</h2><p>{t('creator_dashboard_upload_desc')}</p></div>
                        </div>
                        <form className="creator-upload__form" onSubmit={submitUpload}>
                            <label className="creator-upload__title-field">
                                <span>{t('creator_upload_title')}</span>
                                <input required disabled={uploadProgress >= 0} maxLength={60} value={uploadTitle} onChange={(event) => setUploadTitle(event.target.value)} placeholder={t('creator_upload_title_placeholder')} />
                                <small>{uploadTitle.length}/60</small>
                            </label>
                            <label className="creator-upload__sequence-field">
                                <span>{t('creator_upload_sequence')}</span>
                                <input required disabled={uploadProgress >= 0} type="number" min={1} max={999} value={uploadSequence} onChange={(event) => setUploadSequence(Math.min(999, Math.max(1, Number(event.target.value) || 1)))} />
                            </label>
                            <label className="creator-upload__description-field">
                                <span>{t('creator_upload_description')}</span>
                                <textarea required disabled={uploadProgress >= 0} maxLength={1000} rows={4} value={uploadDescription} onChange={(event) => setUploadDescription(event.target.value)} placeholder={t('creator_upload_description_placeholder')} />
                                <small>{uploadDescription.length}/1000</small>
                            </label>
                            <div className="creator-upload__file-field">
                                <span>{t('creator_upload_file')}</span>
                                <input ref={uploadInputRef} className="creator-upload__native-input" disabled={uploadProgress >= 0} type="file" accept="video/mp4,.mp4" onChange={(event) => selectUploadFile(event.target.files?.[0] ?? null)} />
                                <button className={`creator-upload__picker${uploadFile ? ' is-selected' : ''}`} type="button" disabled={uploadProgress >= 0} onClick={() => uploadInputRef.current?.click()}>
                                    <span className="creator-upload__picker-icon"><ProgramIcon name={uploadFile ? 'checkCircle' : 'play'} /></span>
                                    <span className="creator-upload__picker-copy">
                                        <b>{uploadFile ? uploadFile.name : t('creator_upload_choose')}</b>
                                        <small>{uploadFile ? `${(uploadFile.size / 1024 / 1024).toFixed(1)} MB` : t('creator_upload_file_hint')}</small>
                                    </span>
                                    <span className="creator-upload__picker-action">{uploadFile ? t('creator_upload_replace') : t('creator_upload_browse')}</span>
                                </button>
                            </div>
                            {uploadProgress >= 0 ? (
                                <div className="creator-upload__progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadProgress}>
                                    <span style={{ width: `${uploadProgress}%` }} />
                                    <small>{t('creator_upload_uploading')} {uploadProgress}%</small>
                                </div>
                            ) : null}
                            <button className="creator-program__button creator-upload__submit" type="submit" disabled={!canMutate || !uploadTitle.trim() || !uploadDescription.trim() || !uploadFile || uploadProgress >= 0}>
                                <UploadCloud />{uploadProgress >= 0 ? `${t('creator_upload_uploading')} ${uploadProgress}%` : t('creator_upload_submit')}
                            </button>
                            <p className="creator-upload__hint">{t('creator_upload_review_hint')}</p>
                        </form>
                    </section>
                    <section className="creator-dashboard__panel creator-upload__card creator-upload__content-card">
                        <div className="creator-dashboard__panel-heading"><div><h2>{t('creator_upload_my_content')}</h2><p>{t('creator_upload_my_content_desc')}</p></div></div>
                        {Array.isArray(workspace.contentStats) && workspace.contentStats.length ? workspace.contentStats.map((entry, index) => {
                            const work = entry as CreatorRecord;
                            return <article className="creator-workspace__item" key={String(work.dramaId ?? index)}><h3>{String(work.title ?? '')}</h3><p>{String(work.status ?? '')} · {String(work.episodeCount ?? 0)} {t('creator_upload_sequence')}</p></article>;
                        }) : <div className="creator-upload__empty"><span><ProgramIcon name="play" /></span><p>{t('creator_upload_empty')}</p></div>}
                    </section>
                </div>
            ) : null}




        </main>
    );
}

export default function CreatorProgram() {
    const intl = useIntl();
    const t = (id: string) => intl.formatMessage({ id });
    const navigate = useNavigate();
    const userStore = useUserStore();
    const sessionBootstrapReady = useRootStore((store) => store.sessionBootstrapReady);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const [application, setApplication] = useState<CreatorApplication | null>(null);
    const [dashboardData, setDashboardData] = useState<CreatorRecord>({});
    const [openFaq, setOpenFaq] = useState<number | null>(0);
    const [applyOpen, setApplyOpen] = useState(() => searchParams.get('preview') === 'apply');
    const rawPreview = searchParams.get('preview');
    const preview = rawPreview && ['none', 'apply', 'pending', 'rejected', 'suspended', 'approved'].includes(rawPreview) ? rawPreview : null;
    const demoMode = searchParams.get('demo') === '1';
    const status: CreatorStatus = demoMode ? 'approved' : preview === 'apply' || preview === 'none'
        ? 'none'
        : preview === 'approved' || preview === 'pending' || preview === 'rejected' || preview === 'suspended'
        ? preview
        : application?.status ?? 'none';

    function selectPreview(nextPreview: string) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('demo');
        nextParams.set('preview', nextPreview);
        setSearchParams(nextParams, { replace: true });
        setApplyOpen(nextPreview === 'apply');
    }

    const previewSteps = [
        { id: 'none', label: t('creator_preview_landing') },
        { id: 'apply', label: t('creator_preview_apply') },
        { id: 'pending', label: t('creator_preview_pending') },
        { id: 'rejected', label: t('creator_preview_rejected') },
        { id: 'suspended', label: t('creator_preview_suspended') },
        { id: 'approved', label: t('creator_preview_approved') },
    ];
    const requiresLogin = !userStore.signed || userStore.isAnonymous();

    const loadAuthor = useCallback(async () => {
        const result = await api<unknown>('creator/dashboard', { method: 'post', loading: false, toastOnError: false });
        if (result.c !== 0 || (result.d != null && !isRecord(result.d))) {
            setDashboardData((current) => Object.keys(current).length ? current : creatorDemoDashboard());
            return;
        }
        setDashboardData(isRecord(result.d) ? result.d : {});
        setApplication(normalizeAuthor(result.d));
    }, []);

    useEffect(() => {
        if (sessionBootstrapReady) void loadAuthor();
    }, [loadAuthor, sessionBootstrapReady]);

    function startApplication() {
        if (requiresLogin && !preview) {
            navigate('/page/login');
            return;
        }
        setApplyOpen(true);
    }

    const features = [
        {
            icon: 'play' as const,
            title: t('creator_feature_streaming'),
            description: intl.formatMessage({ id: 'creator_feature_streaming_desc' }, { brand: BRAND_DISPLAY_NAME }),
            points: [t('creator_feature_streaming_1'), t('creator_feature_streaming_2'), t('creator_feature_streaming_3'), t('creator_feature_streaming_4')],
            tone: 'green' as const,
        },
        {
            icon: 'unlock' as const,
            title: t('creator_feature_download'),
            description: t('creator_feature_download_desc'),
            points: [t('creator_feature_download_1'), t('creator_feature_download_2'), t('creator_feature_download_3'), t('creator_feature_download_4')],
            tone: 'green' as const,
        },
        {
            icon: 'send' as const,
            title: t('creator_feature_commission'),
            description: t('creator_feature_commission_desc'),
            points: [t('creator_feature_commission_1'), t('creator_feature_commission_2'), t('creator_feature_commission_3'), t('creator_feature_commission_4')],
            tone: 'gold' as const,
        },
        {
            icon: 'crown' as const,
            title: t('creator_feature_exclusive'),
            description: t('creator_feature_exclusive_desc'),
            points: [t('creator_feature_exclusive_1'), t('creator_feature_exclusive_2'), t('creator_feature_exclusive_3'), t('creator_feature_exclusive_4')],
            tone: 'gold' as const,
        },
    ];

    const advantages = [
        { icon: 'flame' as const, title: t('creator_advantage_traffic'), description: t('creator_advantage_traffic_desc'), tone: 'green' as const },
        { icon: 'lock' as const, title: t('creator_advantage_secure'), description: t('creator_advantage_secure_desc'), tone: 'green' as const },
        { icon: 'coin' as const, title: t('creator_advantage_payment'), description: t('creator_advantage_payment_desc'), tone: 'gold' as const },
        { icon: 'eye' as const, title: t('creator_advantage_dashboard'), description: t('creator_advantage_dashboard_desc'), tone: 'gold' as const },
    ];

    const reasons = [
        { title: t('creator_why_share'), description: t('creator_why_share_desc'), tone: 'green' as const },
        { title: t('creator_why_freedom'), description: t('creator_why_freedom_desc'), tone: 'green' as const },
        { title: t('creator_why_fast'), description: t('creator_why_fast_desc'), tone: 'green' as const },
        { title: t('creator_why_support'), description: t('creator_why_support_desc'), tone: 'gold' as const },
    ];

    const requirements = [
        { icon: 'age' as const, title: t('creator_req_age'), description: t('creator_req_age_desc') },
        { icon: 'sparkle' as const, title: t('creator_req_original'), description: t('creator_req_original_desc') },
        { icon: 'play' as const, title: t('creator_req_skill'), description: t('creator_req_skill_desc') },
    ];

    const faqs = [
        { question: t('creator_faq_q1'), answer: t('creator_faq_a1') },
        { question: t('creator_faq_q2'), answer: t('creator_faq_a2') },
        { question: t('creator_faq_q3'), answer: t('creator_faq_a3') },
        { question: t('creator_faq_q4'), answer: t('creator_faq_a4') },
        { question: t('creator_faq_q5'), answer: t('creator_faq_a5') },
    ];

    return (
        <div className="creator-program-page">
            <div ref={scrollRef} className="creator-program-page__scroll">
                <ReelShortTopNav scrollParentRef={scrollRef} showPrimaryNav />
                <ProgramFlowPreview title={t('program_preview_title')} hint={t('program_preview_hint')} active={preview ?? status} steps={previewSteps} onSelect={selectPreview} exitLabel={t('program_preview_exit')} onExit={preview || demoMode ? () => { const next = new URLSearchParams(searchParams); next.delete('preview'); next.delete('demo'); setApplyOpen(false); setSearchParams(next, { replace: true }); } : undefined} />
                {status === 'pending' ? <CreatorPending /> : null}
                {status === 'rejected' ? <CreatorRejected application={application} onReapply={() => setApplyOpen(true)} /> : null}
                {status === 'suspended' ? <CreatorSuspended /> : null}
                {status === 'approved' ? <CreatorDashboard key={demoMode || preview === 'approved' ? 'demo' : 'live'} application={application} data={demoMode || preview === 'approved' ? creatorDemoDashboard() : dashboardData} demoMode={demoMode || preview === 'approved'} /> : null}
                {status === 'none' ? (
                    <main className="creator-program">
                        <section className="creator-program__hero">
                            <span className="creator-program__hero-icon"><ProgramIcon name="crown" /></span>
                            <h1>{t('creator_title')}</h1>
                            <p>{intl.formatMessage({ id: 'creator_subtitle' }, { brand: BRAND_DISPLAY_NAME })}</p>
                            <button className="creator-program__button creator-program__button--large" type="button" onClick={startApplication}>
                                <ProgramIcon name="sparkle" />{t(requiresLogin ? 'creator_apply_login' : 'creator_apply_now')}
                            </button>
                        </section>

                        <section className="creator-program__section">
                            <div className="creator-program__section-heading"><h2>{t('creator_section_monetize_title')}</h2></div>
                            <div className="creator-program__feature-grid">{features.map((feature) => <ProgramFeature key={feature.title} {...feature} />)}</div>
                        </section>

                        <section className="creator-program__section creator-program__section--advantages">
                            <div className="creator-program__section-heading"><h2>{t('creator_advantages_title')}</h2></div>
                            <div className="creator-program__advantages">
                                {advantages.map((advantage) => <ProgramAdvantage key={advantage.title} {...advantage} />)}
                            </div>
                        </section>

                        <section className="creator-program__section">
                            <div className="creator-program__section-heading"><h2>{t('creator_why_title')}</h2></div>
                            <div className="creator-program__reasons">{reasons.map((item) => <ProgramReasonCard key={item.title} {...item} />)}</div>
                        </section>

                        <section className="creator-program__boost"><ProgramIcon name="sparkle" /><h2>{t('creator_boost_title')}</h2><p>{t('creator_boost_desc')}</p></section>

                        <section className="creator-program__section">
                            <div className="creator-program__section-heading"><h2>{t('creator_requirements_title')}</h2></div>
                            <div className="creator-program__requirements">{requirements.map((item) => <ProgramRequirementCard key={item.title} {...item} />)}</div>
                        </section>

                        <section className="creator-program__section creator-program__section--process">
                            <div className="creator-program__section-heading"><h2>{t('creator_process_title')}</h2></div>
                            <div className="creator-program__process">
                                <div><b>1</b><h3>{t('creator_process_apply')}</h3><p>{t('creator_process_apply_desc')}</p></div>
                                <div><b>2</b><h3>{t('creator_process_review')}</h3><p>{t('creator_process_review_desc')}</p></div>
                                <div><b>3</b><h3>{t('creator_process_earn')}</h3><p>{t('creator_process_earn_desc')}</p></div>
                            </div>
                        </section>

                        <section className="creator-program__section">
                            <div className="creator-program__section-heading"><h2>{t('creator_faq_title')}</h2></div>
                            <div className="creator-program__faq">{faqs.map((item, index) => <details key={item.question} open={openFaq === index}><summary onClick={(event) => { event.preventDefault(); setOpenFaq((current) => current === index ? null : index); }}><span>{item.question}</span><ProgramIcon name="chevronDown" className="is-closed" /><ProgramIcon name="chevronUp" className="is-open" /></summary><p>{item.answer}</p></details>)}</div>
                        </section>

                        <section className="creator-program__community">
                            <h2>{t('creator_community_title')}</h2>
                            <div>
                                <a className="creator-program__button creator-program__button--ghost" href="https://x.com" target="_blank" rel="noreferrer"><ProgramIcon name="x" />{t('creator_community_x')}</a>
                                <a className="creator-program__button creator-program__button--ghost" href="https://t.me" target="_blank" rel="noreferrer"><ProgramIcon name="telegram" />{t('creator_community_tg')}</a>
                            </div>
                        </section>

                        <section className="creator-program__bottom-cta"><button className="creator-program__button creator-program__button--gold" type="button" onClick={startApplication}><ProgramIcon name="crown" />{t(requiresLogin ? 'creator_apply_login' : 'creator_apply_now')}</button></section>
                    </main>
                ) : null}
            </div>
            <CreatorApplicationDialog
                open={applyOpen}
                onOpenChange={setApplyOpen}
                onPreviewSubmitted={preview || demoMode ? () => selectPreview('pending') : undefined}
                onSubmitted={(nextApplication) => {
                    setApplication(nextApplication);
                    const nextParams = new URLSearchParams(searchParams);
                    nextParams.delete('preview');
                    setSearchParams(nextParams, { replace: true });
                }}
            />
        </div>
    );
}
