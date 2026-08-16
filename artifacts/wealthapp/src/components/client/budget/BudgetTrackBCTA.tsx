import TrackBConversionCTA from "@/components/client/TrackBConversionCTA";

interface Props {
  surplus: number;
}

export default function BudgetTrackBCTA({ surplus }: Props) {
  return (
    <TrackBConversionCTA
      context="budget"
      relevantValue={surplus > 0 ? surplus : undefined}
    />
  );
}
