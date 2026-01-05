/**
 * ReferenceImageUploader - Upload 1-3 reference images for visual guidance
 */
import { useState } from "react";
import { X, ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ReferenceImageUploaderProps {
  images: string[];
  onImagesChange: (urls: string[]) => void;
  maxImages?: number;
  label?: string;
  description?: string;
}

export function ReferenceImageUploader({
  images,
  onImagesChange,
  maxImages = 3,
  label = "Images de référence (optionnel)",
  description = "Jusqu'à 3 images pour guider le style visuel",
}: ReferenceImageUploaderProps) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // ✅ Vérifier l'authentification avant l'upload
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      toast.error("Session expirée. Veuillez vous reconnecter.");
      return;
    }

    const remainingSlots = maxImages - images.length;
    if (remainingSlots <= 0) {
      toast.error(`Maximum ${maxImages} images autorisées`);
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    setUploading(true);

    try {
      const uploadedUrls: string[] = [];

      for (const file of filesToUpload) {
        // Validate file type
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} n'est pas une image`);
          continue;
        }

        // Validate size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} est trop volumineux (max 10MB)`);
          continue;
        }

        const fileName = `ref-${Date.now()}-${Math.random().toString(36).slice(2)}.${file.name.split(".").pop()}`;
        const filePath = `reference-images/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("chat-uploads")
          .upload(filePath, file);

        if (uploadError) {
          console.error("[ReferenceUploader] Upload error:", uploadError);
          toast.error(`Erreur upload: ${file.name}`);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from("chat-uploads")
          .getPublicUrl(filePath);

        if (urlData?.publicUrl) {
          uploadedUrls.push(urlData.publicUrl);
        }
      }

      if (uploadedUrls.length > 0) {
        onImagesChange([...images, ...uploadedUrls]);
        toast.success(`${uploadedUrls.length} image(s) ajoutée(s)`);
      }
    } catch (err) {
      console.error("[ReferenceUploader] Error:", err);
      toast.error("Erreur lors de l'upload");
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = "";
    }
  };

  const removeImage = (index: number) => {
    const updated = images.filter((_, i) => i !== index);
    onImagesChange(updated);
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      {/* Preview Grid */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((url, idx) => (
            <div
              key={idx}
              className="relative w-20 h-20 rounded-lg overflow-hidden border bg-muted group"
            >
              <img
                src={url}
                alt={`Ref ${idx + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(idx)}
                className="absolute top-1 right-1 p-1 rounded-full bg-background/80 hover:bg-destructive hover:text-destructive-foreground transition-colors opacity-0 group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
              <span className="absolute bottom-1 left-1 text-[10px] bg-background/80 px-1 rounded">
                #{idx + 1}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Upload Button */}
      {images.length < maxImages && (
        <div>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleUpload}
            className="hidden"
            id="reference-image-upload"
            disabled={uploading}
          />
          <label htmlFor="reference-image-upload">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              className="cursor-pointer"
              asChild
            >
              <span>
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Upload...
                  </>
                ) : (
                  <>
                    <ImagePlus className="h-4 w-4 mr-2" />
                    Ajouter ({images.length}/{maxImages})
                  </>
                )}
              </span>
            </Button>
          </label>
        </div>
      )}
    </div>
  );
}
