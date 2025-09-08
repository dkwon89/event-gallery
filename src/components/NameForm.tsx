'use client';

import { useState } from 'react';
import { deleteHashtag } from '@/lib/hashtags';
import { useToast } from './Toast';

interface NameFormProps {
  onComplete: () => void;
  onBack: () => void;
  eventCode?: string | null;
}

export default function NameForm({ onComplete, onBack, eventCode }: NameFormProps) {
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!displayName.trim()) {
      return;
    }

    setIsSubmitting(true);
    
    // Save display name to localStorage
    localStorage.setItem('displayName', displayName.trim());
    
    // Signal parent to re-render
    onComplete();
    
    setIsSubmitting(false);
  };

  const handleBack = async () => {
    // Only clear the displayName, keep the eventCode (hashtag) intact
    localStorage.removeItem('displayName');
    
    // Call the parent's onBack function
    onBack();
  };

  return (
    <div className="max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
                     What&apos;s your name?
          </label>
          <input
            type="text"
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Enter your name"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black placeholder-gray-400"
            style={{ color: '#000000' }}
            autoCapitalize="words"
            autoCorrect="on"
            autoComplete="name"
            spellCheck="true"
            required
            autoFocus
          />
        </div>
        
        <div className="flex space-x-3">
          <button
            type="button"
            onClick={handleBack}
            className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !displayName.trim()}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Joining...' : 'Join'}
          </button>
        </div>
      </form>
    </div>
  );
}
