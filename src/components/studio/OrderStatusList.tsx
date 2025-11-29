import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type Order = Database["public"]["Tables"]["orders"]["Row"];

interface OrderWithStats extends Order {
  jobCount: number;
  completedJobs: number;
}

interface OrderStatusListProps {
  brandId: string;
  userId: string;
}

export function OrderStatusList({ brandId, userId }: OrderStatusListProps) {
  const [orders, setOrders] = useState<OrderWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchOrders = async () => {
      try {
        setLoading(true);

        // Récupérer les orders récents
        const { data: ordersData, error: ordersError } = await supabase
          .from("orders")
          .select("*")
          .eq("user_id", userId)
          .eq("brand_id", brandId)
          .order("created_at", { ascending: false })
          .limit(5);

        if (ordersError) throw ordersError;

        if (!mounted || !ordersData) return;

        // Récupérer les stats de jobs pour chaque order
        const ordersWithStats = await Promise.all(
          ordersData.map(async (order) => {
            const { data: jobsData } = await supabase
              .from("job_queue")
              .select("status")
              .eq("order_id", order.id);

            const jobCount = jobsData?.length || 0;
            const completedJobs =
              jobsData?.filter((j) => j.status === "completed").length || 0;

            return {
              ...order,
              jobCount,
              completedJobs,
            };
          })
        );

        if (mounted) {
          setOrders(ordersWithStats);
        }
      } catch (error) {
        console.error("[OrderStatusList] Error:", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchOrders();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`orders-${brandId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `brand_id=eq.${brandId}`,
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [brandId, userId]);

  if (loading) {
    return (
      <Card className="p-4 space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </Card>
    );
  }

  if (orders.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Aucune génération récente pour cette marque.
        </p>
      </Card>
    );
  }

  const getStatusBadge = (order: OrderWithStats) => {
    if (order.status === "completed") {
      return <Badge variant="outline" className="bg-green-50 text-green-700">Terminé</Badge>;
    }
    if (order.status === "failed") {
      return <Badge variant="destructive">Échec</Badge>;
    }
    if (order.jobCount === 0) {
      return <Badge variant="secondary">En attente</Badge>;
    }
    if (order.completedJobs < order.jobCount) {
      return (
        <Badge variant="default">
          En cours ({order.completedJobs}/{order.jobCount})
        </Badge>
      );
    }
    return <Badge variant="outline">Prêt</Badge>;
  };

  return (
    <Card className="p-4 space-y-3 overflow-hidden">
      <h3 className="font-semibold text-sm">Générations récentes</h3>
      <div className="space-y-2">
        {orders.map((order) => (
          <div
            key={order.id}
            className="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
            onClick={() => {
              // TODO: Navigate to order detail or library filtered by order_id
              console.log("Navigate to order:", order.id);
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-sm font-medium truncate max-w-full">{order.campaign_name}</p>
                <p className="text-xs text-muted-foreground">
                  {order.created_at &&
                    formatDistanceToNow(new Date(order.created_at), {
                      addSuffix: true,
                      locale: fr,
                    })}
                </p>
              </div>
              {getStatusBadge(order)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
