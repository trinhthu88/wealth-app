import type { Gate } from "@workspace/tier-policy";

export type GatedView = "loading" | "children" | "children_with_notice" | "preview" | "locked";

/**
 * Maps the server's gate to what a screen renders. A gate that has not loaded
 * renders nothing rather than flashing locked content. A failed entitlements request
 * renders the screen, because the API still enforces the gate.
 */
export function resolveGatedView(gate: Gate | null, atCap: boolean, state: { isLoading: boolean }): GatedView {
  if (!gate) return state.isLoading ? "loading" : "children";
  switch (gate) {
    case "full":
      return "children";
    case "limited":
      return atCap ? "children_with_notice" : "children";
    case "preview":
      return "preview";
    case "locked":
    case "after_assign":
      return "locked";
  }
}
