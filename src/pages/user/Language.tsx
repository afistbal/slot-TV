import { Page } from "@/layouts/user";
import { cn } from "@/lib/utils";
import { useRootStore } from "@/stores/root";
import { CircleCheck, Circle } from "lucide-react";
import { APP_LANGUAGES } from "@/constants/appLanguages";

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
            {APP_LANGUAGES.map(lang => <div key={lang.code} className={cn("flex gap-2 justify-between items-center p-4 border-b last:border-none")} onClick={() => handleSelect(lang.code)}>
                <div className="flex gap-1 text-gray-600">
                    <div className="text-md">{lang.label}</div>
                </div>
                {rootStore.locale.indexOf(lang.code) === 0 ? <CircleCheck className='text-red-400 w-6 h-6' /> : <Circle className="text-slate-400 w-6 h-6" />}
            </div>)}
        </div>
    </Page>
}