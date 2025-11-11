import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Download, CheckCircle2, XCircle } from 'lucide-react';

export function BulkCarouselGenerator({ brandId }: { brandId: string }) {
  const [numCarousels, setNumCarousels] = useState(5);
  const [numSlides, setNumSlides] = useState(5);
  const [theme, setTheme] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [textOption, setTextOption] = useState<'alfie' | 'excel'>('alfie');
  const [excelData, setExcelData] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '9:16' | '16:9' | '4:5'>('1:1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<any[]>([]);

  const handleGenerate = async () => {
    if (!theme || !campaignName) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setResults([]);

    try {
      let parsedExcelData = null;
      if (textOption === 'excel' && excelData) {
        try {
          parsedExcelData = JSON.parse(excelData);
        } catch (e) {
          toast.error('Invalid Excel data format. Expected JSON array.');
          setIsGenerating(false);
          return;
        }
      }

      const { data, error } = await supabase.functions.invoke('alfie-generate-carousel-bulk', {
        body: {
          num_carousels: numCarousels,
          num_slides_per_carousel: numSlides,
          theme,
          brand_id: brandId,
          campaign_name: campaignName,
          text_option: textOption,
          excel_data: parsedExcelData,
          global_style: 'Professional, clean, modern design',
          aspect_ratio: aspectRatio
        }
      });

      if (error) throw error;

      setResults(data.carousels || []);
      setProgress(100);
      
      const successful = data.successful || 0;
      const total = data.total || 0;
      
      if (successful === total) {
        toast.success(`✅ Generated ${successful}/${total} carousels successfully!`);
      } else {
        toast.warning(`⚠️ Generated ${successful}/${total} carousels (${total - successful} failed)`);
      }
    } catch (error: any) {
      console.error('Bulk generation error:', error);
      toast.error('Failed to generate carousels: ' + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Bulk Carousel Generator</CardTitle>
          <CardDescription>
            Generate multiple carousels at scale with AI backgrounds and Cloudinary composition
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numCarousels">Number of Carousels</Label>
              <Input
                id="numCarousels"
                type="number"
                min={1}
                max={20}
                value={numCarousels}
                onChange={(e) => setNumCarousels(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="numSlides">Slides per Carousel</Label>
              <Input
                id="numSlides"
                type="number"
                min={1}
                max={10}
                value={numSlides}
                onChange={(e) => setNumSlides(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="campaignName">Campaign Name</Label>
            <Input
              id="campaignName"
              placeholder="e.g., summer_2024, product_launch"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="theme">Theme / Topic</Label>
            <Input
              id="theme"
              placeholder="e.g., Summer Sale, Product Features, Brand Story"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Aspect Ratio / Format</Label>
            <RadioGroup 
              value={aspectRatio} 
              onValueChange={(v: any) => setAspectRatio(v)}
              className="flex gap-4 flex-wrap"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="1:1" id="ratio-1-1" />
                <Label htmlFor="ratio-1-1" className="font-normal cursor-pointer">
                  1:1 (Carré)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="9:16" id="ratio-9-16" />
                <Label htmlFor="ratio-9-16" className="font-normal cursor-pointer">
                  9:16 (Story/Reel)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="16:9" id="ratio-16-9" />
                <Label htmlFor="ratio-16-9" className="font-normal cursor-pointer">
                  16:9 (Paysage)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="4:5" id="ratio-4-5" />
                <Label htmlFor="ratio-4-5" className="font-normal cursor-pointer">
                  4:5 (Portrait)
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-4">
            <Label>Text Generation</Label>
            <RadioGroup value={textOption} onValueChange={(v: any) => setTextOption(v)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="alfie" id="alfie" />
                <Label htmlFor="alfie" className="font-normal cursor-pointer">
                  Generate automatically with Alfie AI
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="excel" id="excel" />
                <Label htmlFor="excel" className="font-normal cursor-pointer">
                  Import from Excel/JSON
                </Label>
              </div>
            </RadioGroup>

            {textOption === 'excel' && (
              <div className="space-y-2">
                <Label htmlFor="excelData">Excel Data (JSON format)</Label>
                <Textarea
                  id="excelData"
                  placeholder='[[{"title": "Slide 1", "subtitle": "Description"}, ...], ...]'
                  value={excelData}
                  onChange={(e) => setExcelData(e.target.value)}
                  rows={6}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Format: Array of arrays, one per carousel, each containing slide objects with title and subtitle
                </p>
              </div>
            )}
          </div>

          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !theme || !campaignName}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Generating {numCarousels} carousels...
              </>
            ) : (
              `Generate ${numCarousels} Carousels (${numCarousels * numSlides} total slides)`
            )}
          </Button>

          {isGenerating && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-center text-muted-foreground">
                Processing carousels... This may take a few minutes.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Generation Results</CardTitle>
            <CardDescription>
              {results.filter(r => r.status === 'fulfilled').length} successful, {results.filter(r => r.status === 'rejected').length} failed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {results.map((result, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border ${
                    result.status === 'fulfilled'
                      ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                      : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {result.status === 'fulfilled' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                      )}
                      <div>
                        <p className="font-medium">Carousel {result.carousel_index + 1}</p>
                        {result.status === 'fulfilled' && result.data && (
                          <p className="text-sm text-muted-foreground">
                            {result.data.slides?.length || 0} slides generated
                          </p>
                        )}
                        {result.status === 'rejected' && (
                          <p className="text-sm text-red-600 dark:text-red-400">
                            Error: {result.error}
                          </p>
                        )}
                      </div>
                    </div>
                    {result.status === 'fulfilled' && result.data && (
                      <Button size="sm" variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Download ZIP
                      </Button>
                    )}
                  </div>
                  
                  {result.status === 'fulfilled' && result.data && (
                    <div className="mt-4 grid grid-cols-5 gap-2">
                      {result.data.slides?.slice(0, 5).map((slide: any, sIdx: number) => (
                        <div key={sIdx} className="relative aspect-square rounded overflow-hidden border">
                          <img
                            src={slide.storage_url}
                            alt={`Slide ${sIdx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
