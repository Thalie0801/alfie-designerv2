import { useState } from 'react';
import { AppLayoutWithSidebar } from '@/components/AppLayoutWithSidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Download, Search, Upload, FileDown, Eye } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export default function AssetsLibrary() {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch assets
  const { data: assets, isLoading } = useQuery({
    queryKey: ['library-assets', typeFilter, campaignFilter],
    queryFn: async () => {
      let query = supabase
        .from('library_assets')
        .select('*')
        .order('created_at', { ascending: false });

      if (typeFilter !== 'all') {
        query = query.eq('type', typeFilter);
      }

      if (campaignFilter !== 'all' && campaignFilter) {
        query = query.eq('campaign', campaignFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch unique campaigns for filter
  const { data: campaigns } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('library_assets')
        .select('campaign')
        .not('campaign', 'is', null);

      if (error) throw error;

      const uniqueCampaigns = [...new Set(data.map((d: any) => d.campaign))].filter((c): c is string => Boolean(c));
      return uniqueCampaigns;
    },
  });

  // Excel Import
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('campaignName', 'Imported Campaign');

    try {
      const { data, error } = await supabase.functions.invoke('alfie-excel-import', {
        body: formData,
      });

      if (error) throw error;

      toast({
        title: 'Import réussi',
        description: `${data.items_count} éléments importés`,
      });

      queryClient.invalidateQueries({ queryKey: ['library-assets'] });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erreur d\'import',
        description: error.message,
      });
    }
  };

  // Excel Export
  const handleExport = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/alfie-excel-export`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
            body: JSON.stringify({
              brandId: null,
              startDate: null,
              endDate: null,
              campaign: (campaignFilter !== 'all' && campaignFilter) ? campaignFilter : null,
            }),
        }
      );

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `assets_export_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Export réussi',
        description: 'Fichier Excel téléchargé',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erreur d\'export',
        description: error.message,
      });
    }
  };

  // Filtered assets
  const filteredAssets = assets?.filter((asset) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      asset.campaign?.toLowerCase().includes(query) ||
      asset.tags?.some((tag: string) => tag.toLowerCase().includes(query)) ||
      asset.type.toLowerCase().includes(query)
    );
  });

  // Download asset
  const handleDownload = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <AppLayoutWithSidebar>
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Bibliothèque d'Assets</h1>
            <p className="text-muted-foreground">Gérez vos visuels générés</p>
          </div>

          <div className="flex gap-2">
            <label htmlFor="excel-import">
              <Button variant="outline" asChild>
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  Importer Excel
                </span>
              </Button>
              <input
                id="excel-import"
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleImport}
              />
            </label>

            <Button variant="outline" onClick={handleExport}>
              <FileDown className="h-4 w-4 mr-2" />
              Exporter Excel
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par campagne, tags, type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              <SelectItem value="image">Images</SelectItem>
              <SelectItem value="carousel">Carrousels</SelectItem>
              <SelectItem value="video_slideshow">Vidéos</SelectItem>
            </SelectContent>
          </Select>

          <Select value={campaignFilter} onValueChange={setCampaignFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Campagne" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les campagnes</SelectItem>
              {campaigns?.map((campaign: string) => (
                <SelectItem key={campaign} value={campaign}>
                  {campaign}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Assets Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <div className="aspect-square bg-muted animate-pulse" />
              </Card>
            ))}
          </div>
        ) : filteredAssets && filteredAssets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredAssets.map((asset) => (
              <Card key={asset.id} className="overflow-hidden group">
                <div className="aspect-square relative bg-muted">
                  <img
                    src={asset.cloudinary_url.replace('/upload/', '/upload/f_auto,q_auto,w_400,dpr_auto/')}
                    alt={asset.campaign || 'Asset'}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="secondary"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl">
                        <DialogHeader>
                          <DialogTitle>{asset.campaign || 'Asset'}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <img
                            src={asset.cloudinary_url}
                            alt={asset.campaign || 'Asset'}
                            className="w-full h-auto rounded-lg"
                          />
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <strong>Type:</strong> {asset.type}
                            </div>
                            <div>
                              <strong>Format:</strong> {asset.format || 'N/A'}
                            </div>
                            <div>
                              <strong>Créé le:</strong>{' '}
                              {new Date(asset.created_at).toLocaleDateString('fr-FR')}
                            </div>
                            {asset.tags && asset.tags.length > 0 && (
                              <div className="col-span-2">
                                <strong>Tags:</strong>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {asset.tags.map((tag: string) => (
                                    <Badge key={tag} variant="secondary">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Button
                      size="icon"
                      variant="secondary"
                      onClick={() => handleDownload(asset.cloudinary_url, `${asset.id}.png`)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardContent className="p-4">
                  <p className="font-semibold truncate">{asset.campaign || 'Sans titre'}</p>
                  <div className="flex items-center justify-between mt-2">
                    <Badge variant="outline">{asset.type}</Badge>
                    {asset.carousel_id && asset.slide_index !== null && (
                      <Badge variant="secondary">Slide {asset.slide_index + 1}</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Aucun asset trouvé</p>
          </div>
        )}
      </div>
    </AppLayoutWithSidebar>
  );
}
