import CheckpointCard from "@/components/client/CheckpointCard";

/** C4 on a month with no surplus to show, where SurplusCTA has nothing to say. */
export default function BudgetTrackBCTA() {
  return <CheckpointCard codes={["C4_surplus"]} />;
}
