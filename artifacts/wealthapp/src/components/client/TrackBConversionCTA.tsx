import CheckpointCard from "@/components/client/CheckpointCard";

/** C8: what an advised plan would do, when the server has that checkpoint open. */
export default function TrackBConversionCTA({ className }: { className?: string }) {
  return <CheckpointCard codes={["C8_plan_preview"]} className={className} />;
}
