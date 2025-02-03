'use client';

import { MantineProvider } from '@mantine/core';

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider>
      {children}
    </MantineProvider>
  );
} 