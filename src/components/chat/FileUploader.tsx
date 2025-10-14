import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface FileUploaderProps {
  onFileUploaded: (url: string, file: File) => Promise<void> | void;
  acceptedTypes?: string[];
  maxSizeMB?: number;
  onUploadStart?: () => void;
  onUploadComplete?: () => void;
}

export function FileUploader({
  onFileUploaded,
  acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'],
  maxSizeMB = 10,
  onUploadStart,
  onUploadComplete
}: FileUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ file: File; preview: string }>>([]);

  useEffect(() => {
    return () => {
      uploadedFiles.forEach(item => URL.revokeObjectURL(item.preview));
    };
  }, [uploadedFiles]);

  const uploadToStorage = async (file: File): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Utilisateur non authentifié');
    }

    const fileExt = file.name.split('.').pop() || 'png';
    const uniqueId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const filePath = `${user.id}/${uniqueId}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('chat-uploads')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('chat-uploads')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setUploading(true);
    onUploadStart?.();

    try {
      const [file] = acceptedFiles;

      if (file.size > maxSizeMB * 1024 * 1024) {
        toast.error(`${file.name} dépasse ${maxSizeMB}Mo`);
        return;
      }

      const url = await uploadToStorage(file);
      const preview = URL.createObjectURL(file);

      setUploadedFiles(prev => {
        prev.forEach(item => URL.revokeObjectURL(item.preview));
        return [{ file, preview }];
      });

      await onFileUploaded(url, file);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erreur lors de l\'upload');
    } finally {
      setUploading(false);
      onUploadComplete?.();
    }
  }, [maxSizeMB, onFileUploaded, onUploadStart, onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedTypes.reduce((acc, type) => ({ ...acc, [type]: [] }), {}),
    multiple: false,
    disabled: uploading
  });

  const removeFile = (index: number) => {
    setUploadedFiles(prev => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  return (
    <div className="space-y-3">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition
          ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'}
          ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2">
          <Upload className={`h-8 w-8 ${isDragActive ? 'text-primary' : 'text-muted-foreground'}`} />
          <div className="text-sm">
            {isDragActive ? (
              <p className="font-medium text-primary">Déposez les fichiers ici</p>
            ) : uploading ? (
              <p className="text-muted-foreground">Upload en cours...</p>
            ) : (
              <>
                <p className="font-medium">Drag & drop ou cliquez pour uploader</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Images jusqu'à {maxSizeMB}Mo
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Preview uploaded files */}
      {uploadedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {uploadedFiles.map((item, index) => (
            <div key={index} className="relative group">
              <div className="w-20 h-20 rounded-lg overflow-hidden border">
                <img 
                  src={item.preview} 
                  alt={item.file.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <Button
                size="icon"
                variant="destructive"
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition"
                onClick={() => removeFile(index)}
              >
                <X className="h-3 w-3" />
              </Button>
              <p className="text-xs text-center mt-1 truncate max-w-[80px]">
                {item.file.name}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
