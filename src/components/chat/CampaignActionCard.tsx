import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  type CampaignTaskPayload,
  createCampaignFromTasks,
} from "@/lib/alfie/campaignOrchestrator";

interface CampaignActionCardProps {
  campaignName: string;
  tasks: CampaignTaskPayload[];
  brandKit?: any;
  rawPayload?: any;
}

export function CampaignActionCard({
  campaignName,
  tasks,
  brandKit,
  rawPayload,
}: CampaignActionCardProps) {
  const navigate = useNavigate();
  const [isLaunching, setIsLaunching] = useState(false);
  const payload = useMemo(
    () => rawPayload ?? { campaign_name: campaignName, tasks },
    [rawPayload, campaignName, tasks],
  );

  const handleLaunchProduction = async () => {
    setIsLaunching(true);
    try {
      const taskList = (payload as { tasks?: unknown[] })?.tasks;
      const response = await createCampaignFromTasks(
        campaignName,
        (Array.isArray(taskList) ? taskList : tasks) as CampaignTaskPayload[],
        brandKit,
      );
      toast.success("Campagne envoyée en production !");
      if (response.order_id) {
        navigate(`/library?order=${response.order_id}`);
      } else {
        navigate("/library");
      }
    } catch (error) {
      console.error("[CampaignActionCard] Launch failed", error);
      const message =
        error instanceof Error ? error.message : "Impossible de lancer la campagne";
      toast.error(message);
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <Card className="bg-card border-border">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 text-primary p-2 mt-1">
          <Rocket className="h-5 w-5" />
        </div>
        <div className="space-y-2">
          <div>
            <p className="text-sm font-semibold">Prêt à lancer une campagne ?</p>
            <p className="text-xs text-muted-foreground">Campagne : {campaignName}</p>
          </div>
          <Button
            className="w-full"
            onClick={handleLaunchProduction}
            disabled={isLaunching || tasks.length === 0}
          >
            {isLaunching ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Lancement...
              </span>
            ) : (
              `Lancer la Production de la Campagne ${campaignName}`
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
