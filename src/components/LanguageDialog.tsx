import * as RadioGroup from '@radix-ui/react-radio-group';
import { Check, X } from 'lucide-react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { APP_LANGUAGES } from '@/constants/appLanguages';
import { useRootStore } from '@/stores/root';
import '@/styles/language-dialog.scss';

export function LanguageDialog({ open, onOpenChange }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const intl = useIntl();
    const locale = useRootStore(state => state.locale);
    const setLocale = useRootStore(state => state.setLocale);

    return <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
            contentPreset="plain"
            hideCloseButton
            aria-describedby={undefined}
            className="language-dialog"
            overlayClassName="language-dialog__overlay"
        >
            <div className="language-dialog__handle" aria-hidden />
            <div className="language-dialog__header">
                <DialogTitle unsetTypography className="language-dialog__title"><FormattedMessage id="language" /></DialogTitle>
                <DialogClose className="language-dialog__close" aria-label={intl.formatMessage({ id: 'close' })}>
                    <X size={16} aria-hidden />
                </DialogClose>
            </div>
            <RadioGroup.Root className="language-dialog__options" aria-label={intl.formatMessage({ id: 'language' })} value={locale}>
                {APP_LANGUAGES.map(language => <RadioGroup.Item
                    key={language.code}
                    value={language.code}
                    className="language-dialog__option"
                    onClick={() => {
                        if (locale !== language.code) setLocale(language.code);
                        onOpenChange(false);
                    }}
                >
                    <span>{language.label}</span>
                    <RadioGroup.Indicator className="language-dialog__check"><Check size={16} strokeWidth={2.4} aria-hidden /></RadioGroup.Indicator>
                </RadioGroup.Item>)}
            </RadioGroup.Root>
        </DialogContent>
    </Dialog>;
}
