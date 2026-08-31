"use client";

import { useEffect } from "react";

import type { MarketplaceExecution } from "@/lib/asympta-marketplace-intent";
import {
  readAsymptaMarketplaceProfile,
  subscribeAsymptaUserPreferences,
} from "@/lib/asympta-user-preferences";

type MarketplaceBridge = {
  runIntent: (intent: string) => Promise<MarketplaceExecution | null>;
  snapshot: () => MarketplaceExecution | null;
};

function bridge() {
  return (window as typeof window & { __ASYMPTA_MARKETPLACE__?: MarketplaceBridge }).__ASYMPTA_MARKETPLACE__;
}

function profileSignature(profile: ReturnType<typeof readAsymptaMarketplaceProfile>) {
  if (!profile) return "none";
  return JSON.stringify({
    foodPreference: profile.foodPreference ?? null,
    fulfilmentMethod: profile.fulfilmentMethod ?? null,
    paymentMethod: profile.paymentMethod ?? null,
  });
}

/**
 * A declined simulated checkpoint is terminal for that attempt, but changing the
 * marketplace profile is an explicit user recovery action. Recompile the same
 * human intent with the new preferences instead of leaving the request card in
 * a dead blocked state. Active/non-blocked runs are never restarted here.
 */
export function AsymptaMarketplaceRecovery() {
  useEffect(() => {
    let previousProfile = profileSignature(readAsymptaMarketplaceProfile());
    let restarting = false;

    return subscribeAsymptaUserPreferences((preferences) => {
      const nextProfile = profileSignature(preferences.marketplaceProfile);
      if (nextProfile === previousProfile) return;
      previousProfile = nextProfile;

      const marketplace = bridge();
      const current = marketplace?.snapshot();
      if (!marketplace || !current || current.status !== "blocked" || restarting) return;

      const intent = current.envelope.rawMessage.text.trim();
      if (!intent) return;
      restarting = true;
      void marketplace.runIntent(intent).finally(() => {
        restarting = false;
      });
    });
  }, []);

  return null;
}
