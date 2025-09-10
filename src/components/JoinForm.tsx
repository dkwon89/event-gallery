'use client';

import React, { useState } from 'react';
import { verifyHashtagWithPin, normalizeHashtag, validatePin, HashtagError } from '@/lib/hashtags';
import { supabase } from '@/lib/supabaseClient';

interface JoinFormProps {
  onJoin: () => void;
  resetTrigger?: number; // Add reset trigger prop
}

export default function JoinForm({ onJoin, resetTrigger }: JoinFormProps) {
  const [eventCode, setEventCode] = useState('');
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPinStep, setShowPinStep] = useState(false);
  const [pinAnimate, setPinAnimate] = useState(false);

  // Reset form when resetTrigger changes
  React.useEffect(() => {
    if (resetTrigger !== undefined) {
      setEventCode('');
      setPin('');
      setError(null);
      setIsSubmitting(false);
      setShowPinStep(false);
      setPinAnimate(false);
    }
  }, [resetTrigger]);

  const handleEventCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    
    // Remove any spaces from the input
    value = value.replace(/\s/g, '');
    
    // If user is typing and value doesn't start with #, add it
    if (value && !value.startsWith('#')) {
      setEventCode('#' + value);
    } else {
      setEventCode(value);
    }
    
    // Reset PIN step when hashtag changes
    setShowPinStep(false);
    setPinAnimate(false);
    
    // Clear error when user starts typing
    if (error) {
      setError(null);
    }
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Only allow digits and limit to 4 characters
    const digitsOnly = value.replace(/\D/g, '').slice(0, 4);
    setPin(digitsOnly);
    
    // Clear error when user starts typing
    if (error) {
      setError(null);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!eventCode.trim()) {
      setError('Please enter a hashtag');
      return;
    }

    // If PIN step is not shown yet, show it
    if (!showPinStep) {
      setShowPinStep(true);
      setError(null);
      // Trigger animation after a delay
      setTimeout(() => {
        setPinAnimate(true);
      }, 100);
      return;
    }

    // If PIN step is shown, proceed with joining
    if (!pin || !validatePin(pin)) {
      setError('Please enter a 4-digit PIN');
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
      
      // Verify the hashtag with PIN
      console.log('Verifying hashtag with PIN...');
      
      // Add timeout for mobile devices (they can be slower)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), isMobile ? 15000 : 10000);
      });
      
      const hashtagVerifyPromise = verifyHashtagWithPin(normalizedCode, pin);
      
      const isValid = await Promise.race([hashtagVerifyPromise, timeoutPromise]) as boolean;
      console.log('Hashtag verification result:', isValid);
      
      if (!isValid) {
        setError('Invalid hashtag or PIN. Please check both and try again.');
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
    <div className="card p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="eventCode" className="block text-body-sm font-medium text-foreground mb-2">
            Join Hashtag
          </label>
          <input
            type="text"
            id="eventCode"
            value={eventCode}
            onChange={handleEventCodeChange}
            placeholder="Enter Hashtag"
            className="input"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck="false"
            required
          />
        </div>

        {showPinStep && (
          <div className={`fade-in-slow ${pinAnimate ? 'animate' : ''}`}>
            <label htmlFor="pin" className="block text-body-sm font-medium text-foreground mb-2">
              Enter the 4-digit PIN
            </label>
            <input
              type="text"
              id="pin"
              value={pin}
              onChange={handlePinChange}
              placeholder="Enter PIN"
              maxLength={4}
              className="input"
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck="false"
              required
            />
            <p className="mt-2 text-caption text-muted-foreground">
              Ask the hashtag creator for the PIN.
            </p>
          </div>
        )}
        
        <button
          type="submit"
          disabled={isSubmitting || !eventCode.trim() || (showPinStep && (!pin || !validatePin(pin)))}
          className="btn btn-primary w-full h-11"
        >
          {isSubmitting ? 'Joining...' : showPinStep ? 'Join Hashtag' : 'Continue'}
        </button>
      </form>

      {error && (
        <div className="mt-4 bg-destructive/10 border border-destructive/20 rounded-md p-3">
          <p className="text-destructive text-body-sm text-center">{error}</p>
        </div>
      )}
    </div>
  );
}
