import { cn } from '@/lib/utils';

export function SettingsCard({
  title,
  description,
  className,
  children,
}: {
  title?: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn('rounded-xl border border-neutral-200 bg-white p-6 shadow-sm', className)}
    >
      {title && <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>}
      {description && <p className="mt-1 text-xs text-neutral-500">{description}</p>}
      {(title || description) && <div className="h-4" />}
      {children}
    </section>
  );
}
