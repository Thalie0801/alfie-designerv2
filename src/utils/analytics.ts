import { supabase } from '@/integrations/supabase/client';

type DashboardEventName =
  | 'dashboard_view'
  | 'cta_click';

interface DashboardEventPayload {
  userId?: string;
  brandId?: string | null;
  action?: 'connecter_canva' | 'open_chat' | 'add_brand';
  context?: Record<string, any>;
}

export async function trackDashboardEvent(
  eventName: DashboardEventName,
  payload: DashboardEventPayload = {}
) {
  try {
    if (!payload.brandId) {
      console.debug('[analytics] Missing brand identifier, skipping event', eventName);
      return;
    }

    const { error } = await supabase.from('usage_event').insert({
      brand_id: payload.brandId,
      kind: eventName === 'dashboard_view' ? 'dashboard_view' : payload.action || 'cta_click',
      meta: {
        userId: payload.userId,
        ...payload.context,
      },
    });

    if (error) {
      console.debug('[analytics] Failed to insert usage_event', error.message);
    }
  } catch (error) {
    console.debug('[analytics] Unexpected error while tracking event', error);
  }
}
