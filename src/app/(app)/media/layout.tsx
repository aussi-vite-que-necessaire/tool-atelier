import type { ReactNode } from 'react';
import { MediaNav } from './media-nav';

// Section media : sous-nav locale + conteneur de contenu cadré (calque cast).
export default function MediaLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <MediaNav />
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10">{children}</div>
    </>
  );
}
