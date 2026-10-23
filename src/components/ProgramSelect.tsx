import { useEffect, useId, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ProgramIcon } from '@/components/ProgramIcon';
import '@/styles/program-select.scss';

type SelectOption = { value: string | number; label: string; disabled?: boolean };
type Props = {
    options: SelectOption[];
    value?: string | number;
    defaultValue?: string | number;
    onValueChange?: (value: string) => void;
    name?: string;
    required?: boolean;
    disabled?: boolean;
    'aria-label'?: string;
};

/** Shared dark select. Keeps native form submission/required validation behind the custom control. */
export function ProgramSelect({ options, value, defaultValue, onValueChange, name, required, disabled, 'aria-label': label }: Props) {
    const { locale } = useIntl();
    const triggerRef = useRef<HTMLButtonElement>(null);
    const fieldRef = useRef<HTMLInputElement>(null);
    const errorId = useId();
    const initialValue = String(defaultValue ?? options[0]?.value ?? '');
    const [localValue, setLocalValue] = useState(initialValue);
    const [invalid, setInvalid] = useState(false);
    const selectedValue = String(value ?? localValue);
    const selected = options.find((option) => String(option.value) === selectedValue);
    const placeholder = locale === 'zh-TW' ? '請選擇' : '请选择';

    useEffect(() => {
        const form = fieldRef.current?.form;
        const reset = () => { setLocalValue(initialValue); setInvalid(false); };
        form?.addEventListener('reset', reset);
        return () => form?.removeEventListener('reset', reset);
    }, [initialValue]);

    return <span className="program-select">
        <input ref={fieldRef} className="program-select__field" type={required ? 'text' : 'hidden'} name={name}
            value={selectedValue} required={required} disabled={disabled} tabIndex={-1} aria-hidden="true"
            onChange={() => {}} onInvalid={(event) => { event.preventDefault(); setInvalid(true); triggerRef.current?.focus(); }} />
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <button ref={triggerRef} type="button" className="program-select__trigger" disabled={disabled}
                    aria-label={label} aria-required={required || undefined} aria-invalid={invalid || undefined}
                    aria-describedby={invalid ? errorId : undefined}>
                    <span className="program-select__value">{selected?.label ?? placeholder}</span>
                    <ProgramIcon name="chevronDown" className="program-select__chevron" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="program-select__content" align="start" sideOffset={6} collisionPadding={12}>
                <DropdownMenuRadioGroup value={selectedValue} onValueChange={(next) => {
                    setLocalValue(next); setInvalid(false); onValueChange?.(next);
                }}>
                    {options.map((option) => <DropdownMenuRadioItem className="program-select__option" key={String(option.value)}
                        value={String(option.value)} textValue={option.label} disabled={option.disabled}>
                        <span className="program-select__option-label">{option.label}</span>
                        {selectedValue === String(option.value) ? <ProgramIcon name="check" className="program-select__check" /> : null}
                    </DropdownMenuRadioItem>)}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
        {invalid ? <span className="program-select__error" id={errorId} role="alert">{placeholder}</span> : null}
    </span>;
}
