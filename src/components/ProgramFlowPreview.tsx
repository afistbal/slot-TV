export type ProgramFlowPreviewStep = {
    id: string;
    label: string;
};

export function ProgramFlowPreview({
    title,
    hint,
    active,
    steps,
    onSelect,
    onExit,
    exitLabel,
}: {
    title: string;
    hint: string;
    active: string;
    steps: ProgramFlowPreviewStep[];
    onSelect: (id: string) => void;
    onExit?: () => void;
    exitLabel?: string;
}) {
    const activeIndex = Math.max(0, steps.findIndex((step) => step.id === active));

    return (
        <section className="program-flow-preview" aria-label={title}>
            <div className="program-flow-preview__heading">
                <strong>{title}</strong>
                <span>{hint}</span>
                {onExit ? <button type="button" className="program-flow-preview__exit" onClick={onExit}>{exitLabel}</button> : null}
            </div>
            <div className="program-flow-preview__scroller">
                <nav className="program-flow-preview__steps">
                    {steps.map((step, index) => (
                        <button
                            key={step.id}
                            type="button"
                            className={step.id === active ? 'is-active' : index < activeIndex ? 'is-passed' : ''}
                            aria-current={step.id === active ? 'step' : undefined}
                            onClick={() => onSelect(step.id)}
                        >
                            <i>{index + 1}</i>
                            <span>{step.label}</span>
                        </button>
                    ))}
                </nav>
            </div>
        </section>
    );
}
