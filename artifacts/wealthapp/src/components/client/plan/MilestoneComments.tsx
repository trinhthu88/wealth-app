import { useUser } from "@clerk/react";
import type { MilestoneComment } from "@/hooks/useMilestoneComments";

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
    return <p className="text-xs text-slate-400 py-2">No comments yet.</p>;
  }

  return (
    <div className="space-y-3 py-1">
      {comments.map(c => {
        const isOwn = c.userId === user?.id || c.authorRole === "client";
        const isAdvisor = c.authorRole === "advisor";

        return (
          <div key={c.id} className={`flex gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
            <div
              className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
              style={{ background: isAdvisor ? "#1D9E75" : "#042C53", color: "white" }}
            >
              {initials(c.authorName)}
            </div>
            <div className={`max-w-[75%] space-y-0.5 ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
              <div
                className="px-3 py-2 rounded-xl text-sm"
                style={{
                  background: isAdvisor ? "#F0FDF8" : "#EEF2FF",
                  color: "#042C53",
                  borderRadius: isOwn ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                }}
              >
                {c.content}
              </div>
              <p className="text-[10px] text-slate-400 px-1">
                {c.authorName ?? (isAdvisor ? "Advisor" : "You")} · {fmtTime(c.createdAt)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
