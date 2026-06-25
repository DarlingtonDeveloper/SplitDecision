import type { ProducerConfig } from "./types";

/**
 * Validate required and optional env vars on first import.
 * Required vars throw immediately. Optional vars warn once.
 */
const validated = { done: false };

export function validateEnv() {
  if (validated.done) return;
  validated.done = true;

  const required = ["SUPABASE_URL", "SUPABASE_SERVICE_KEY"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }

  const optional: Record<string, string> = {
    LLM_API_KEY: "LLM calls will fail (brief parser, negotiator, classifier)",
    WASSIST_API_KEY: "WhatsApp sends will be logged, not delivered",
    WASSIST_PRODUCER_CONVERSATION_ID: "WhatsApp sends will fail",
    PRODUCER_WHATSAPP: "Producer number unknown",
    PAYPAL_CLIENT_ID: "PayPal orders will fail",
    PAYPAL_SECRET: "PayPal orders will fail",
  };

  for (const [key, impact] of Object.entries(optional)) {
    if (!process.env[key]) {
      console.warn(`[config] Missing optional ${key} — ${impact}`);
    }
  }
}

export function getProducerConfig(): ProducerConfig {
  return {
    name: process.env.PRODUCER_NAME ?? "the producer",
    pubTarget: Number(process.env.PUB_TARGET ?? 50),
    pubFloor: Number(process.env.PUB_FLOOR ?? 40),
    pointsTarget: Number(process.env.POINTS_TARGET ?? 3),
    pointsFloor: Number(process.env.POINTS_FLOOR ?? 2),
    models: process.env.USAGE_MODELS ?? "exclusive sale, non-exclusive lease, points-on-master",
    minUpfront: Number(process.env.MIN_UPFRONT ?? 500),
    relationshipMode:
      process.env.RELATIONSHIP_MODE ??
      "collaborative repeat counterparty; protect the relationship over the last point",
  };
}

export function getProducerWhatsApp(): string {
  const num = process.env.PRODUCER_WHATSAPP;
  if (!num) throw new Error("Missing PRODUCER_WHATSAPP");
  return num;
}
