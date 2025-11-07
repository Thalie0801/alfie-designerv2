import { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Upload, X, Film } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface FileUploaderProps {
  onFileUploaded: (url: string, file: File) => void;
  acceptedTypes?: string[]; // ex: ['image/*','video/*'] ou MIME précis
  maxSizeMB?: number; // défaut 10 Mo
  multiple?: boolean; // défaut true
  destination?: "supabase" | "cloudinary"; // défaut 'supabase'
  cloudinaryFolder?: string; // si destination=cloudinary: ex 'alfie/chat-uploads'
  className?: string;
}

type PreviewItem = {
  file: File;
  url: string; // objectURL (preview)
  uploadedUrl?: string; // url finale distante
  isVideo: boolean;
  name: string;
};

export function FileUploader({
  onFileUploaded,
  acceptedTypes = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "video/quicktime"],
  maxSizeMB = 10,
  multiple = true,
  destination = "supabase",
  cloudinaryFolder = "alfie/chat-uploads",
  className,
}: FileUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [items, setItems] = useState<PreviewItem[]>([]);

  // --- Helpers Cloudinary (inline pour éviter les imports)
  async function cldSign(params: Record<string, any> = {}) {
    const r = await fetch("/functions/v1/cloudinary-asset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "sign", params }),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json() as Promise<{ signature: string; timestamp: number; api_key: string; cloud_name: string }>;
  }

  async function cldUpload(file: File, folder?: string) {
    const { cloud_name, api_key, signature, timestamp } = await cldSign({
      resource_type: "auto",
      folder,
    });
    const form = new FormData();
    form.append("file", file);
    form.append("timestamp", String(timestamp));
    form.append("api_key", api_key);
    form.append("signature", signature);
    if (folder) form.append("folder", folder);

    // resource_type=auto → images & vidéos
    const endpoint = `https://api.cloudinary.com/v1_1/${cloud_name}/auto/upload`;
    const res = await fetch(endpoint, { method: "POST", body: form });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{ secure_url: string }>;
  }

  // --- Accept mapping pour react-dropzone
  const acceptMap = useMemo(() => {
    // autorise aussi les wildcard 'image/*' 'video/*'
    const map: Record<string, string[]> = {};
    for (const t of acceptedTypes) {
      map[t] = [];
    }
    return map;
  }, [acceptedTypes]);

  const uploadToSupabase = async (file: File): Promise<string> => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error("Utilisateur non authentifié");

    const safeName = file.name.replace(/\s+/g, "_");
    const fileName = `${Date.now()}_${safeName}`;
    const path = `${user.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("chat-uploads")
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (uploadError) throw uploadError;

    const { data: signed, error: signedError } = await supabase.storage
      .from("chat-uploads")
      .createSignedUrl(path, 60 * 60);
    if (signedError) throw signedError;

    const signedUrl = signed?.signedUrl;
    if (!signedUrl) throw new Error("Impossible de générer l’URL signée");
    return signedUrl;
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      setUploading(true);
      try {
        for (const file of acceptedFiles) {
          // Taille
          if (file.size > maxSizeMB * 1024 * 1024) {
            toast.error(`${file.name} dépasse ${maxSizeMB} Mo`);
            continue;
          }

          // Preview locale
          const objectUrl = URL.createObjectURL(file);
          const isVideo = file.type.startsWith("video/");
          const preview: PreviewItem = { file, url: objectUrl, isVideo, name: file.name };
          setItems((prev) => [...prev, preview]);

          // Upload distant
          let finalUrl: string;
          if (destination === "cloudinary") {
            const { secure_url } = await cldUpload(file, cloudinaryFolder);
            finalUrl = secure_url;
          } else {
            finalUrl = await uploadToSupabase(file);
          }

          // Màj preview + notify parent
          setItems((prev) => prev.map((p) => (p.url === objectUrl ? { ...p, uploadedUrl: finalUrl } : p)));

          onFileUploaded(finalUrl, file);
          toast.success(`${file.name} uploadé`);
        }
      } catch (err: any) {
        console.error("Upload error:", err);
        toast.error(`Erreur lors de l'upload${err?.message ? `: ${err.message}` : ""}`);
      } finally {
        setUploading(false);
      }
    },
    [maxSizeMB, destination, cloudinaryFolder, onFileUploaded],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptMap,
    multiple,
    disabled: uploading,
  });

  const removeItem = (idx: number) => {
    setItems((prev) => {
      const clone = [...prev];
      const it = clone[idx];
      try {
        URL.revokeObjectURL(it.url);
      } catch {}
      clone.splice(idx, 1);
      return clone;
    });
  };

  // cleanup blobs on unmount
  useEffect(() => {
    return () => {
      items.forEach((it) => {
        try {
          URL.revokeObjectURL(it.url);
        } catch {}
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition",
          isDragActive ? "border-primary bg-primary/5" : "border-muted hover:border-primary/50",
          uploading && "opacity-50 cursor-not-allowed",
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2">
          <Upload className={cn("h-8 w-8", isDragActive ? "text-primary" : "text-muted-foreground")} />
          <div className="text-sm">
            {isDragActive ? (
              <p className="font-medium text-primary">Déposez les fichiers ici</p>
            ) : uploading ? (
              <p className="text-muted-foreground">Upload en cours...</p>
            ) : (
              <>
                <p className="font-medium">Glissez-déposez ou cliquez pour uploader</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Jusqu'à {maxSizeMB} Mo • Types: {acceptedTypes.join(", ")}
                </p>
                {destination === "cloudinary" ? (
                  <p className="text-[11px] text-muted-foreground mt-1">Destination: Cloudinary ({cloudinaryFolder})</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground mt-1">Destination: Supabase Storage (chat-uploads)</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Previews */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((it, idx) => (
            <div key={idx} className="relative group">
              <div className="w-24 h-24 rounded-lg overflow-hidden border bg-muted grid place-items-center">
                {it.isVideo ? (
                  <video src={it.url} className="w-full h-full object-cover" controls={false} muted playsInline />
                ) : (
                  <img src={it.url} alt={it.name} className="w-full h-full object-cover" />
                )}
              </div>

              <Button
                size="icon"
                variant="destructive"
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition"
                onClick={() => removeItem(idx)}
                title="Retirer"
              >
                <X className="h-3 w-3" />
              </Button>

              <p className="text-[11px] text-center mt-1 truncate max-w-[96px]">
                {it.uploadedUrl ? (
                  <a
                    className="underline decoration-dotted"
                    href={it.uploadedUrl}
                    target="_blank"
                    rel="noreferrer"
                    title={it.uploadedUrl}
                  >
                    {it.isVideo ? (
                      <span className="inline-flex items-center gap-1">
                        <Film className="w-3 h-3" /> Vidéo
                      </span>
                    ) : (
                      "Image"
                    )}
                  </a>
                ) : (
                  <span className="text-muted-foreground">préparation…</span>
                )}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
