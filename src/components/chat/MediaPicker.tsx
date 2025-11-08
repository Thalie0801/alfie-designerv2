import { useRef, useState, useCallback } from "react";
import type { ChangeEvent } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { uploadToChatBucket } from "@/lib/chatUploads";

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 Mo
const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 Mo

export type PickedMedia = {
  type: "image" | "video";
  url: string;
  name: string;
  previewUrl?: string;
  origin?: "upload";
};

interface MediaPickerProps {
  disabled?: boolean;
  onPick: (media: PickedMedia) => void;
  onUploadingChange?: (uploading: boolean) => void;
}

export function MediaPicker({ disabled, onPick, onUploadingChange }: MediaPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const resetFileInput = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleFileUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");

      if (!isImage && !isVideo) {
        toast.error("Format non supporté. Choisis une image ou une vidéo.");
        resetFileInput();
        return;
      }

      if (isImage && !ALLOWED_IMAGE_TYPES.includes(file.type)) {
        toast.error("Format image non supporté (PNG/JPEG/WebP/GIF).");
        resetFileInput();
        return;
      }

      if (isImage && file.size > MAX_IMAGE_BYTES) {
        toast.error("Image trop lourde (max 10 Mo).");
        resetFileInput();
        return;
      }

      if (isVideo && file.size > MAX_VIDEO_BYTES) {
        toast.error("Vidéo trop volumineuse (max 200 Mo).");
        resetFileInput();
        return;
      }

      setIsUploading(true);
      onUploadingChange?.(true);

      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        const user = auth?.user;
        if (!user) {
          throw new Error("Authentification requise");
        }

        const { signedUrl } = await uploadToChatBucket(file, supabase, user.id);

        const previewUrl = URL.createObjectURL(file);

        onPick({
          type: isVideo ? "video" : "image",
          url: signedUrl,
          name: file.name,
          previewUrl,
          origin: "upload",
        });

        toast.success(isVideo ? "Vidéo importée !" : "Image importée !");
      } catch (error) {
        console.error("[MediaPicker] Upload failed", error);
        const message =
          error instanceof Error ? error.message : typeof error === "string" ? error : "Erreur inconnue";
        toast.error(`Erreur lors de l'upload${message ? ` : ${message}` : ""}`);
      } finally {
        setIsUploading(false);
        onUploadingChange?.(false);
        resetFileInput();
      }
    },
    [onPick, onUploadingChange, resetFileInput],
  );

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFileUpload}
      />
      <Button
        variant="outline"
        size="icon"
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || isUploading}
        aria-label="Importer un média"
        title="Importer un média"
      >
        {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
      </Button>
    </>
  );
}
