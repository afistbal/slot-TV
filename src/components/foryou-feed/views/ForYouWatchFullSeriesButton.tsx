import { FormattedMessage } from 'react-intl';

type Props = {
    feedEpisodeTotal: number;
    onClick: () => void;
    onIntent?: () => void;
};

export function ForYouWatchFullSeriesButton({ feedEpisodeTotal, onClick, onIntent }: Props) {
    return (
        <button
            type="button"
            className="foryou-watch-full-btn"
            onPointerDown={onIntent}
            onTouchStart={onIntent}
            onMouseEnter={onIntent}
            onFocus={onIntent}
            onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}
        >
            <span className="foryou-watch-full-btn__play" aria-hidden />
            <FormattedMessage
                id={
                    feedEpisodeTotal > 0
                        ? 'foryou_watch_full_series'
                        : 'foryou_watch_full_series_no_count'
                }
                values={feedEpisodeTotal > 0 ? { count: feedEpisodeTotal } : undefined}
            />
        </button>
    );
}
