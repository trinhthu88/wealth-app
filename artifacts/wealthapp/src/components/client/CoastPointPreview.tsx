import { useCoastPoint } from "@/hooks/useCoastPoint";
import CheckpointCard from "@/components/client/CheckpointCard";

/** C10: the coast point with the goal's name and the result blurred. The server sends no numbers. */
export default function CoastPointPreview() {
  const { data } = useCoastPoint();
  if (!data?.blurred) return null;
  return (
    <section className="space-y-3 rounded-[24px] bg-surface p-5" data-testid="coast-point-preview">
      <h2 className="text-[16px] font-semibold text-forest">Coast point for {data.goalTitle}</h2>
      <p aria-hidden="true" className="select-none font-display text-[28px] text-forest blur-sm">Month 20XX</p>
      <p className="text-[14px] leading-snug text-ink-40">
        The date you could stop contributing and still reach this goal. An advisor can walk through yours with you.
      </p>
      <CheckpointCard codes={["C10_coast_point"]} />
    </section>
  );
}
