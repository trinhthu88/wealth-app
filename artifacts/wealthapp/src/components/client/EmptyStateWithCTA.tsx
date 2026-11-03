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
        <div className="h-12 w-12 rounded-[14px] bg-breeze flex items-center justify-center mb-4">
          <Icon className="h-6 w-6 text-forest" aria-hidden="true" />
        </div>
      )}
      <h3 className="text-[16px] font-semibold text-forest mb-1">{title}</h3>
      {description && (
        <p className="text-[14px] text-ink-40 max-w-xs leading-relaxed mb-5">{description}</p>
      )}
      <div className="flex flex-col sm:flex-row items-center gap-2">
        {action && (
          <button
            onClick={action.onClick}
            className="h-11 px-5 rounded-full bg-forest text-paper text-[14px] font-semibold hover:opacity-90 transition-opacity"
          >
            {action.label}
          </button>
        )}
        {secondaryAction && (
          <button
            onClick={secondaryAction.onClick}
            className="h-11 px-5 rounded-full border-[1.5px] border-forest bg-transparent text-forest text-[14px] font-semibold hover:bg-forest/5 transition-colors"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
    </div>
  );
}
