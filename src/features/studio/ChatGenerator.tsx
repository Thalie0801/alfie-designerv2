import { useEffect, useState } from 'react';
import { AlfieChat, AlfieIntent, PlannedBrief } from '@/components/chat/AlfieChat';

const PLANNED_BRIEF_STORAGE_KEY = 'alfie_planned_brief';

function inferFormatFromChannel(channel?: string, intent?: AlfieIntent): string | undefined {
  if (!channel) {
    return intent === 'video' ? '9:16' : undefined;
  }

  const lower = channel.toLowerCase();

  if (lower.includes('tiktok') || lower.includes('story') || lower.includes('reel') || lower.includes('short')) {
    return '9:16';
  }

  if (lower.includes('youtube')) {
    return '16:9';
  }

  if (lower.includes('linkedin')) {
    return intent === 'video' ? '16:9' : '1:1';
  }

  if (lower.includes('pinterest')) {
    return '4:5';
  }

  return '1:1';
}

function initFromPlannedBrief(brief: PlannedBrief): PlannedBrief {
  const format = brief.format ?? inferFormatFromChannel(brief.channel, brief.intent);
  const quantity =
    brief.quantity ?? (brief.intent === 'carousel' ? 5 : brief.intent === 'image' || brief.intent === 'video' ? 1 : undefined);

  return {
    ...brief,
    format,
    quantity
  };
}

export function ChatGenerator() {
  const [initialBrief, setInitialBrief] = useState<PlannedBrief | undefined>();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PLANNED_BRIEF_STORAGE_KEY);
      if (!raw) return;

      const brief = initFromPlannedBrief(JSON.parse(raw) as PlannedBrief);
      setInitialBrief(brief);
      localStorage.removeItem(PLANNED_BRIEF_STORAGE_KEY);
    } catch (err) {
      console.error('Failed to read planned brief', err);
    }
  }, []);

  return (
    <div className="flex h-full flex-col gap-4">
      <AlfieChat mode="studio" variant="page" initialBrief={initialBrief} />
    </div>
  );
}
