import { cn } from "@/lib/utils";

interface EmptyStateWithCTAProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export default function EmptyStateWithCTA({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateWithCTAProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-12 px-6", className)}>
      {Icon && (
        <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <Icon className="h-6 w-6 text-slate-400" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-[#042C53] mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-slate-500 max-w-xs leading-relaxed mb-5">{description}</p>
      )}
      <div className="flex flex-col sm:flex-row items-center gap-2">
        {action && (
          <button
            onClick={action.onClick}
            className="px-4 py-2 rounded-lg bg-[#1D9E75] text-white text-sm font-medium hover:bg-[#0F6E56] transition-colors"
          >
            {action.label}
          </button>
        )}
        {secondaryAction && (
          <button
            onClick={secondaryAction.onClick}
            className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
    </div>
  );
}
