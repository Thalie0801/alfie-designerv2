import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { uploadSigned } from '@/lib/cloudinary/upload';
import { slideUrl } from '@/lib/cloudinary/imageUrls';
import { Loader2, Upload, Eye } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Phase 5: CarouselBuilder Component
 * 
 * Allows users to:
 * - Upload a background image
 * - Add title, subtitle, and bullets
 * - Preview the slide with text overlays in real-time
 * - Uses the new Cloudinary architecture
 */

interface CarouselBuilderProps {
  brandId?: string;
  campaignId?: string;
  onSlideCreated?: (publicId: string, url: string) => void;
}

export function CarouselBuilder({ brandId, campaignId, onSlideCreated }: CarouselBuilderProps) {
  const [uploading, setUploading] = useState(false);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundPublicId, setBackgroundPublicId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [bullets, setBullets] = useState<string[]>(['', '', '']);
  const [previewMode, setPreviewMode] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setBackgroundFile(e.target.files[0]);
      setBackgroundPublicId(''); // Reset previous upload
    }
  };

  const handleUpload = async () => {
    if (!backgroundFile) {
      toast.error('Please select a background image');
      return;
    }

    if (!brandId || !campaignId) {
      toast.error('Brand ID and Campaign ID are required');
      return;
    }

    setUploading(true);
    try {
      const result = await uploadSigned(backgroundFile, {
        folder: `alfie/${brandId}/${campaignId}/slides`,
        public_id: `slide_${Date.now()}`, // You can customize this
        resource_type: 'image',
        tags: [brandId, campaignId, 'carousel_slide'],
        context: {
          brand: brandId,
          campaign: campaignId,
        },
      });

      setBackgroundPublicId(result.public_id);
      toast.success('Background uploaded successfully!');
      
      if (onSlideCreated) {
        const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string || 'dkad5vdyo';
        const url = slideUrl(result.public_id, { 
          title, 
          subtitle, 
          bulletPoints: bullets.filter(b => b),
          cloudName
        });
        onSlideCreated(result.public_id, url);
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleBulletChange = (index: number, value: string) => {
    const newBullets = [...bullets];
    newBullets[index] = value;
    setBullets(newBullets);
  };

  const previewUrl = backgroundPublicId
    ? slideUrl(backgroundPublicId, {
        title,
        subtitle,
        bulletPoints: bullets.filter(b => b.trim() !== ''),
        aspectRatio: '9:16',
        cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string || 'dkad5vdyo',
      })
    : null;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Carousel Slide Builder</CardTitle>
        <CardDescription>
          Upload a background image and add text overlays with instant preview
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Background Upload */}
        <div className="space-y-2">
          <Label htmlFor="background">Background Image</Label>
          <div className="flex gap-2">
            <Input
              id="background"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={uploading}
            />
            <Button
              onClick={handleUpload}
              disabled={uploading || !backgroundFile}
              size="sm"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </>
              )}
            </Button>
          </div>
          {backgroundPublicId && (
            <p className="text-sm text-muted-foreground">
              ✓ Uploaded: {backgroundPublicId}
            </p>
          )}
        </div>

        {/* Text Overlays */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Enter slide title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subtitle">Subtitle</Label>
            <Input
              id="subtitle"
              placeholder="Enter slide subtitle"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Bullet Points</Label>
            {bullets.map((bullet, index) => (
              <Input
                key={index}
                placeholder={`Bullet point ${index + 1}`}
                value={bullet}
                onChange={(e) => handleBulletChange(index, e.target.value)}
              />
            ))}
          </div>
        </div>

        {/* Preview */}
        {backgroundPublicId && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Preview</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewMode(!previewMode)}
              >
                <Eye className="mr-2 h-4 w-4" />
                {previewMode ? 'Hide' : 'Show'} Preview
              </Button>
            </div>
            
            {previewMode && previewUrl && (
              <div className="border rounded-lg p-4 bg-muted/50">
                <img
                  src={previewUrl}
                  alt="Slide preview"
                  className="w-full max-w-md mx-auto rounded-lg shadow-lg"
                />
                <p className="text-xs text-muted-foreground mt-2 text-center break-all">
                  {previewUrl}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="text-sm text-muted-foreground space-y-1">
          <p><strong>How to use:</strong></p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Select and upload a background image</li>
            <li>Fill in the text fields (title, subtitle, bullets)</li>
            <li>Click "Show Preview" to see the slide with overlays</li>
            <li>The URL is generated in real-time using Cloudinary SDK</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
