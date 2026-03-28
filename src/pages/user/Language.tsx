import { Page } from "@/layouts/user";
import { cn } from "@/lib/utils";
import { useRootStore } from "@/stores/root";
import { CircleCheck, Circle } from "lucide-react";

const languages = [
    { code: 'en', label: 'English' }, // 英语
    { code: 'zh', label: '繁體中文' }, // 繁体中文
    { code: 'ja', label: '日本語' }, // 日语
    { code: 'ko', label: '한국어' }, // 韩语
    { code: 'pt', label: 'Português' }, // 葡萄牙语
    { code: 'vi', label: 'Tiếng Việt' }, // 越南语
    { code: 'th', label: 'ภาษาไทย' }, // 泰语
    { code: 'tr', label: 'Türkçe' }, // 土耳其语
    { code: 'id', label: 'Bahasa Indonesia' }, // 印度尼西亚语
    { code: 'de', label: 'Deutsch' }, // 德语
    { code: 'ms', label: 'Bahasa Malaysia' }, // 马来语
    { code: 'ar', label: 'العربية' }, // 阿拉伯语
];

export default function Component() {
    const rootStore = useRootStore();

    function handleSelect(code: string) {
        if (rootStore.locale === code) return;
        // rootStore.setLocale(code);
        localStorage.setItem('locale', code);
        window.location.reload();
    }

    return <Page title="language">
        <div className="m-4 rounded-md bg-white">
            {languages.map(lang => <div key={lang.code} className={cn("flex gap-2 justify-between items-center p-4 border-b last:border-none")} onClick={() => handleSelect(lang.code)}>
                <div className="flex gap-1 text-gray-600">
                    <div className="text-md">{lang.label}</div>
                </div>
                {rootStore.locale.indexOf(lang.code) === 0 ? <CircleCheck className='text-red-400 w-6 h-6' /> : <Circle className="text-slate-400 w-6 h-6" />}
            </div>)}
        </div>
    </Page>
}