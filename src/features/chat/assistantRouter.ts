import { planFromMessage, type PlannerAction } from "@/ai/tools";
import { normalizeIntent, type AlfieIntent } from "@/ai/intent";

export type AssistantRoute =
  | { kind: "reply"; text: string; quickReplies?: string[] }
  | { kind: "intent"; intent: AlfieIntent; text: string };

type RouteOptions = {
  brandId: string;
  baseIntent?: Partial<AlfieIntent>;
};

export function routeUserMessage(message: string, options: RouteOptions): AssistantRoute {
  const base: Partial<AlfieIntent> = {
    brandId: options.brandId,
    kind: options.baseIntent?.kind ?? "image",
    language: options.baseIntent?.language ?? "fr",
    goal: options.baseIntent?.goal ?? "awareness",
    ratio: options.baseIntent?.ratio ?? "1:1",
    tone_pack: options.baseIntent?.tone_pack ?? "brand_default",
    copyBrief: options.baseIntent?.copyBrief ?? message.trim(),
  };

  const action: PlannerAction = planFromMessage(message, base);

  if (action.type !== "intent") {
    return {
      kind: "reply",
      text: action.response,
      quickReplies: action.quickReplies,
    };
  }

  const intent = normalizeIntent({
    ...action.intent,
    brandId: options.brandId,
    copyBrief: action.intent.copyBrief ?? message,
    kind: action.intent.kind ?? "image",
  });

  return {
    kind: "intent",
    intent,
    text: action.response,
  };
}
