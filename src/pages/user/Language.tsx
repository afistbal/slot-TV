import { Page } from "@/layouts/user";
import { cn } from "@/lib/utils";
import { useRootStore } from "@/stores/root";
import { Check } from "lucide-react";
import { APP_LANGUAGES } from "@/constants/appLanguages";

export default function Component() {
    const rootStore = useRootStore();

    function handleSelect(code: string) {
        if (rootStore.locale.indexOf(code) === 0) return;
        localStorage.setItem('locale', code);
        window.location.reload();
    }

    return (
        <Page title="language" bodyClassName="bg-app-canvas">
            <div className="rs-language">
                {APP_LANGUAGES.map((lang) => {
                    const active = rootStore.locale.indexOf(lang.code) === 0;
                    return (
                        <button
                            key={lang.code}
                            type="button"
                            className={cn(
                                'rs-language__item',
                                active && 'rs-language__item--active',
                            )}
                            onClick={() => handleSelect(lang.code)}
                        >
                            <span className="rs-language__label">{lang.label}</span>
                            {active ? (
                                <Check className="rs-language__check" aria-hidden strokeWidth={2.5} />
                            ) : null}
                        </button>
                    );
                })}
            </div>
        </Page>
    );
}
