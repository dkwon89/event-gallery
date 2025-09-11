'use client';

import { useState } from 'react';

interface NameFormProps {
  onComplete: () => void;
  onBack: () => void;
  eventCode?: string | null;
}

export default function NameForm({ onComplete, onBack, eventCode }: NameFormProps) {
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    <div className="min-h-screen bg-white relative">
      {/* Logo in upper left corner */}
      <div className="fixed top-4 left-4 z-30">
        <button
          onClick={() => {
            window.location.href = '/';
          }}
          className="cursor-pointer hover:opacity-80 transition-opacity"
        >
          <img 
            src="/hashtag logo text.png" 
            alt="Hashtag Logo" 
            className="h-[33px] object-contain"
          />
        </button>
      </div>
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          {/* Joining Text */}
          <div className="text-center pt-20 pb-4 mb-4">
            <h1 className="text-2xl font-semibold text-foreground">
              Joining {eventCode ? `#${eventCode}` : 'event'}
            </h1>
          </div>
          
          <div className="card p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="displayName" className="block text-body-sm font-medium text-foreground mb-2">
            What&apos;s your name?
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
        </div>
      </div>
    </div>
  );
}
