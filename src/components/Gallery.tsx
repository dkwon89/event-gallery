'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import NextImage from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import LightboxModal from './LightboxModal';
import { useToast } from './Toast';
import {
  getCachedListing,
  setCachedListing,
  startEmptyGalleryRevalidation,
  stopEmptyGalleryRevalidation
} from '@/lib/galleryCache';

// Add shimmer animation CSS
const shimmerCSS = `
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
`;

// Inject CSS
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = shimmerCSS;
  document.head.appendChild(style);
}

interface GalleryProps {
  eventCode: string;
  refreshKey: number;
}

interface FileObject {
  name: string;
  id: string;
  created_at: string;
  size?: number;
  uploader_name?: string;
}

export default function Gallery({ eventCode, refreshKey }: GalleryProps) {
  const [files, setFiles] = useState<FileObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeUrl, setActiveUrl] = useState('');
  const [activeType, setActiveType] = useState<'image' | 'video'>('image');
  const [activeTitle, setActiveTitle] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [videoPosters, setVideoPosters] = useState<Map<string, string>>(new Map());
  const { showToast } = useToast();
  const isInitialLoad = useRef(true);
  const lastRefreshKey = useRef(refreshKey);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const fetchFilesFromSupabase = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) {
        setLoading(true);
        setError(null);
      }

      // Fetch from database to get metadata including uploader names
      const { data: dbData, error: dbError } = await supabase
        .from('media')
        .select('*')
        .eq('event_code', eventCode)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (dbError) {
        throw new Error(dbError.message);
      }

      // Convert database records to the format expected by the UI
      const sortedFiles = (dbData || []).map(record => ({
        name: record.filename,
        id: record.id,
        created_at: record.created_at,
        size: record.file_size || 0,
        uploader_name: record.uploader_name || 'Unknown'
      }));

      // Update cache - map the files to ensure they have the required structure
      const mappedFiles = sortedFiles.map(file => ({
        name: file.name,
        id: file.id,
        created_at: file.created_at,
        size: file.size,
        uploader_name: file.uploader_name
      }));
      setCachedListing(eventCode, mappedFiles);
      
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
  const debouncedFetchFiles = useCallback(() => {
    const timeoutId = setTimeout(() => {
      fetchFilesFromSupabase();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [fetchFilesFromSupabase]);

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

  // Setup intersection observer for preloading images
  useEffect(() => {
    if (typeof window === 'undefined') return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            const src = img.dataset.src;
            if (src && !loadedImages.has(src)) {
              // Preload image for better performance
              const preloadImg = new Image();
              preloadImg.onload = () => {
                setLoadedImages(prev => new Set(prev).add(src));
              };
              preloadImg.src = src;
            }
          }
        });
      },
      {
        rootMargin: '200px 0px',
        threshold: 0.1
      }
    );

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loadedImages]);

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

  const getPublicUrl = useCallback((fileName: string) => {
    // eventCode is already normalized, use it directly
    const { data } = supabase.storage
      .from('media')
      .getPublicUrl(`${eventCode}/${fileName}`);
    
    return data.publicUrl;
  }, [eventCode]);

  // Preload first few images for better perceived performance
  useEffect(() => {
    if (files.length > 0) {
      const firstFewImages = files
        .filter(file => getFileType(file.name) === 'image')
        .slice(0, 6) // Preload first 6 images
        .map(file => getPublicUrl(file.name));
      
      firstFewImages.forEach(url => {
        if (!loadedImages.has(url)) {
          const img = new Image();
          img.onload = () => {
            setLoadedImages(prev => new Set(prev).add(url));
          };
          img.src = url;
        }
      });
    }
  }, [files, loadedImages, getPublicUrl]);

  // Generate video posters for video files
  useEffect(() => {
    if (files.length > 0) {
      const videoFiles = files.filter(file => getFileType(file.name) === 'video');
      
      videoFiles.forEach(file => {
        const videoUrl = getPublicUrl(file.name);
        
        // Only generate poster if we don't already have one
        if (!videoPosters.has(videoUrl)) {
          generateVideoPoster(videoUrl)
            .then(posterUrl => {
              setVideoPosters(prev => new Map(prev).set(videoUrl, posterUrl));
            })
            .catch(error => {
              console.error('Failed to generate video poster:', error);
            });
        }
      });
    }
  }, [files, videoPosters, getPublicUrl]);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      stopEmptyGalleryRevalidation(eventCode);
    };
  }, [eventCode]);

  const generateVideoPoster = (videoUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        // Seek to 1 second to get a good frame
        video.currentTime = 1;
      };
      
      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          
          // Set canvas dimensions to video dimensions
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          // Draw the video frame to canvas
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Convert canvas to data URL
          const posterUrl = canvas.toDataURL('image/jpeg', 0.8);
          resolve(posterUrl);
        } catch (error) {
          reject(error);
        }
      };
      
      video.onerror = () => {
        reject(new Error('Failed to load video'));
      };
      
      video.src = videoUrl;
    });
  };

  const handleTileClick = (file: FileObject) => {
    const fileType = getFileType(file.name);
    const publicUrl = getPublicUrl(file.name);
    
    if (fileType === 'other') {
      return; // Don't open modal for unsupported file types
    }
    
    const index = files.findIndex(f => f.id === file.id);
    
    setActiveUrl(publicUrl);
    setActiveType(fileType);
    setActiveTitle(file.name);
    setActiveIndex(index);
    setLightboxOpen(true);
  };

  const handlePrevious = () => {
    if (activeIndex > 0) {
      const prevFile = files[activeIndex - 1];
      const fileType = getFileType(prevFile.name);
      const publicUrl = getPublicUrl(prevFile.name);
      
      if (fileType === 'other') {
        return; // Skip unsupported file types
      }
      
      setActiveUrl(publicUrl);
      setActiveType(fileType);
      setActiveTitle(prevFile.name);
      setActiveIndex(activeIndex - 1);
    }
  };

  const handleNext = () => {
    if (activeIndex < files.length - 1) {
      const nextFile = files[activeIndex + 1];
      const fileType = getFileType(nextFile.name);
      const publicUrl = getPublicUrl(nextFile.name);
      
      if (fileType === 'other') {
        return; // Skip unsupported file types
      }
      
      setActiveUrl(publicUrl);
      setActiveType(fileType);
      setActiveTitle(nextFile.name);
      setActiveIndex(activeIndex + 1);
    }
  };


  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <h3 className="text-h3 text-foreground">
          Gallery
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`skeleton-${i}`}
              className="aspect-square bg-muted rounded-xl animate-pulse relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-muted via-muted-foreground/20 to-muted animate-pulse" 
                   style={{
                     background: 'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)',
                     backgroundSize: '200% 100%',
                     animation: 'shimmer 1.5s infinite'
                   }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm">Error loading gallery: {error}</p>
        </div>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-muted to-muted-foreground/20 rounded-2xl flex items-center justify-center">
          <div className="text-3xl">📸</div>
        </div>
        <h3 className="text-h2 text-foreground mb-3">No uploads yet</h3>
        <p className="text-muted-foreground text-body-lg">Add some photos or videos to get started!</p>
        <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-muted-foreground/30 to-transparent mx-auto mt-6"></div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="space-y-6 py-6">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-0.5 px-4">
        {files.map((file) => {
          const fileType = getFileType(file.name);
          const publicUrl = getPublicUrl(file.name);
          
          return (
            <div
              key={`file-${file.id}`}
              className="relative aspect-square bg-white overflow-hidden cursor-pointer transition-all duration-300 group shadow-sm hover:shadow-lg hover:-translate-y-1"
              onClick={() => handleTileClick(file)}
            >
              {fileType === 'image' ? (
                <div className="relative aspect-square w-full h-full">
                  <NextImage
                    src={publicUrl}
                    alt={file.name}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                    className="object-cover"
                    loading="lazy"
                    quality={85}
                    placeholder="blur"
                    blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
                    onLoad={() => {
                      setLoadedImages(prev => new Set(prev).add(publicUrl));
                    }}
                    onError={() => {
                      console.error('Failed to load image:', publicUrl);
                    }}
                  />
                </div>
              ) : fileType === 'video' ? (
                <div className="relative aspect-square w-full h-full">
                  <video
                    src={publicUrl}
                    muted
                    playsInline
                    className="aspect-square object-cover w-full h-full"
                    preload="none"
                    controls={false}
                    autoPlay={false}
                    poster={videoPosters.get(publicUrl) || ''}
                    onLoadStart={() => {
                      // Preload video metadata when user hovers
                    }}
                  />
                  {/* Play button overlay */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-black/50 rounded-full p-3">
                      <svg 
                        className="w-8 h-8 text-white" 
                        fill="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted rounded-2xl">
                  <span className="text-xs text-muted-foreground truncate px-2">
                    {file.name}
                  </span>
                </div>
              )}
              
              {/* Uploader Name */}
              {file.uploader_name && (
                <div className="absolute bottom-3 left-3 text-white text-xs font-bold">
                  {file.uploader_name}
                </div>
              )}

            </div>
          );
        })}
        </div>
      </div>

      {/* Lightbox Modal */}
      <LightboxModal
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        fileType={activeType}
        publicUrl={activeUrl}
        title={activeTitle}
        onPrevious={handlePrevious}
        onNext={handleNext}
        hasPrevious={activeIndex > 0}
        hasNext={activeIndex < files.length - 1}
      />
    </div>
  );
}