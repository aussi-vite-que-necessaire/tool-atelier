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
    <div className="fixed inset-x-0 bottom-0 top-14 z-10 lg:top-0 lg:left-60">
      {children}
      <PreviewSidebar>{modal}</PreviewSidebar>
    </div>
  );
}
