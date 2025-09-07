'use client';

import { useEffect, useState, useRef } from 'react';

interface LightboxModalProps {
  open: boolean;
  onClose: () => void;
  fileType: 'image' | 'video';
  publicUrl: string;
  title?: string;
}

export default function LightboxModal({ 
  open, 
  onClose, 
  fileType, 
  publicUrl, 
  title 
}: LightboxModalProps) {
  const [zoomed, setZoomed] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      // Focus close button for accessibility
      setTimeout(() => closeButtonRef.current?.focus(), 100);
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

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleImageClick = () => {
    if (fileType === 'image') {
      setZoomed(!zoomed);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" />
      
      {/* Content Container */}
      <div className="relative max-w-[90vw] max-h-[85vh] mx-auto my-6">
        {/* Close Button */}
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-white hover:text-gray-300 transition-colors bg-black/50 rounded-full p-2 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
          aria-label="Close"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Download Button */}
        <a
          href={publicUrl}
          download={title || 'file'}
          className="absolute top-4 right-16 z-10 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
        >
          Download
        </a>

        {/* Media Content */}
        <div className="relative">
          {fileType === 'image' ? (
            <img
              src={publicUrl}
              alt={title || 'image'}
              onClick={handleImageClick}
              className={`max-h-[80vh] max-w-full object-contain transition-transform duration-200 ${
                zoomed ? 'scale-150 cursor-zoom-out' : 'scale-100 cursor-zoom-in'
              }`}
            />
          ) : (
            <video
              src={publicUrl}
              controls
              playsInline
              className="max-h-[80vh] max-w-full rounded"
            >
              Your browser does not support the video tag.
            </video>
          )}
        </div>

        {/* Instructions */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm opacity-75 bg-black/50 px-3 py-1 rounded">
          {fileType === 'image' 
            ? `Esc to close • Click image to ${zoomed ? 'zoom out' : 'zoom in'}`
            : 'Esc to close • Use controls to play/pause'
          }
        </div>
      </div>
    </div>
  );
}