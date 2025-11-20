import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useCampaigns, useCampaignsInvalidation } from "@/hooks/useCampaigns";
import { requestCampaignArchive, triggerAssetImageGeneration } from "@/lib/campaigns";
import type { CampaignAsset } from "@/types/campaign";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Image as ImageIcon, RefreshCw } from "lucide-react";
import { toast } from "sonner";

function AssetPreview({ asset, onGenerate }: { asset: CampaignAsset; onGenerate: (assetId: string) => void }) {
  const isProcessing = asset.status === "pending" || asset.status === "generating";
  const canGenerate = asset.type === "image" && asset.status === "pending";
  const hasImage = asset.type === "image" && asset.file_urls && asset.file_urls.length > 0;

  return (
    <Card className="h-full border-dashed">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          {asset.type}
        </CardTitle>
        <Badge variant={asset.status === "ready" ? "default" : "secondary"}>{asset.status}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {hasImage ? (
          <img
            src={asset.file_urls?.[0]}
            alt={asset.id}
            className="w-full aspect-square rounded-lg border object-cover"
          />
        ) : (
          <div className="w-full aspect-square rounded-lg border bg-muted flex items-center justify-center">
            {isProcessing ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
          </div>
        )}
        {canGenerate && (
          <Button variant="secondary" className="w-full" onClick={() => onGenerate(asset.id)} disabled={isProcessing}>
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Générer l'image</span>
          </Button>
        )}
        {isProcessing && !canGenerate && (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            En cours...
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Campaigns() {
  const { data: campaigns, isLoading } = useCampaigns();
  const invalidate = useCampaignsInvalidation();
  const [processingAssets, setProcessingAssets] = useState<Record<string, boolean>>({});
  const [archiving, setArchiving] = useState<Record<string, boolean>>({});

  const handleGenerate = async (assetId: string) => {
    setProcessingAssets((prev) => ({ ...prev, [assetId]: true }));
    try {
      const toastId = toast.loading("Lancement de la génération...");
      await triggerAssetImageGeneration(assetId);
      toast.success("Génération lancée", { id: toastId });
      await invalidate();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Erreur lors de la génération");
    } finally {
      setProcessingAssets((prev) => ({ ...prev, [assetId]: false }));
    }
  };

  const handleArchive = async (campaignId: string) => {
    setArchiving((prev) => ({ ...prev, [campaignId]: true }));
    try {
      const toastId = toast.loading("Création de l'archive...");
      const result = await requestCampaignArchive(campaignId);
      toast.success("Archive prête !", { id: toastId });
      if (result?.url) {
        window.open(result.url, "_blank");
      }
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Impossible de générer le ZIP");
    } finally {
      setArchiving((prev) => ({ ...prev, [campaignId]: false }));
    }
  };

  const readyAssetMap = useMemo(() => {
    const map: Record<string, number> = {};
    campaigns?.forEach((campaign) => {
      const readyCount = campaign.assets?.filter((asset) => asset.status === "ready").length || 0;
      map[campaign.id] = readyCount;
    });
    return map;
  }, [campaigns]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, idx) => (
          <Card key={idx} className="animate-pulse h-full">
            <CardContent className="p-6 space-y-4">
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="h-3 bg-muted rounded w-full" />
              <div className="h-3 bg-muted rounded w-2/3" />
              <div className="h-64 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Campagnes</h1>
          <p className="text-muted-foreground">Suivez vos campagnes et générez les images associées.</p>
        </div>
      </div>

      {!campaigns?.length ? (
        <Card className="p-8 text-center">
          <CardTitle className="text-xl mb-2">Aucune campagne pour le moment</CardTitle>
          <p className="text-muted-foreground">
            Créez une campagne depuis le chat Alfie, puis revenez ici pour suivre la génération de vos assets.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((campaign) => {
            const readyCount = readyAssetMap[campaign.id] || 0;
            const totalAssets = campaign.assets?.length || 0;
            const canDownload = readyCount > 0 && !archiving[campaign.id];

            return (
              <Card key={campaign.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-semibold">
                      {campaign.name || campaign.config?.topic || "Campagne"}
                    </CardTitle>
                    <Badge variant={readyCount === totalAssets && totalAssets > 0 ? "default" : "secondary"}>
                      {readyCount}/{totalAssets} prêts
                    </Badge>
                  </div>
                  {campaign.config?.topic && (
                    <p className="text-sm text-muted-foreground">Sujet : {campaign.config.topic}</p>
                  )}
                </CardHeader>
                <CardContent className="grid gap-3">
                  {campaign.assets?.map((asset) => (
                    <AssetPreview
                      key={asset.id}
                      asset={
                        processingAssets[asset.id]
                          ? { ...asset, status: "generating" }
                          : asset
                      }
                      onGenerate={handleGenerate}
                    />
                  ))}
                </CardContent>
                <CardFooter className="flex items-center justify-end gap-2 mt-auto">
                  <Button
                    variant="outline"
                    disabled={!canDownload}
                    onClick={() => handleArchive(campaign.id)}
                  >
                    {archiving[campaign.id] ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    <span className="ml-2">Télécharger la campagne</span>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
