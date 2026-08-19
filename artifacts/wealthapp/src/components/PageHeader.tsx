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
          <p className="tala-eyebrow text-ink-40 mb-1.5">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-[30px] font-semibold text-forest tracking-[-0.02em] leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[14px] text-ink-60 mt-1.5 leading-relaxed max-w-2xl text-pretty">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0 pt-1">{action}</div>}
    </div>
  );
}
