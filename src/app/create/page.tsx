'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createHashtag, hashtagExists, normalizeHashtag, validatePin, HashtagError } from '@/lib/hashtags';
import { useToast } from '@/components/Toast';

export default function CreatePage() {
  const [hashtag, setHashtag] = useState('');
  const [normalized, setNormalized] = useState('');
  const [pin, setPin] = useState('');
  const [availability, setAvailability] = useState<'checking' | 'available' | 'taken' | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdCode, setCreatedCode] = useState('');
  const router = useRouter();
  const { showToast } = useToast();

  // Normalize hashtag and update normalized state
  const updateNormalized = useCallback((input: string) => {
    try {
      const normalizedCode = normalizeHashtag(input);
      setNormalized(normalizedCode);
      setError(null);
    } catch (err) {
      if (err instanceof HashtagError) {
        setNormalized('');
        setError(err.message);
      } else {
        setNormalized('');
        setError('Invalid hashtag format');
      }
    }
  }, []);

  // Check availability with debouncing
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setHashtag(value);
    updateNormalized(value);
  };

  const handleBlur = () => {
    if (hashtag.trim()) {
      updateNormalized(hashtag.trim());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!normalized) {
      setError('Please enter a valid hashtag');
      return;
    }

    if (!pin || !validatePin(pin)) {
      setError('Please enter a valid 4-digit PIN');
      return;
    }

    if (availability === 'taken') {
      setError('Already taken');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const result = await createHashtag(normalized, pin);
      setCreatedCode(result.code);
      setShowSuccess(true);
      showToast('Hashtag created successfully!');
    } catch (err) {
      console.error('Error creating hashtag:', err);
      if (err instanceof HashtagError) {
        if (err.message.includes('already taken')) {
          setError('Already taken');
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to create hashtag. Please try again.');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinNow = () => {
    localStorage.setItem('eventCode', createdCode);
    router.push('/');
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

  if (showSuccess) {
    return (
      <div className="max-w-md mx-auto text-center">
        <div className="mb-6">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Hashtag Created!
          </h1>
          <p className="text-gray-600">
            Your hashtag <span className="font-mono bg-gray-100 px-2 py-1 rounded">{createdCode}</span> is ready to use.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleJoinNow}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Join now
          </button>
          
          <button
            onClick={() => router.push('/')}
            className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Back to home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-6">
        <Link
          href="/"
          className="text-sm text-blue-600 hover:text-blue-800 underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
        >
          ← Back to home
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">
          Create a Hashtag
        </h1>
        <p className="text-gray-600 text-sm mt-1">
          Create a new hashtag for your event
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="hashtag" className="block text-sm font-medium text-gray-700 mb-1">
            Hashtag name
          </label>
          <input
            type="text"
            id="hashtag"
            value={hashtag}
            onChange={handleInputChange}
            onBlur={handleBlur}
            placeholder="my-event"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
          
          {normalized && (
            <p className="mt-1 text-xs text-gray-500">
              will be saved as: <span className="font-mono">{normalized}</span>
            </p>
          )}

          {availability && (
            <p className={`mt-1 text-xs font-medium ${getAvailabilityColor()}`}>
              {getAvailabilityText()}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="pin" className="block text-sm font-medium text-gray-700 mb-1">
            PIN (4 digits)
          </label>
          <input
            type="text"
            id="pin"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Enter PIN"
            maxLength={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isCreating || !normalized || !pin || !validatePin(pin) || availability === 'taken' || availability === 'checking'}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCreating ? 'Creating...' : 'Create Hashtag'}
        </button>
      </form>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-red-700 text-sm text-center">{error}</p>
        </div>
      )}

      <div className="mt-6 text-xs text-gray-500">
        <p>• 3-30 characters long</p>
        <p>• Only letters, numbers, hyphens, and underscores</p>
        <p>• Will be converted to lowercase</p>
      </div>
    </div>
  );
}
