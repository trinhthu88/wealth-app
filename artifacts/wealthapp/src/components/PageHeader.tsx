import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  action?: React.ReactNode;
  className?: string;
}

export default function PageHeader({ title, subtitle, eyebrow, action, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-6", className)}>
      <div>
        {eyebrow && (
          <div className="tala-eyebrow mb-1.5">{eyebrow}</div>
        )}
        <h1 className="text-2xl font-bold text-foreground tracking-tight" style={{ fontFamily: "'Sora', sans-serif" }}>
          {title}
        </h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
