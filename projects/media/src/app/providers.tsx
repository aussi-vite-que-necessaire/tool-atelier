'use client';

import { ThemeProvider } from 'next-themes';
import type * as React from 'react';

// Thème piloté par classe (.dark) façon cast, suivant la préférence système :
// les tokens OKLch et les utilitaires `dark:` basculent ensemble.
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
