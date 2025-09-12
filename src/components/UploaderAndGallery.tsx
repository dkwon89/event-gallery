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

export default function UploaderAndGallery() {
  const [eventCode, setEventCode] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [configError, setConfigError] = useState<string | null>(null);
  const { showToast } = useToast();

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

    try {
      const fileArray = Array.from(files);

      // Upload files sequentially
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        
        // Keep original filename but sanitize it for safe storage
        const originalName = file.name;
        const sanitizedFileName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
        
        // eventCode is already normalized, use it directly
        const filePath = `${eventCode}/${sanitizedFileName}`;

        // Upload file to storage
        const { error: storageError } = await supabase.storage
          .from('media')
          .upload(filePath, file, {
            contentType: file.type,
            upsert: false
          });

        if (storageError) {
          // Safely extract error message
          let errorMsg = 'Unknown error';
          try {
            errorMsg = storageError.message || 'Unknown error';
          } catch {
            errorMsg = 'Failed to get error message';
          }
          throw new Error(`Failed to upload ${file.name}: ${errorMsg}`);
        }

        // Save metadata to database
        const { error: dbError } = await supabase
          .from('media')
          .insert({
            filename: sanitizedFileName,
            file_path: filePath,
            file_size: file.size,
            mime_type: file.type,
            uploader_name: displayName || 'Unknown',
            event_code: eventCode
          });

        if (dbError) {
          console.error('Database error:', dbError);
          // Don't throw error here - file was uploaded successfully
          // Just log the error and continue
        }
      }
      
      // Show success toast
      showToast(`Successfully uploaded ${files.length} file${files.length > 1 ? 's' : ''}!`);
      
      // Refresh gallery
      setRefreshKey(prev => prev + 1);
      
      // Clear file input
      event.target.value = '';
      
    } catch (error) {
      console.error('Upload error:', error);
      
      let errorMessage: string;
      if (error instanceof Error) {
        // Try to get the message, but fallback to string representation of error if message is problematic
        try {
          errorMessage = error.message;
        } catch (msgError) {
          console.error("Error accessing error.message:", msgError);
          errorMessage = `An unexpected error occurred (failed to get error message). Details: ${String(error)}`;
        }
      } else {
        errorMessage = `An unknown error occurred. Details: ${String(error)}`;
      }

      setUploadError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsUploading(false);
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