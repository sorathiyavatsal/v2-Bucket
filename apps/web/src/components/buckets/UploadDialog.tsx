'use client';

import { useState, useRef } from 'react';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Upload, X, File, Loader2 } from 'lucide-react';

export interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bucketName: string;
  currentPath?: string;
  onUpload?: (files: File[]) => Promise<void>;
}

interface FileWithProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

export function UploadDialog({
  open,
  onOpenChange,
  bucketName,
  currentPath = '',
  onUpload,
}: UploadDialogProps) {
  const [files, setFiles] = useState<FileWithProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(file => ({
        file,
        progress: 0,
        status: 'pending' as const,
      }));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setIsUploading(true);

    try {
      // TODO: Implement actual upload with progress tracking
      // For now, simulate upload
      for (let i = 0; i < files.length; i++) {
        setFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: 'uploading' as const } : f
        ));

        // Simulate upload progress
        for (let progress = 0; progress <= 100; progress += 20) {
          await new Promise(resolve => setTimeout(resolve, 200));
          setFiles(prev => prev.map((f, idx) =>
            idx === i ? { ...f, progress } : f
          ));
        }

        setFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: 'success' as const, progress: 100 } : f
        ));
      }

      // Call onUpload with actual files
      await onUpload?.(files.map(f => f.file));

      // Close dialog after successful upload
      setTimeout(() => {
        setFiles([]);
        onOpenChange(false);
      }, 1000);
    } catch (error) {
      console.error('Upload error:', error);
      setFiles(prev => prev.map(f => ({
        ...f,
        status: 'error' as const,
        error: error instanceof Error ? error.message : 'Upload failed',
      })));
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Upload Files</DialogTitle>
        <DialogDescription>
          Upload files to {bucketName}{currentPath && ` / ${currentPath}`}
        </DialogDescription>
      </DialogHeader>

      <DialogContent>
        <div className="space-y-4">
          {/* Drop Zone */}
          <div
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 text-center hover:border-muted-foreground/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-sm font-medium">Click to select files</p>
            <p className="text-xs text-muted-foreground mt-1">
              or drag and drop files here
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              disabled={isUploading}
            />
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {files.map((fileWithProgress, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <File className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">
                        {fileWithProgress.file.name}
                      </p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatFileSize(fileWithProgress.file.size)}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    {fileWithProgress.status === 'uploading' && (
                      <div className="mt-2">
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${fileWithProgress.progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {fileWithProgress.progress}%
                        </p>
                      </div>
                    )}

                    {/* Success */}
                    {fileWithProgress.status === 'success' && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                        Uploaded successfully
                      </p>
                    )}

                    {/* Error */}
                    {fileWithProgress.status === 'error' && (
                      <p className="text-xs text-destructive mt-1">
                        {fileWithProgress.error}
                      </p>
                    )}
                  </div>

                  {!isUploading && fileWithProgress.status === 'pending' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setFiles([]);
            onOpenChange(false);
          }}
          disabled={isUploading}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleUpload}
          disabled={files.length === 0 || isUploading}
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            `Upload ${files.length} file${files.length !== 1 ? 's' : ''}`
          )}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
