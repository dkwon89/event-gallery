'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import Gallery from './Gallery';
import { useToast } from './Toast';
import { normalizeHashtag } from '@/lib/hashtags';

export default function UploaderAndGallery() {
  const [eventCode, setEventCode] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
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
    setUploadError(null);

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        // Get file extension
        const fileExtension = file.name.split('.').pop() || '';
        
        // Create a safe filename using only UUID and extension
        const safeFileName = `${uuidv4()}.${fileExtension}`;
        
        // eventCode is already normalized, use it directly
        const filePath = `${eventCode}/${safeFileName}`;

        const { error } = await supabase.storage
          .from('media')
          .upload(filePath, file, {
            contentType: file.type,
            upsert: false
          });

        if (error) {
          // Safely extract error message
          let errorMsg = 'Unknown error';
          try {
            errorMsg = error.message || 'Unknown error';
          } catch {
            errorMsg = 'Failed to get error message';
          }
          throw new Error(`Failed to upload ${file.name}: ${errorMsg}`);
        }

        return safeFileName;
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
    }
  };

  if (configError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-red-800 font-semibold mb-2">Configuration Error</h3>
        <p className="text-red-700 text-sm">{configError}</p>
      </div>
    );
  }

  if (!eventCode || !displayName) {
    return (
      <div className="text-center text-gray-600">
        <p className="mb-2">Missing event information.</p>
        <button
          onClick={handleSwitchEvent}
          className="text-blue-600 hover:text-blue-800 underline text-sm"
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
      <div className="text-center text-gray-600">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md mx-auto mb-4">
          <p className="text-yellow-800 text-sm mb-3">
            The stored event code is invalid or corrupted.
          </p>
          <button
            onClick={handleSwitchEvent}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Join a new event
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
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
            className="w-full h-11 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed"
          >
            {isUploading ? 'Uploading…' : 'Upload Photos & Videos'}
          </button>
        </div>

        {/* Select and Download Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={handleSelectMode}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              isSelectMode
                ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-500'
            }`}
          >
            {isSelectMode ? 'Cancel Select' : 'Select'}
          </button>
          <button
            onClick={handleDownloadSelected}
            disabled={selectedFiles.size === 0}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed ${
              selectedFiles.size > 0
                ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Download ({selectedFiles.size})
          </button>
        </div>

        {uploadError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-red-700 text-sm">{uploadError}</p>
          </div>
        )}
      </div>

      {/* Gallery Section */}
      <div className="max-h-[70vh] overflow-y-auto">
        <Gallery 
          eventCode={eventCode} 
          refreshKey={refreshKey}
          isSelectMode={isSelectMode}
          selectedFiles={selectedFiles}
          onFileSelect={handleFileSelect}
        />
      </div>
    </div>
  );
}