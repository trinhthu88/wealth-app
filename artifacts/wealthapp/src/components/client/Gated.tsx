import type { ReactNode } from "react";
import { gateMessage, type Capability } from "@workspace/tier-policy";
import { useCapability, useEntitlements } from "@/hooks/useEntitlements";
import { resolveGatedView } from "@/lib/gating";
import ClientAppShell from "@/components/client/AppShell";
import LockedFeature from "@/components/client/LockedFeature";

interface Props {
  capability: Capability;
  children: ReactNode;
  /** Shown instead of blurring the children when the gate is preview. */
  preview?: ReactNode;
  /** For a whole page: wraps the locked state in the app shell the page would have rendered. */
  page?: boolean;
}

/** Renders a screen or section according to the server's gate for this capability. */
export default function Gated({ capability, children, preview, page = false }: Props) {
  const { isLoading } = useEntitlements();
  const { gate, atCap, limits } = useCapability(capability);
  const view = resolveGatedView(gate, atCap, { isLoading });

  if (view === "loading") return page ? <ClientAppShell>{null}</ClientAppShell> : null;
  if (view === "children") return <>{children}</>;
  if (view === "locked") {
    const locked = <LockedFeature capability={capability} />;
    return page ? <ClientAppShell>{locked}</ClientAppShell> : locked;
  }
  if (view === "preview") {
    return (
      <>
        {preview ?? (
          <div aria-hidden="true" inert className="pointer-events-none select-none blur-sm">{children}</div>
        )}
        <p className="mt-2 text-[13px] text-ink-40">{gateMessage(capability, null)}</p>
      </>
    );
  }
  const limit = capability === "goals" ? limits?.goals : capability === "holdings" ? limits?.holdings : limits?.solPerDay;
  return (
    <>
      {children}
      <CapNotice message={gateMessage(capability, limit ?? null)} />
    </>
  );
}

export function CapNotice({ message }: { message: string }) {
  return (
    <p role="status" className="rounded-[14px] bg-surface px-4 py-3 text-[13px] leading-relaxed text-ink-40">
      {message}
    </p>
  );
}
