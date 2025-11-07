useEffect(() => {
  if (!orderId) return;
  let currentOrder = orderId;

  const channel = supabase
    .channel("job_queue_changes")
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "job_queue",
        filter: `order_id=eq.${orderId}`,
      },
      (payload) => {
        if (currentOrder !== orderId) return; // l’order a changé, ignorer
        // ... reste inchangé
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [orderId]);
