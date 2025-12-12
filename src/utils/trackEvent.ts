export const trackEvent = (eventName: string, data?: Record<string, unknown>) => {
  console.log(`[Track] ${eventName}`, data || {});
  // Future: integrate with analytics (Plausible, Mixpanel, etc.)
};
