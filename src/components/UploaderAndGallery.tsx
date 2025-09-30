'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Gallery from './Gallery';
import { useToast } from './Toast';

// Gallery Counter Component
function GalleryCounter({ eventCode, refreshKey }: { eventCode: string | null; refreshKey: number }) {
  const [photoCount, setPhotoCount] = useState(0);
  const [videoCount, setVideoCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventCode) return;

    const fetchCounts = async () => {
      try {
        setLoading(true);
        
        // Get all files for this event (using same table as Gallery component)
        const { data: files, error } = await supabase
          .from('media')
          .select('filename')
          .eq('event_code', eventCode);

        if (error) {
          console.error('Error fetching files:', error);
          return;
        }

        if (files) {
          let photos = 0;
          let videos = 0;
          
          files.forEach(file => {
            const extension = file.filename.split('.').pop()?.toLowerCase();
            
            if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension || '')) {
              photos++;
            } else if (['mp4', 'mov', 'webm'].includes(extension || '')) {
              videos++;
            }
          });

          setPhotoCount(photos);
          setVideoCount(videos);
        }
      } catch (error) {
        console.error('Error counting files:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCounts();
  }, [eventCode, refreshKey]);

  if (loading) {
    return (
      <div className="text-center py-2">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <p className="text-body-sm font-medium text-foreground">
        {photoCount} {photoCount === 1 ? 'photo' : 'photos'}
        {videoCount > 0 && ` and ${videoCount} ${videoCount === 1 ? 'video' : 'videos'}`}
      </p>
    </div>
  );
}

import { normalizeHashtag } from '@/lib/hashtags';

// Image compression utility
const compressImage = (file: File, maxWidth = 1920, quality = 0.8): Promise<File> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            resolve(file);
          }
        },
        'image/jpeg',
        quality
      );
    };
    
    img.src = URL.createObjectURL(file);
  });
};

// Generate unique ID for upload tracking
const generateUploadId = () => Math.random().toString(36).substr(2, 9);

// Chunked upload for large files
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024; // 50MB threshold for chunked upload

const uploadFileInChunks = async (
  file: File, 
  filePath: string, 
  onProgress: (progress: number) => void
): Promise<void> => {
  if (file.size <= LARGE_FILE_THRESHOLD) {
    // Use regular upload for smaller files
    const { error } = await supabase.storage
      .from('media')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false
      });
    
    if (error) throw error;
    onProgress(100);
    return;
  }

  // Chunked upload for large files
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const uploadId = generateUploadId();
  
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    
    const chunkPath = `${filePath}.chunk.${chunkIndex}`;
    
    const { error } = await supabase.storage
      .from('media')
      .upload(chunkPath, chunk, {
        contentType: file.type,
        upsert: false
      });
    
    if (error) throw error;
    
    // Update progress
    const progress = Math.round(((chunkIndex + 1) / totalChunks) * 100);
    onProgress(progress);
  }

  // Note: In a production environment, you would need server-side logic
  // to combine the chunks back into the original file
  // For now, we'll upload the file normally as a fallback
  const { error } = await supabase.storage
    .from('media')
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false
    });
  
  if (error) throw error;
  onProgress(100);
};

interface UploadFile {
  file: File;
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error' | 'retrying';
  error?: string;
  retryCount: number;
  maxRetries: number;
}

export default function UploaderAndGallery() {
  const [eventCode, setEventCode] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [configError, setConfigError] = useState<string | null>(null);
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const { showToast } = useToast();

  // Retry failed uploads
  const retryFailedUploads = async () => {
    const failedUploads = uploadFiles.filter(f => f.status === 'error' && f.retryCount < f.maxRetries);
    
    for (const uploadFile of failedUploads) {
      setUploadFiles(prev => prev.map(f => 
        f.id === uploadFile.id ? { ...f, status: 'retrying', retryCount: f.retryCount + 1 } : f
      ));

      try {
        const originalName = uploadFile.file.name;
        const sanitizedFileName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${eventCode}/${sanitizedFileName}`;

        await uploadFileInChunks(uploadFile.file, filePath, (progress) => {
          setUploadFiles(prev => prev.map(f => 
            f.id === uploadFile.id ? { ...f, progress } : f
          ));
        });

        setUploadFiles(prev => prev.map(f => 
          f.id === uploadFile.id ? { ...f, status: 'completed', progress: 100 } : f
        ));

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setUploadFiles(prev => prev.map(f => 
          f.id === uploadFile.id ? { 
            ...f, 
            status: f.retryCount >= f.maxRetries ? 'error' : 'pending',
            error: errorMessage 
          } : f
        ));
      }
    }
  };

  // Check for missing env vars
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setConfigError('Missing Supabase configuration. Please check your .env.local file.');
    }
  }, []);

  useEffect(() => {
    // Read from localStorage
    const storedEventCode = localStorage.getItem('eventCode');
    const storedDisplayName = localStorage.getItem('displayName');
    
    setEventCode(storedEventCode);
    setDisplayName(storedDisplayName);
  }, []);




  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);

    // Initialize upload files with compression
    const fileArray = Array.from(files);
    const uploadFiles: UploadFile[] = [];

    try {
      // Process files in parallel for compression
      const processedFiles = await Promise.all(
        fileArray.map(async (file) => {
          const uploadId = generateUploadId();
          let processedFile = file;

          // Compress images
          if (file.type.startsWith('image/') && file.size > 500000) { // 500KB threshold
            try {
              processedFile = await compressImage(file);
            } catch (error) {
              console.warn('Compression failed, using original file:', error);
            }
          }

          return {
            file: processedFile,
            id: uploadId,
            progress: 0,
            status: 'pending' as const,
            retryCount: 0,
            maxRetries: 3,
          };
        })
      );

      setUploadFiles(processedFiles);

      // Upload files in parallel with progress tracking
      const uploadResults: Array<{
        uploadFile: UploadFile;
        success: boolean;
        metadata?: {
          filename: string;
          file_path: string;
          file_size: number;
          mime_type: string;
        };
        error?: string;
      }> = [];

      const uploadPromises = processedFiles.map(async (uploadFile) => {
        const { file } = uploadFile;
        
        // Update status to uploading
        setUploadFiles(prev => prev.map(f => 
          f.id === uploadFile.id ? { ...f, status: 'uploading' } : f
        ));

        try {
          // Keep original filename but sanitize it for safe storage
          const originalName = file.name;
          const sanitizedFileName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
          const filePath = `${eventCode}/${sanitizedFileName}`;

          // Upload file to storage with progress tracking (chunked for large files)
          await uploadFileInChunks(file, filePath, (progress) => {
            setUploadFiles(prev => prev.map(f => 
              f.id === uploadFile.id ? { ...f, progress } : f
            ));
          });

          // Store metadata for batch insert
          uploadResults.push({
            uploadFile,
            success: true,
            metadata: {
              filename: sanitizedFileName,
              file_path: filePath,
              file_size: file.size,
              mime_type: file.type,
            }
          });

          // Update progress to 100% and mark as completed
          setUploadFiles(prev => prev.map(f => 
            f.id === uploadFile.id ? { ...f, progress: 100, status: 'completed' } : f
          ));

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          uploadResults.push({
            uploadFile,
            success: false,
            error: errorMessage
          });
          
          setUploadFiles(prev => prev.map(f => 
            f.id === uploadFile.id ? { 
              ...f, 
              status: 'error', 
              error: errorMessage 
            } : f
          ));
        }
      });

      // Wait for all uploads to complete
      await Promise.allSettled(uploadPromises);

      // Batch insert all successful uploads to database
      const successfulUploads = uploadResults.filter(r => r.success && r.metadata);
      if (successfulUploads.length > 0) {
        const batchData = successfulUploads.map(result => ({
          filename: result.metadata!.filename,
          file_path: result.metadata!.file_path,
          file_size: result.metadata!.file_size,
          mime_type: result.metadata!.mime_type,
          uploader_name: displayName || 'Unknown',
          event_code: eventCode
        }));

        const { error: batchDbError } = await supabase
          .from('media')
          .insert(batchData);

        if (batchDbError) {
          console.error('Batch database error:', batchDbError);
          // Individual files were uploaded successfully, just database metadata failed
        }
      }

      // Check results using the uploadResults array
      const completedFiles = uploadResults.filter(r => r.success).length;
      const errorFiles = uploadResults.filter(r => !r.success).length;

      if (completedFiles > 0) {
        showToast(`Successfully uploaded ${completedFiles} file${completedFiles > 1 ? 's' : ''}!`);
        // Small delay to ensure database is updated before refreshing gallery
        setTimeout(() => {
          setRefreshKey(prev => prev + 1);
        }, 500);
      }

      if (errorFiles > 0) {
        showToast(`${errorFiles} file${errorFiles > 1 ? 's' : ''} failed to upload`, 'error');
      }

      // Clear upload files after 3 seconds
      setTimeout(() => {
        setUploadFiles([]);
      }, 3000);

    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setUploadError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsUploading(false);
      // Clear file input
      event.target.value = '';
    }
  };

  if (configError) {
    return (
      <div className="card-floating p-4 border-red-200 bg-red-50">
        <h3 className="text-red-800 font-semibold mb-2">Configuration Error</h3>
        <p className="text-red-700 text-sm">{configError}</p>
      </div>
    );
  }

  if (!eventCode || !displayName) {
    return (
      <div className="card-floating p-6 text-center">
        <p className="mb-2 text-muted-foreground">Missing event information.</p>
      </div>
    );
  }

  // Validate eventCode format
  try {
    normalizeHashtag(eventCode);
  } catch {
    return (
      <div className="card-floating p-6 text-center">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md mx-auto mb-4">
          <p className="text-yellow-800 text-sm mb-3">
            The stored event code is invalid or corrupted.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="space-y-2">
        {/* Upload Section - Centered */}
        <div className="max-w-md mx-auto">
          <div className="card p-2 mb-6">
            <div className="space-y-4">
              <div className="relative">
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => document.getElementById('file-upload')?.click()}
                  className="btn btn-primary w-full h-11 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Upload Photos & Videos
                </button>
              </div>

              {/* Upload Progress */}
              {uploadFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-foreground">Upload Progress</h4>
                    {uploadFiles.some(f => f.status === 'error' && f.retryCount < f.maxRetries) && (
                      <button
                        onClick={retryFailedUploads}
                        className="text-xs text-primary hover:underline"
                      >
                        Retry Failed
                      </button>
                    )}
                  </div>
                  {uploadFiles.map((uploadFile) => (
                    <div key={uploadFile.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground truncate flex-1 mr-2">
                          {uploadFile.file.name}
                          {uploadFile.retryCount > 0 && (
                            <span className="text-orange-500 ml-1">
                              (Retry {uploadFile.retryCount}/{uploadFile.maxRetries})
                            </span>
                          )}
                        </span>
                        <span className="text-muted-foreground">
                          {uploadFile.progress}%
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            uploadFile.status === 'completed' 
                              ? 'bg-green-500' 
                              : uploadFile.status === 'error'
                              ? 'bg-red-500'
                              : uploadFile.status === 'retrying'
                              ? 'bg-orange-500'
                              : 'bg-primary'
                          }`}
                          style={{ width: `${uploadFile.progress}%` }}
                        />
                      </div>
                      {uploadFile.status === 'error' && uploadFile.error && (
                        <p className="text-xs text-red-500">{uploadFile.error}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Gallery Counter - styled like Create Hashtag and centered */}
              <div className="text-center">
                <GalleryCounter eventCode={eventCode} refreshKey={refreshKey} />
              </div>

              {uploadError && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                  <p className="text-destructive text-body-sm text-center">{uploadError}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Gallery Section - Full Width */}
        <div className="w-full">
          <Gallery 
            eventCode={eventCode} 
            refreshKey={refreshKey}
          />
        </div>
      </div>
    </div>
  );
}