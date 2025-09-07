'use client';

import { useEffect } from 'react';

export default function PWARegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Register service worker
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[PWA] Service Worker registered:', registration);
        })
        .catch((error) => {
          console.error('[PWA] Service Worker registration failed:', error);
        });

      // Listen for updates
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[PWA] Service Worker updated');
        // Optionally show a notification to reload
      });
    }
  }, []);

  return null; // This component doesn't render anything
}
