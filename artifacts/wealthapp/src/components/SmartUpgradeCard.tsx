import CheckpointCard from "@/components/client/CheckpointCard";

/** C1 (soft, no ask) and C6, when the server has one open. */
export default function SmartUpgradeCard() {
  return <CheckpointCard codes={["C1_score_ready", "C6_engaged"]} />;
}
