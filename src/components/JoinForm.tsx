'use client';

import { useState } from 'react';
import { hashtagExists, normalizeHashtag, HashtagError } from '@/lib/hashtags';

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
      // Normalize the hashtag code
      const normalizedCode = normalizeHashtag(eventCode.trim());
      console.log('Normalized code:', normalizedCode);
      
      // Check if the hashtag exists in the database
      console.log('Checking if hashtag exists...');
      const exists = await hashtagExists(normalizedCode);
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
      if (err instanceof HashtagError) {
        setError(err.message);
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
