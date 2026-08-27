"use client";

import { track } from "@vercel/analytics";

export type MarketingEvent =
  | "partner_landing_view"
  | "dealer_demo_click"
  | "importer_demo_click"
  | "partner_signup_start"
  | "partner_signup_complete";

type EventProperties = Record<string, string | number | boolean | null>;

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
  }
}

const ATTRIBUTION_KEY = "switchautoai_attribution";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export function captureMarketingAttribution() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const attribution = Object.fromEntries(UTM_KEYS.flatMap((key) => {
    const value = params.get(key);
    return value ? [[key, value]] : [];
  }));
  if (Object.keys(attribution).length > 0) sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
}

function getAttribution(): EventProperties {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(sessionStorage.getItem(ATTRIBUTION_KEY) ?? "{}") as EventProperties;
  } catch {
    return {};
  }
}

export function trackMarketingEvent(name: MarketingEvent, properties: EventProperties = {}) {
  const payload = { ...getAttribution(), ...properties };
  track(name, payload);
  window.gtag?.("event", name, payload);
  window.fbq?.("trackCustom", name, payload);

  if (name === "partner_signup_complete") {
    window.fbq?.("track", "CompleteRegistration", { content_name: "SwitchAuto AI partner" });
    const conversionTarget = process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL;
    if (conversionTarget) window.gtag?.("event", "conversion", { send_to: conversionTarget });
  }
}
