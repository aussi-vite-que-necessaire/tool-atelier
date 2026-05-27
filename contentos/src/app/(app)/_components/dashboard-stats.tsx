import { CalendarClock, FileText, Send } from 'lucide-react';
import Link from 'next/link';

type Stat = {
  href: string;
  label: string;
  value: number;
  icon: typeof FileText;
};

export function DashboardStats({
  drafts,
  scheduled,
  published,
}: {
  drafts: number;
  scheduled: number;
  published: number;
}) {
  const stats: Stat[] = [
    { href: '/posts', label: 'Brouillons', value: drafts, icon: FileText },
    { href: '/calendar', label: 'Planifiés', value: scheduled, icon: CalendarClock },
    { href: '/calendar', label: 'Publiés', value: published, icon: Send },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {stats.map((stat) => (
        <Link
          key={stat.label}
          href={stat.href}
          className="flex items-center gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition hover:ring-foreground/20"
        >
          <span className="flex size-10 flex-none items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <stat.icon className="size-5" />
          </span>
          <span className="flex flex-col">
            <span className="text-2xl font-semibold leading-none">{stat.value}</span>
            <span className="text-sm text-muted-foreground">{stat.label}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
