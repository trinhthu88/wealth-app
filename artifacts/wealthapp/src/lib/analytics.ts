import posthog from "posthog-js";

export function initAnalytics() {
  if (import.meta.env.PROD) {
    posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
      api_host: "https://app.posthog.com",
      capture_pageview: false, // we'll do this manually per route
      person_profiles: "identified_only",
    });
  }
}

export function identifyUser(userId: string, props: {
  role: string; isExpat: boolean; countryCode?: string | null;
}) {
  posthog.identify(userId, props);
}

export function trackPageView(path: string) {
  posthog.capture("$pageview", { $current_url: path });
}

export function track(event: string, props?: Record<string, unknown>) {
  posthog.capture(event, props);
}

export function resetUser() {
  posthog.reset();
}
