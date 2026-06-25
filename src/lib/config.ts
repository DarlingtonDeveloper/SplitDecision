import type { ProducerConfig } from "./types";

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
