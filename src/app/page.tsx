'use client';

import { useState, useEffect, useCallback } from 'react';
import JoinForm from '@/components/JoinForm';
import NameForm from '@/components/NameForm';
import UploaderAndGallery from '@/components/UploaderAndGallery';
import InstallPrompt from '@/components/InstallPrompt';
import ConfigError from '@/components/ConfigError';
import { normalizeHashtag, createHashtag, hashtagExists, HashtagError } from '@/lib/hashtags';
import { hasValidSupabaseConfig } from '@/lib/supabaseClient';
import { useToast } from '@/components/Toast';

export default function Home() {
  const [eventCode, setEventCode] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [step, setStep] = useState<'event' | 'name' | 'complete'>('event');
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('join');
  const [isValidEventCode, setIsValidEventCode] = useState(true);
  
  // Create form state
  const [hashtag, setHashtag] = useState('');
  const [normalized, setNormalized] = useState('');
  const [availability, setAvailability] = useState<'checking' | 'available' | 'taken' | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const { showToast } = useToast();

  const validateEventCode = (code: string | null): boolean => {
    if (!code) {
      console.log('validateEventCode: no code provided');
      return false;
    }
    
    // Additional checks for common corruption issues
    if (code === 'null' || code === 'undefined' || code === '') {
      console.log('validateEventCode: invalid code value:', code);
      return false;
    }
    
    try {
      // Use the same normalization logic as the rest of the app
      const normalized = normalizeHashtag(code);
      console.log('validateEventCode: validation passed for:', code, 'normalized to:', normalized);
      return true;
    } catch (err) {
      console.log('validateEventCode: validation failed for:', code, 'error:', err);
      return false;
    }
  };

  // Create form functions
  const updateNormalized = useCallback((input: string) => {
    try {
      const normalizedCode = normalizeHashtag(input);
      setNormalized(normalizedCode);
      setCreateError(null);
    } catch (err) {
      if (err instanceof HashtagError) {
        setNormalized('');
        setCreateError(err.message);
      } else {
        setNormalized('');
        setCreateError('Invalid hashtag format');
      }
    }
  }, []);

  const checkAvailability = useCallback(async (code: string) => {
    if (!code || code.length < 3) {
      setAvailability(null);
      return;
    }

    setAvailability('checking');

    try {
      const exists = await hashtagExists(code);
      setAvailability(exists ? 'taken' : 'available');
    } catch (err) {
      console.error('Error checking availability:', err);
      setAvailability(null);
    }
  }, []);

  // Debounced availability check
  useEffect(() => {
    if (!normalized) {
      setAvailability(null);
      return;
    }

    const timeoutId = setTimeout(() => {
      checkAvailability(normalized);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [normalized, checkAvailability]);

  const handleCreateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // If user is typing and value doesn't start with #, add it
    if (value && !value.startsWith('#')) {
      setHashtag('#' + value);
    } else {
      setHashtag(value);
    }
    
    // Update normalized version for validation
    updateNormalized(value);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!normalized) {
      setCreateError('Hashtag is required');
      return;
    }

    if (availability === 'taken') {
      setCreateError('Already taken');
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const result = await createHashtag(normalized);
      console.log('Hashtag created successfully:', result.code);
      showToast('Hashtag created successfully!');
      
      // Save normalized event code to localStorage
      localStorage.setItem('eventCode', result.code);
      console.log('Saved to localStorage:', result.code);
      
      // Signal parent to re-render
      handleEventCreate();
    } catch (err) {
      console.error('Error creating hashtag:', err);
      if (err instanceof HashtagError) {
        if (err.message.includes('already taken')) {
          setCreateError('Already taken');
        } else {
          setCreateError(err.message);
        }
      } else {
        setCreateError('Failed to create hashtag. Please try again.');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const getAvailabilityColor = () => {
    switch (availability) {
      case 'checking':
        return 'text-yellow-600';
      case 'available':
        return 'text-green-600';
      case 'taken':
        return 'text-red-600';
      default:
        return 'text-gray-500';
    }
  };

  const getAvailabilityText = () => {
    switch (availability) {
      case 'checking':
        return 'Checking availability...';
      case 'available':
        return 'Available';
      case 'taken':
        return 'Already taken';
      default:
        return '';
    }
  };

  useEffect(() => {
    // Read from localStorage on client side
    const storedEventCode = localStorage.getItem('eventCode');
    const storedDisplayName = localStorage.getItem('displayName');
    
    console.log('Loaded from localStorage:', { storedEventCode, storedDisplayName });
    
    // Validate eventCode
    const isValid = validateEventCode(storedEventCode);
    console.log('Event code validation result:', { storedEventCode, isValid });
    
    // If validation fails, clear the corrupted data
    if (storedEventCode && !isValid) {
      console.log('Clearing corrupted event code from localStorage');
      localStorage.removeItem('eventCode');
      localStorage.removeItem('displayName');
      setIsValidEventCode(false);
      setEventCode('');
      setDisplayName('');
      setStep('event');
    } else {
      setIsValidEventCode(isValid);
      setEventCode(storedEventCode);
      setDisplayName(storedDisplayName);
      
      // Determine current step based on localStorage
      if (storedEventCode && storedDisplayName && isValid) {
        setStep('complete');
      } else if (storedEventCode && isValid) {
        setStep('name');
      } else {
        setStep('event');
      }
    }
    
    setIsLoading(false);
  }, []);

  // Debug eventCode changes
  useEffect(() => {
    console.log('eventCode changed:', eventCode);
  }, [eventCode]);

  const handleEventJoin = () => {
    // Re-read from localStorage after event form submission
    const storedEventCode = localStorage.getItem('eventCode');
    setEventCode(storedEventCode);
    setStep('name');
  };

  const handleEventCreate = () => {
    // Re-read from localStorage after event form submission
    const storedEventCode = localStorage.getItem('eventCode');
    setEventCode(storedEventCode);
    setStep('name');
  };

  const handleNameComplete = () => {
    // Re-read from localStorage after name form submission
    const storedDisplayName = localStorage.getItem('displayName');
    setDisplayName(storedDisplayName);
    setStep('complete');
  };

  const handleBackToEvent = () => {
    // Go back to event step
    setStep('event');
  };

  const handleSwitchEvent = () => {
    // Clear localStorage and reset state
    localStorage.removeItem('eventCode');
    localStorage.removeItem('displayName');
    setEventCode(null);
    setDisplayName(null);
    setStep('event');
  };

  if (isLoading) {
    return (
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to Hashtag.
        </h1>
        <p className="text-lg text-gray-600">Loading...</p>
      </div>
    );
  }

  // Check if Supabase is properly configured
  if (!hasValidSupabaseConfig) {
    return <ConfigError />;
  }

  if (step === 'event') {
    return (
      <div className="text-center">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">
            Welcome to Hashtag.
          </h1>
          <InstallPrompt />
        </div>
        
        {/* Tabs */}
        <div className="flex mb-8 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'create'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Create
          </button>
          <button
            onClick={() => setActiveTab('join')}
            className={`flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'join'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Join
          </button>
        </div>
        
        {/* Tab Content */}
        {activeTab === 'create' ? (
          <div className="max-w-md mx-auto">
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label htmlFor="hashtag" className="block text-sm font-medium text-gray-700 mb-1">
                  Hashtag name
                </label>
                <input
                  type="text"
                  id="hashtag"
                  value={hashtag}
                  onChange={handleCreateInputChange}
                  placeholder="Enter Hashtag"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black placeholder-gray-400"
                  style={{ color: '#000000' }}
                  required
                />

                {availability && (
                  <p className={`mt-1 text-xs font-medium ${getAvailabilityColor()}`}>
                    {getAvailabilityText()}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isCreating || !normalized || availability === 'taken' || availability === 'checking'}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? 'Creating...' : 'Create Hashtag'}
              </button>
            </form>

            {createError && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-red-700 text-sm text-center">{createError}</p>
              </div>
            )}

            <div className="mt-6 text-xs text-gray-500">
              <p>• 3-30 characters long</p>
              <p>• Only letters, numbers, hyphens, and underscores</p>
              <p>• Will be converted to lowercase</p>
            </div>
          </div>
        ) : (
          <JoinForm onJoin={handleEventJoin} />
        )}
      </div>
    );
  }

  if (step === 'name') {
    return (
      <div className="text-center">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">
            Welcome to Hashtag.
          </h1>
          <InstallPrompt />
        </div>
        <NameForm onComplete={handleNameComplete} onBack={handleBackToEvent} eventCode={eventCode} />
      </div>
    );
  }

  // Guard for invalid eventCode
  if (step === 'complete' && !isValidEventCode) {
    return (
      <div className="text-center">
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to Hashtag.
          </h1>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md mx-auto">
            <p className="text-yellow-800 text-sm mb-3">
              The stored event code is invalid or corrupted.
            </p>
            <button
              onClick={handleSwitchEvent}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Join a new event
            </button>
          </div>
        </div>
        <InstallPrompt />
      </div>
    );
  }

  // Complete step - show main app
  return (
    <div className="text-center">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">
            Welcome to #{eventCode}, {displayName}!
          </h1>
        </div>
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
