'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import LightboxModal from './LightboxModal';
import { useToast } from './Toast';
import { 
  getCachedListing, 
  setCachedListing, 
  createDebouncedFunction,
  startEmptyGalleryRevalidation,
  stopEmptyGalleryRevalidation
} from '@/lib/galleryCache';

interface GalleryProps {
  eventCode: string;
  refreshKey: number;
}

interface FileObject {
  name: string;
  id: string;
  created_at: string;
  size: number;
}

export default function Gallery({ eventCode, refreshKey }: GalleryProps) {
  const [files, setFiles] = useState<FileObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeUrl, setActiveUrl] = useState('');
  const [activeType, setActiveType] = useState<'image' | 'video'>('image');
  const [activeTitle, setActiveTitle] = useState('');
  const { showToast } = useToast();
  const isInitialLoad = useRef(true);
  const lastRefreshKey = useRef(refreshKey);

  const fetchFilesFromSupabase = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) {
        setLoading(true);
        setError(null);
      }

      const { data, error } = await supabase.storage
        .from('media')
        .list(eventCode, { limit: 1000 });

      if (error) {
        throw new Error(error.message);
      }

      // Sort by created_at (newest first) or by name as fallback
      const sortedFiles = data?.sort((a, b) => {
        if (a.created_at && b.created_at) {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        return b.name.localeCompare(a.name);
      }) || [];

      // Update cache
      setCachedListing(eventCode, sortedFiles);
      
      // Update UI only if this is not a background refresh or if files changed
      setFiles(prevFiles => {
        // Only update if files actually changed to prevent flashing
        if (JSON.stringify(prevFiles) !== JSON.stringify(sortedFiles)) {
          return sortedFiles;
        }
        return prevFiles;
      });

      // Manage empty gallery revalidation
      if (sortedFiles.length === 0) {
        startEmptyGalleryRevalidation(eventCode, () => {
          fetchFilesFromSupabase(true);
        });
      } else {
        stopEmptyGalleryRevalidation(eventCode);
      }

    } catch (err) {
      console.error('Error fetching files:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load files';
      setError(errorMessage);
      if (!isBackground) {
        showToast(errorMessage, 'error');
      }
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  }, [eventCode, showToast]);

  const loadFilesWithCache = useCallback(async () => {
    // Try cache first
    const cached = getCachedListing(eventCode);
    if (cached) {
      setFiles(cached.files);
      setLoading(false);
      // Fetch fresh data in background after a short delay to prevent flashing
      setTimeout(() => {
        fetchFilesFromSupabase(true);
      }, 100);
    } else {
      // No cache, fetch immediately
      await fetchFilesFromSupabase();
    }
  }, [eventCode, fetchFilesFromSupabase]);

  // Debounced fetch function
  const debouncedFetchFiles = useCallback(
    createDebouncedFunction(fetchFilesFromSupabase, 300),
    [fetchFilesFromSupabase]
  );

  useEffect(() => {
    // Check if this is a refresh (not initial load)
    const isRefresh = refreshKey !== lastRefreshKey.current;
    lastRefreshKey.current = refreshKey;

    if (isInitialLoad.current) {
      // Initial load: try cache first, then fetch
      loadFilesWithCache();
      isInitialLoad.current = false;
    } else if (isRefresh) {
      // Only debounce on actual refreshes, not initial loads
      debouncedFetchFiles();
    }
  }, [eventCode, refreshKey, loadFilesWithCache, debouncedFetchFiles]);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      stopEmptyGalleryRevalidation(eventCode);
    };
  }, [eventCode]);

  const getFileType = (fileName: string): 'image' | 'video' | 'other' => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension || '')) {
      return 'image';
    }
    
    if (['mp4', 'mov', 'webm'].includes(extension || '')) {
      return 'video';
    }
    
    return 'other';
  };

  const getPublicUrl = (fileName: string) => {
    const { data } = supabase.storage
      .from('media')
      .getPublicUrl(`${eventCode}/${fileName}`);
    
    return data.publicUrl;
  };

  const handleTileClick = (file: FileObject) => {
    const fileType = getFileType(file.name);
    const publicUrl = getPublicUrl(file.name);
    
    if (fileType === 'other') {
      return; // Don't open modal for unsupported file types
    }
    
    setActiveUrl(publicUrl);
    setActiveType(fileType);
    setActiveTitle(file.name);
    setLightboxOpen(true);
  };

  const handleCopyLink = async (publicUrl: string, fileName: string) => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      showToast('Copied link!');
    } catch (err) {
      console.error('Failed to copy link:', err);
      showToast('Failed to copy link', 'error');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Gallery
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square bg-gray-200 rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700 text-sm">Error loading gallery: {error}</p>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📸</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No uploads yet</h3>
        <p className="text-gray-500">Add some photos or videos!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">
        Gallery ({files.length} files)
      </h3>
      
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {files.map((file) => {
          const fileType = getFileType(file.name);
          const publicUrl = getPublicUrl(file.name);
          
          return (
            <div
              key={file.id}
              className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 hover:ring-opacity-50 transition-all group shadow-sm"
              onClick={() => handleTileClick(file)}
            >
              {fileType === 'image' ? (
                <img
                  src={publicUrl}
                  alt={file.name}
                  loading="lazy"
                  className="aspect-square object-cover rounded-xl w-full h-full"
                />
              ) : fileType === 'video' ? (
                <video
                  src={publicUrl}
                  muted
                  playsInline
                  className="aspect-square object-cover rounded-xl w-full h-full"
                  preload="metadata"
                  controls={false}
                  autoPlay={false}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-200 rounded-xl">
                  <span className="text-xs text-gray-500 truncate px-2">
                    {file.name}
                  </span>
                </div>
              )}
              
              {/* Copy Link Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyLink(publicUrl, file.name);
                }}
                className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                title="Copy link"
                aria-label="Copy link"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>


      {/* Lightbox Modal */}
      <LightboxModal
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        fileType={activeType}
        publicUrl={activeUrl}
        title={activeTitle}
      />
    </div>
  );
}