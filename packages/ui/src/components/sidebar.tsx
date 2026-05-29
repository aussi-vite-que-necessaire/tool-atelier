import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import type * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Sidebar — coquille de navigation latérale (organisme).
 *
 * Composition libre : `Sidebar` pose le conteneur sticky pleine hauteur, puis on
 * empile `SidebarHeader`, des `SidebarSection` (avec libellé optionnel) contenant
 * des `SidebarItem`, et enfin un `SidebarFooter` poussé en bas.
 *
 * `SidebarItem` rend un `<a>` par défaut ; via `render` on l'adosse à un autre
 * élément (ex. Next `<Link>`) tout en gardant le style. L'état actif se pilote
 * par la prop `active`.
 */

function Sidebar({ className, ...props }: React.ComponentProps<'aside'>) {
  return (
    <aside
      data-slot="sidebar"
      className={cn(
        'sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-4 text-sidebar-foreground',
        className,
      )}
      {...props}
    />
  );
}

function SidebarHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-header"
      className={cn('px-3 pb-4 text-lg font-semibold', className)}
      {...props}
    />
  );
}

function SidebarSection({
  label,
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & { label?: string }) {
  return (
    <div
      data-slot="sidebar-section"
      className={cn('flex flex-col gap-0.5 py-2', className)}
      {...props}
    >
      {label ? (
        <p className="px-3 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </p>
      ) : null}
      <nav className="flex flex-col gap-0.5">{children}</nav>
    </div>
  );
}

function SidebarItem({
  active = false,
  className,
  render,
  ...props
}: useRender.ComponentProps<'a'> & { active?: boolean }) {
  return useRender({
    defaultTagName: 'a',
    props: mergeProps<'a'>(
      {
        'aria-current': active ? 'page' : undefined,
        className: cn(
          'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors [&_svg]:size-4 [&_svg]:shrink-0',
          active
            ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
            : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
          className,
        ),
      },
      props,
    ),
    render,
    state: { slot: 'sidebar-item', active },
  });
}

function SidebarFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-footer"
      className={cn('mt-auto px-3 pt-4 text-xs text-muted-foreground', className)}
      {...props}
    />
  );
}

export { Sidebar, SidebarHeader, SidebarSection, SidebarItem, SidebarFooter };
