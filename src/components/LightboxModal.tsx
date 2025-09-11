'use client';

import { useEffect, useState, useRef } from 'react';
import NextImage from 'next/image';

interface LightboxModalProps {
  open: boolean;
  onClose: () => void;
  fileType: 'image' | 'video';
  publicUrl: string;
  title?: string;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

export default function LightboxModal({ 
  open, 
  onClose, 
  fileType, 
  publicUrl, 
  title,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false
}: LightboxModalProps) {
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [lastDistance, setLastDistance] = useState<number | null>(null);
  const [lastTap, setLastTap] = useState(0);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [lastPanX, setLastPanX] = useState(0);
  const [lastPanY, setLastPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [showControls, setShowControls] = useState(false);

  // Auto-hide controls after 3 seconds
  useEffect(() => {
    if (showControls) {
      const timer = setTimeout(() => {
        setShowControls(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showControls]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      // Reset transform values when modal opens
      setScale(1);
      setPanX(0);
      setPanY(0);
      setIsPanning(false);
    } else {
      document.body.style.overflow = 'unset';
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Shift+Escape') {
        onClose();
      }
    };

    if (open) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, onClose]);

  // Swipe detection
  const minSwipeDistance = 50;

  // Calculate distance between two touch points
  const getDistance = (touch1: Touch, touch2: Touch) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      // Single touch - handle swipe, pan, or double tap
      setTouchEnd(null);
      setTouchStart({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
      
      // If zoomed in, start panning
      if (scale > 1) {
        setIsPanning(true);
        setLastPanX(e.touches[0].clientX);
        setLastPanY(e.touches[0].clientY);
      }
      
      // Handle double tap to reset zoom
      const now = Date.now();
      if (now - lastTap < 300) {
        setScale(1);
        setPanX(0);
        setPanY(0);
        setLastPanX(0);
        setLastPanY(0);
      }
      setLastTap(now);
    } else if (e.touches.length === 2) {
      // Two touches - handle pinch
      e.preventDefault();
      e.stopPropagation();
      setIsPanning(false);
      const distance = getDistance(e.touches[0], e.touches[1]);
      setLastDistance(distance);
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      // Single touch - handle swipe or pan
      if (isPanning && scale > 1) {
        // Handle panning when zoomed in
        e.preventDefault();
        e.stopPropagation();
        const deltaX = e.touches[0].clientX - lastPanX;
        const deltaY = e.touches[0].clientY - lastPanY;
        
        // Basic pan movement with reduced sensitivity
        setPanX(prevPanX => prevPanX + deltaX * 0.5);
        setPanY(prevPanY => prevPanY + deltaY * 0.5);
        
        setLastPanX(e.touches[0].clientX);
        setLastPanY(e.touches[0].clientY);
      } else {
        // Handle swipe for navigation
        setTouchEnd({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
      }
    } else if (e.touches.length === 2 && fileType === 'image') {
      // Two touches - handle pinch zoom
      e.preventDefault();
      e.stopPropagation();
      setIsPanning(false);
      const distance = getDistance(e.touches[0], e.touches[1]);
      
      if (lastDistance !== null) {
        const scaleChange = distance / lastDistance;
        setScale(prevScale => {
          const newScale = prevScale * scaleChange;
          // Limit zoom between 1x (normal size) and 3x
          return Math.min(Math.max(newScale, 1), 3);
        });
      }
      setLastDistance(distance);
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart && touchEnd && e.touches.length === 0) {
      // Only handle swipe if we're not zoomed in and not panning
      if (scale === 1 && !isPanning) {
        const deltaX = touchEnd.x - touchStart.x;
        const deltaY = touchEnd.y - touchStart.y;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // Only process if swipe distance is sufficient
        if (distance > minSwipeDistance) {
          // Check if swipe is primarily vertical by comparing absolute values
          const absDeltaX = Math.abs(deltaX);
          const absDeltaY = Math.abs(deltaY);
          
          // If vertical movement is significantly greater than horizontal, treat as vertical swipe
          const isVerticalSwipe = absDeltaY > absDeltaX * 2.7; // ~20 degree tolerance
          
          if (isVerticalSwipe) {
            // Handle vertical swipes to close lightbox
            onClose();
          } else {
            // Handle horizontal swipes for navigation
            const isLeftSwipe = deltaX > minSwipeDistance;
            const isRightSwipe = deltaX < -minSwipeDistance;
            
            if (isLeftSwipe && hasPrevious && onPrevious) {
              onPrevious();
            }
            else if (isRightSwipe && hasNext && onNext) {
              onNext();
            }
          }
        }
      }
    }
    
    // Reset touch states
    setTouchStart(null);
    setTouchEnd(null);
    setLastDistance(null);
    setIsPanning(false);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };


  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ touchAction: 'none' }}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70" 
        onClick={handleBackdropClick}
      />
      
        {/* Content Container */}
        <div 
          className="relative w-screen h-screen z-10"
          onClick={(e) => e.stopPropagation()}
        >


        {/* Media Content */}
        <div 
          className="relative overflow-hidden w-screen h-screen"
          style={{ touchAction: 'none' }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {fileType === 'image' ? (
            <div className="w-full h-full flex items-center justify-center relative">
              <div 
                className="cursor-pointer"
                style={{ 
                  transform: `scale(${scale}) translate(${panX}px, ${panY}px)`,
                  transformOrigin: 'center center'
                }}
                onClick={(e) => {
                  // Only toggle controls if not zoomed in and not panning
                  if (scale === 1 && !isPanning) {
                    setShowControls(!showControls);
                  }
                }}
              >
              <NextImage
                src={publicUrl}
                alt={title || 'image'}
                width={1200}
                height={800}
                className="object-contain"
                style={{ width: '100vw', height: '100vh', objectFit: 'contain' }}
                quality={95}
                priority
                placeholder="blur"
                blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
              />
              </div>
              
              {/* Navigation Controls Overlay - Positioned relative to viewport */}
              {showControls && (
                <>
                  {/* Close Button */}
                  <button
                    onClick={onClose}
                    className="fixed top-4 right-4 z-30 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  
                  {/* Left Arrow */}
                  {hasPrevious && onPrevious && (
                    <button
                      onClick={onPrevious}
                      className="fixed left-4 top-1/2 transform -translate-y-1/2 z-30 bg-black/50 hover:bg-black/70 text-white rounded-full p-3 transition-colors"
                    >
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                  )}
                  
                  {/* Right Arrow */}
                  {hasNext && onNext && (
                    <button
                      onClick={onNext}
                      className="fixed right-4 top-1/2 transform -translate-y-1/2 z-30 bg-black/50 hover:bg-black/70 text-white rounded-full p-3 transition-colors"
                    >
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center relative">
              <video
                src={publicUrl}
                controls
                muted
                playsInline
                preload="metadata"
                className="rounded"
                style={{ width: '100vw', height: '100vh', objectFit: 'contain' }}
                onClick={(e) => {
                  // Only toggle controls if not zoomed in and not panning
                  if (scale === 1 && !isPanning) {
                    setShowControls(!showControls);
                  }
                }}
              >
                Your browser does not support the video tag.
              </video>
              
              {/* Navigation Controls Overlay for Video - Positioned relative to viewport */}
              {showControls && (
                <>
                  {/* Close Button */}
                  <button
                    onClick={onClose}
                    className="fixed top-4 right-4 z-30 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  
                  {/* Left Arrow */}
                  {hasPrevious && onPrevious && (
                    <button
                      onClick={onPrevious}
                      className="fixed left-4 top-1/2 transform -translate-y-1/2 z-30 bg-black/50 hover:bg-black/70 text-white rounded-full p-3 transition-colors"
                    >
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                  )}
                  
                  {/* Right Arrow */}
                  {hasNext && onNext && (
                    <button
                      onClick={onNext}
                      className="fixed right-4 top-1/2 transform -translate-y-1/2 z-30 bg-black/50 hover:bg-black/70 text-white rounded-full p-3 transition-colors"
                    >
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}