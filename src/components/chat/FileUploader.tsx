import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface FileUploaderProps {
  onFileUploaded: (url: string, file: File) => void;
  acceptedTypes?: string[];
  maxSizeMB?: number;
}

export function FileUploader({ 
  onFileUploaded, 
  acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'],
  maxSizeMB = 10
}: FileUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ file: File; preview: string }>>([]);

  const uploadToStorage = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    const { error: uploadError, data } = await supabase.storage
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
    
    try {
      for (const file of acceptedFiles) {
        // Check file size
        if (file.size > maxSizeMB * 1024 * 1024) {
          toast.error(`${file.name} dépasse ${maxSizeMB}Mo`);
          continue;
        }

        // Upload to storage
        const url = await uploadToStorage(file);
        
        // Create preview
        const preview = URL.createObjectURL(file);
        setUploadedFiles(prev => [...prev, { file, preview }]);
        
        // Notify parent
        onFileUploaded(url, file);
        
        toast.success(`${file.name} uploadé`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erreur lors de l\'upload');
    } finally {
      setUploading(false);
    }
  }, [maxSizeMB, onFileUploaded]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedTypes.reduce((acc, type) => ({ ...acc, [type]: [] }), {}),
    multiple: true,
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
