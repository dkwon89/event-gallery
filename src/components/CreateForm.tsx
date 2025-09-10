'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface CreateFormProps {
  onCreate: () => void;
}

export default function CreateForm({ onCreate }: CreateFormProps) {
  const [eventName, setEventName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availabilityStatus, setAvailabilityStatus] = useState<'checking' | 'available' | 'taken' | null>(null);
  const [showPopup, setShowPopup] = useState(false);

  const checkHashtagAvailability = async (hashtag: string) => {
    if (!hashtag || hashtag.length < 2) {
      setAvailabilityStatus(null);
      setShowPopup(false);
      return;
    }

    setAvailabilityStatus('checking');
    setShowPopup(true);

    try {
      // Sanitize hashtag for path (remove # and other special chars)
      const safeHashtag = hashtag.replace(/[^a-zA-Z0-9-_]/g, '');
      
      console.log('Checking availability for hashtag:', safeHashtag);
      
      // Check if the hashtag marker file exists
      const { data: markerData, error: markerError } = await supabase.storage
        .from('media')
        .download(`${safeHashtag}/.hashtag_marker`);
      
      console.log('Marker check result:', { markerData, markerError });
      
      if (markerError || !markerData) {
        // Marker file doesn't exist, check if there are any files in the folder
        const { data, error } = await supabase.storage
          .from('media')
          .list(safeHashtag, { limit: 1 });
        
        console.log('Folder list result:', { data, error });
        
        if (error || !data || data.length === 0) {
          // No marker file and no other files - hashtag is available
          console.log('Hashtag is available');
          setAvailabilityStatus('available');
        } else {
          // No marker file but other files exist - hashtag is taken
          console.log('Hashtag is taken (has files)');
          setAvailabilityStatus('taken');
        }
      } else {
        // Marker file exists - hashtag is taken
        console.log('Hashtag is taken (has marker)');
        setAvailabilityStatus('taken');
      }
    } catch (err) {
      console.error('Error checking hashtag availability:', err);
      setAvailabilityStatus('available'); // Default to available on error
    }
  };

  const handleEventNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // If user is typing and value doesn't start with #, add it
    if (value && !value.startsWith('#')) {
      setEventName('#' + value);
    } else {
      setEventName(value);
    }
  };

  // Debounced availability check
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (eventName.trim()) {
        checkHashtagAvailability(eventName.trim());
      } else {
        setAvailabilityStatus(null);
        setShowPopup(false);
      }
    }, 500); // 500ms delay

    return () => clearTimeout(timeoutId);
  }, [eventName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!eventName.trim()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Sanitize hashtag for path (remove # and other special chars)
      const safeHashtag = eventName.replace(/[^a-zA-Z0-9-_]/g, '');
      
      console.log('Creating hashtag:', safeHashtag);
      
      // Create a marker file to indicate this hashtag has been created
      const markerContent = JSON.stringify({
        created: new Date().toISOString(),
        type: 'hashtag_marker'
      });
      
      console.log('Uploading marker file:', `${safeHashtag}/.hashtag_marker`);
      
      const { error: markerError } = await supabase.storage
        .from('media')
        .upload(`${safeHashtag}/.hashtag_marker`, markerContent, {
          contentType: 'application/json',
          upsert: false
        });

      if (markerError) {
        console.error('Error creating hashtag marker:', markerError);
        // Continue anyway, the hashtag creation should still work
      } else {
        console.log('Marker file created successfully');
      }

      // Save event name to localStorage
      localStorage.setItem('eventCode', eventName.trim());
      
      // Signal parent to re-render
      onCreate();
      
    } catch (err) {
      console.error('Error creating hashtag:', err);
      // Continue with the creation process even if marker creation fails
      localStorage.setItem('eventCode', eventName.trim());
      onCreate();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <label htmlFor="eventName" className="block text-body-sm font-medium text-foreground mb-1">
            Create your Hashtag
          </label>
          <input
            type="text"
            id="eventName"
            value={eventName}
            onChange={handleEventNameChange}
            placeholder="Enter Hashtag"
            className="input w-full"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck="false"
            required
          />
          
          {/* Availability Popup */}
          {showPopup && availabilityStatus && (
            <div className="absolute top-full left-0 mt-1 z-10">
              <div className={`px-3 py-2 rounded-lg text-body-sm shadow-lg ${
                availabilityStatus === 'checking' 
                  ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                  : availabilityStatus === 'available'
                  ? 'bg-green-100 text-green-800 border border-green-200'
                  : 'bg-red-100 text-red-800 border border-red-200'
              }`}>
                {availabilityStatus === 'checking' && (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-yellow-600"></div>
                    <span>Checking availability...</span>
                  </div>
                )}
                {availabilityStatus === 'available' && (
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>This hashtag is available!</span>
                  </div>
                )}
                {availabilityStatus === 'taken' && (
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span>This hashtag already exists</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        <button
          type="submit"
          disabled={isSubmitting || !eventName.trim()}
          className="btn btn-primary w-full floating-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Creating...' : 'Create Hashtag'}
        </button>
      </form>
    </div>
  );
}
