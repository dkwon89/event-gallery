'use client';

import { useState } from 'react';
import { hashtagExists, normalizeHashtag, HashtagError } from '@/lib/hashtags';
import { supabase } from '@/lib/supabaseClient';

interface JoinFormProps {
  onJoin: () => void;
}

export default function JoinForm({ onJoin }: JoinFormProps) {
  const [eventCode, setEventCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEventCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // If user is typing and value doesn't start with #, add it
    if (value && !value.startsWith('#')) {
      setEventCode('#' + value);
    } else {
      setEventCode(value);
    }
    
    // Clear error when user starts typing
    if (error) {
      setError(null);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!eventCode.trim()) {
      return;
    }

    console.log('Join form submitted with eventCode:', eventCode);
    setIsSubmitting(true);
    setError(null);

    try {
      // Check if we're in a browser environment
      if (typeof window === 'undefined') {
        setError('Please try again in a moment.');
        setIsSubmitting(false);
        return;
      }

      // Mobile-specific debugging
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      console.log('Device type:', isMobile ? 'Mobile' : 'Desktop');
      console.log('User agent:', navigator.userAgent);
      console.log('Online status:', navigator.onLine);
      
      // Test Supabase connection first
      console.log('Testing Supabase connection...');
      try {
        const { data: testData, error: testError } = await supabase
          .from('hashtags')
          .select('count')
          .limit(1);
        
        if (testError) {
          console.error('Supabase connection test failed:', testError);
          if (isMobile) {
            setError('Mobile connection issue. Please check your WiFi/cellular data and try again.');
          } else {
            setError('Unable to connect to the database. Please try again later.');
          }
          setIsSubmitting(false);
          return;
        }
        console.log('Supabase connection test passed');
      } catch (connectionError) {
        console.error('Supabase connection error:', connectionError);
        if (isMobile) {
          setError('Mobile network error. Please check your connection and try again.');
        } else {
          setError('Unable to connect to the server. Please check your internet connection.');
        }
        setIsSubmitting(false);
        return;
      }

      // Normalize the hashtag code
      const normalizedCode = normalizeHashtag(eventCode.trim());
      console.log('Normalized code:', normalizedCode);
      
      // Check if the hashtag exists in the database
      console.log('Checking if hashtag exists...');
      
      // Add timeout for mobile devices (they can be slower)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), isMobile ? 15000 : 10000);
      });
      
      const hashtagCheckPromise = hashtagExists(normalizedCode);
      
      const exists = await Promise.race([hashtagCheckPromise, timeoutPromise]) as boolean;
      console.log('Hashtag exists:', exists);
      
      if (!exists) {
        setError('This Hashtag doesn\'t exist. Check the spelling or create it first.');
        setIsSubmitting(false);
        return;
      }

      // Save normalized event code to localStorage
      console.log('Saving to localStorage:', normalizedCode);
      localStorage.setItem('eventCode', normalizedCode);
      
      // Signal parent to re-render
      console.log('Calling onJoin()');
      onJoin();
      
    } catch (err) {
      console.error('Error checking hashtag:', err);
      
      // More specific error handling with mobile considerations
      if (err instanceof HashtagError) {
        setError(err.message);
      } else if (err instanceof Error) {
        if (err.message.includes('Request timeout')) {
          setError('Request timed out. Please check your connection and try again.');
        } else if (err.message.includes('fetch')) {
          setError('Network error. Please check your WiFi/cellular data and try again.');
        } else if (err.message.includes('Failed to fetch')) {
          setError('Unable to connect to the server. Please check your internet connection.');
        } else if (err.message.includes('NetworkError')) {
          setError('Network error. Please check your connection and try again.');
        } else if (err.message.includes('CORS')) {
          setError('Connection blocked. Please try refreshing the page.');
        } else {
          setError(`Error: ${err.message}`);
        }
      } else {
        setError('Unable to verify hashtag. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="eventCode" className="block text-sm font-medium text-gray-700 mb-1">
            Enter the hashtag you want to join
          </label>
          <input
            type="text"
            id="eventCode"
            value={eventCode}
            onChange={handleEventCodeChange}
            placeholder="Enter Hashtag"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black placeholder-gray-400"
            style={{ color: '#000000' }}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck="false"
            required
          />
          <p className="mt-1 text-xs text-gray-500">
            Only existing Hashtags can be joined.
          </p>
        </div>
        
        <button
          type="submit"
          disabled={isSubmitting || !eventCode.trim()}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Joining...' : 'Join Hashtag'}
        </button>
      </form>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-red-700 text-sm text-center">{error}</p>
        </div>
      )}
    </div>
  );
}
