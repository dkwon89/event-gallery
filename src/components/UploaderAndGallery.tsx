'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Gallery from './Gallery';
import { useToast } from './Toast';
import { normalizeHashtag } from '@/lib/hashtags';

export default function UploaderAndGallery() {
  const [eventCode, setEventCode] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [configError, setConfigError] = useState<string | null>(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Map<string, string>>(new Map()); // fileId -> filename
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

  const handleSwitchEvent = () => {
    localStorage.removeItem('eventCode');
    localStorage.removeItem('displayName');
    window.location.reload();
  };

  const handleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
    if (isSelectMode) {
      setSelectedFiles(new Map());
    }
  };

  const handleFileSelect = (fileId: string, fileName: string) => {
    setSelectedFiles(prev => {
      const newMap = new Map(prev);
      if (newMap.has(fileId)) {
        newMap.delete(fileId);
      } else {
        newMap.set(fileId, fileName);
      }
      return newMap;
    });
  };

  const handleDownloadSelected = async () => {
    if (selectedFiles.size === 0) return;

    try {
      const selectedFileNames: string[] = [];
      
      for (const [fileId, fileName] of selectedFiles) {
        const filePath = `${eventCode}/${fileName}`;
        
        try {
          // Try to create a signed URL first (more reliable for downloads)
          const { data: signedData, error: signedError } = await supabase.storage
            .from('media')
            .createSignedUrl(filePath, 3600); // 1 hour expiry
          
          if (signedError) {
            console.error('Signed URL failed, trying public URL:', signedError);
            
            // Fallback to public URL
            const { data: publicData } = supabase.storage
              .from('media')
              .getPublicUrl(filePath);
            
            const downloadUrl = publicData.publicUrl;
            
            // Simple direct download approach
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = fileName;
            link.target = '_blank';
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            selectedFileNames.push(fileName);
            continue;
          }
          
          // Use signed URL for better reliability
          const downloadUrl = signedData.signedUrl;
          
          // Check if Web Share API is available (better for mobile)
          if (navigator.share && navigator.canShare) {
            try {
              // Fetch the file for sharing
              const response = await fetch(downloadUrl);
              if (response.ok) {
                const blob = await response.blob();
                const file = new File([blob], fileName, { type: blob.type });
                
                if (navigator.canShare({ files: [file] })) {
                  await navigator.share({
                    files: [file],
                    title: `Share ${fileName}`,
                    text: `Downloaded from ${eventCode}`
                  });
                  selectedFileNames.push(fileName);
                  continue;
                }
              }
            } catch (shareError) {
              console.log('Web Share API failed, falling back to download:', shareError);
            }
          }
          
          // Fallback: Direct download using signed URL
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = fileName;
          link.target = '_blank';
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          selectedFileNames.push(fileName);
          
        } catch (error) {
          console.error('Error downloading file:', fileName, error);
          showToast(`Failed to download ${fileName}`, 'error');
        }
      }

      if (selectedFileNames.length > 0) {
        showToast(`Downloaded ${selectedFileNames.length} file${selectedFileNames.length > 1 ? 's' : ''} to your device`);
        setSelectedFiles(new Map());
        setIsSelectMode(false);
      } else {
        showToast('No files could be downloaded', 'error');
      }
    } catch (error) {
      console.error('Download error:', error);
      showToast('Failed to download files', 'error');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      const fileArray = Array.from(files);
      let completedFiles = 0;

      const uploadPromises = fileArray.map(async (file) => {
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

        // Update progress
        completedFiles++;
        const progress = Math.round((completedFiles / fileArray.length) * 100);
        setUploadProgress(progress);

        return sanitizedFileName;
      });

      await Promise.all(uploadPromises);
      
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
      setUploadProgress(0);
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
        <button
          onClick={handleSwitchEvent}
          className="btn-ghost text-primary hover:text-primary/80"
        >
          Switch Event
        </button>
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
          <button
            onClick={handleSwitchEvent}
            className="btn-ghost text-primary hover:text-primary/80"
          >
            Join a new event
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="space-y-6">
        {/* Upload Section - Centered */}
        <div className="max-w-md mx-auto px-4 py-6">
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
                className="btn btn-primary w-full h-11 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
              >
                {/* Progress bar background */}
                {isUploading && (
                  <div 
                    className="absolute inset-0 bg-white/20 transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                )}
                
                {/* Button content */}
                <div className="relative z-10">
                  {isUploading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Uploading {uploadProgress}%</span>
                    </div>
                  ) : (
                    'Upload Photos & Videos'
                  )}
                </div>
              </button>
            </div>

            {/* Select and Download Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleSelectMode}
                className={`flex-1 btn h-11 ${
                  isSelectMode
                    ? 'btn-primary'
                    : 'btn-secondary'
                }`}
              >
                {isSelectMode ? 'Cancel Select' : 'Select'}
              </button>
              <button
                onClick={handleDownloadSelected}
                disabled={selectedFiles.size === 0}
                className={`flex-1 btn h-11 disabled:opacity-50 disabled:cursor-not-allowed ${
                  selectedFiles.size > 0
                    ? 'btn-primary'
                    : 'btn-ghost'
                }`}
              >
                Download ({selectedFiles.size})
              </button>
            </div>

            {uploadError && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                <p className="text-destructive text-body-sm text-center">{uploadError}</p>
              </div>
            )}
          </div>
        </div>

        {/* Gallery Section - Full Width */}
        <div className="w-full">
          <Gallery 
            eventCode={eventCode} 
            refreshKey={refreshKey}
            isSelectMode={isSelectMode}
            selectedFiles={selectedFiles}
            onFileSelect={handleFileSelect}
          />
        </div>
      </div>
    </div>
  );
}