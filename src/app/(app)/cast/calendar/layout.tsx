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
    <div className="fixed inset-x-0 bottom-0 top-26 z-10">
      {children}
      <PreviewSidebar>{modal}</PreviewSidebar>
    </div>
  );
}
