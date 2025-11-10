import type { AlfieIntent } from "@/ai/intent";

type TagOptions = {
  intent: AlfieIntent;
  orderId: string;
};

function safeTag(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9:-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildTags({ intent, orderId }: TagOptions): string[] {
  const tags = [
    `brand:${safeTag(intent.brandId)}`,
    `order:${safeTag(orderId)}`,
    `kind:${safeTag(intent.kind)}`,
    `ratio:${safeTag(intent.ratio)}`,
    `lang:${safeTag(intent.language)}`,
    `goal:${safeTag(intent.goal)}`,
  ];

  if (intent.campaign) {
    tags.push(`campaign:${safeTag(intent.campaign)}`);
  }

  return tags;
}

export function buildContext({ intent, orderId }: TagOptions): Record<string, string> {
  return {
    order_id: orderId,
    brand_id: intent.brandId,
    tone_pack: intent.tone_pack,
    template_id: intent.templateId ?? "",
  };
}
