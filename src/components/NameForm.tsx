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
    <div className="card p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="displayName" className="block text-body-sm font-medium text-foreground mb-2">
            What's your name?
          </label>
          <input
            type="text"
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Enter your name"
            className="input w-full"
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
            className="btn btn-secondary flex-1 h-11"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !displayName.trim()}
            className="btn btn-primary flex-1 h-11"
          >
            {isSubmitting ? 'Joining...' : 'Join'}
          </button>
        </div>
      </form>
    </div>
  );
}
