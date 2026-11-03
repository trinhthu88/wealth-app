import { useUser } from "@clerk/react";
import type { MilestoneComment } from "@/hooks/useMilestoneComments";
import { cn } from "@/lib/utils";

function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " · " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

interface Props {
  comments: MilestoneComment[];
}

export default function MilestoneComments({ comments }: Props) {
  const { user } = useUser();

  if (comments.length === 0) {
    return <p className="text-[13px] text-ink-40 py-2">No comments yet.</p>;
  }

  return (
    <div className="space-y-3 py-1">
      {comments.map(c => {
        const isOwn = c.userId === user?.id || c.authorRole === "client";
        const isAdvisor = c.authorRole === "advisor";

        return (
          <div key={c.id} className={`flex gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
            <div className="h-8 w-8 rounded-[10px] bg-forest text-paper flex items-center justify-center text-[11px] font-semibold shrink-0 mt-0.5">
              {initials(c.authorName)}
            </div>
            <div className={`max-w-[75%] space-y-0.5 ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
              <div
                className={cn("px-3.5 py-2.5 text-[14px] text-forest leading-[1.45]", isAdvisor ? "bg-breeze" : "bg-surface")}
                style={{ borderRadius: isOwn ? "16px 16px 4px 16px" : "16px 16px 16px 4px" }}
              >
                {c.content}
              </div>
              <p className="text-[11px] text-ink-40 px-1">
                {c.authorName ?? (isAdvisor ? "Advisor" : "You")} · {fmtTime(c.createdAt)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
