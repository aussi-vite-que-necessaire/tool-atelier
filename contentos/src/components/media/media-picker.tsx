'use client';

export type GalleryImage = {
  mediaId: string;
  assetKey: string;
  width: number;
  height: number;
  url: string;
};

type SingleProps = {
  mode: 'single';
  images: GalleryImage[];
  disabled?: boolean;
  onPick: (mediaId: string) => void;
};

type MultiProps = {
  mode: 'multi';
  images: GalleryImage[];
  disabled?: boolean;
  selectedKeys: string[];
  onToggle: (assetKey: string) => void;
};

type Props = SingleProps | MultiProps;

function sameRatio(a: GalleryImage, b: GalleryImage) {
  return Math.abs(a.width / a.height - b.width / b.height) < 0.02;
}

export function MediaPicker(props: Props) {
  if (props.images.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Galerie vide.</p>;
  }

  if (props.mode === 'single') {
    return (
      <div className="grid grid-cols-3 gap-2">
        {props.images.map((img) => (
          <button
            key={img.mediaId}
            type="button"
            disabled={props.disabled}
            onClick={() => props.onPick(img.mediaId)}
            className="overflow-hidden rounded border hover:ring-2 disabled:opacity-50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt="" className="h-auto w-full" />
          </button>
        ))}
      </div>
    );
  }

  const { selectedKeys, onToggle } = props;
  const lockedFormat = selectedKeys.length
    ? props.images.find((g) => g.assetKey === selectedKeys[0])
    : null;

  return (
    <div className="grid grid-cols-3 gap-2">
      {props.images.map((img) => {
        const idx = selectedKeys.indexOf(img.assetKey);
        const selectable = !lockedFormat || sameRatio(img, lockedFormat) || idx >= 0;
        return (
          <button
            key={img.mediaId}
            type="button"
            disabled={!selectable || props.disabled}
            onClick={() => onToggle(img.assetKey)}
            className={`relative overflow-hidden rounded border disabled:opacity-30 ${idx >= 0 ? 'ring-2 ring-neutral-900' : ''}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt="" className="h-auto w-full" />
            {idx >= 0 && (
              <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-xs text-white">
                {idx + 1}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
