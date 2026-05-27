import type { ReactNode } from 'react';
import { PreviewSidebar } from './_components/preview-sidebar';

export default function CalendarLayout({
  children,
  modal,
}: {
  children: ReactNode;
  modal: ReactNode;
}) {
  return (
    <div className="ml-[calc(50%-50vw)] mr-[calc(50%-50vw)] w-screen px-4 sm:px-6">
      <div className="lg:flex lg:items-start lg:gap-4">
        <div className="min-w-0 flex-1">{children}</div>
        <PreviewSidebar>{modal}</PreviewSidebar>
      </div>
    </div>
  );
}
