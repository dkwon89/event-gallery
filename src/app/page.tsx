'use client';

import { useState, useEffect } from 'react';
import JoinForm from '@/components/JoinForm';
import UploaderAndGallery from '@/components/UploaderAndGallery';
import InstallPrompt from '@/components/InstallPrompt';

export default function Home() {
  const [eventCode, setEventCode] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Read from localStorage on client side
    const storedEventCode = localStorage.getItem('eventCode');
    const storedDisplayName = localStorage.getItem('displayName');
    
    setEventCode(storedEventCode);
    setDisplayName(storedDisplayName);
    setIsLoading(false);
  }, []);

  const handleJoin = () => {
    // Re-read from localStorage after form submission
    const storedEventCode = localStorage.getItem('eventCode');
    const storedDisplayName = localStorage.getItem('displayName');
    
    setEventCode(storedEventCode);
    setDisplayName(storedDisplayName);
  };

  const handleSwitchEvent = () => {
    // Clear localStorage and reset state
    localStorage.removeItem('eventCode');
    localStorage.removeItem('displayName');
    setEventCode(null);
    setDisplayName(null);
  };

  if (isLoading) {
    return (
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Event Gallery
        </h1>
        <p className="text-lg text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!eventCode || !displayName) {
    return (
      <div className="text-center">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">
            Event Gallery
          </h1>
          <InstallPrompt />
        </div>
        <JoinForm onJoin={handleJoin} />
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold text-gray-900">
          Event Gallery
        </h1>
        <InstallPrompt />
      </div>
      
      <div className="mb-6">
        <button
          onClick={handleSwitchEvent}
          className="text-sm text-blue-600 hover:text-blue-800 underline"
        >
          Switch Event
        </button>
      </div>
      
      <UploaderAndGallery />
    </div>
  );
}
