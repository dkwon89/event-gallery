'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import Gallery from './Gallery';
import { useToast } from './Toast';

export default function UploaderAndGallery() {
  const [eventCode, setEventCode] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [configError, setConfigError] = useState<string | null>(null);
  const { showToast, ToastContainer } = useToast();

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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const fileName = `${uuidv4()}-${file.name}`;
        const filePath = `${eventCode}/${fileName}`;

        const { error } = await supabase.storage
          .from('media')
          .upload(filePath, file, {
            contentType: file.type,
            upsert: false
          });

        if (error) {
          throw new Error(`Failed to upload ${file.name}: ${error.message}`);
        }

        return fileName;
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
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900">
          Event: <span className="text-blue-600">{eventCode}</span> • You: <span className="text-green-600">{displayName}</span>
        </h2>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="space-y-4">
          <div>
            <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 mb-3">
              Add Photos & Videos
            </label>
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
                {isUploading ? 'Uploading…' : 'Add Photos & Videos'}
              </button>
            </div>
          </div>

          {uploadError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-700 text-sm">{uploadError}</p>
            </div>
          )}
        </div>
      </div>

      {/* Gallery Section */}
      <div className="max-h-[70vh] overflow-y-auto">
        <Gallery eventCode={eventCode} refreshKey={refreshKey} />
      </div>

      {/* Toast Container */}
      <ToastContainer />
    </div>
  );
}