'use client';

import { useState, useEffect, useCallback } from 'react';
import JoinForm from '@/components/JoinForm';
import NameForm from '@/components/NameForm';
import UploaderAndGallery from '@/components/UploaderAndGallery';
import InstallPrompt from '@/components/InstallPrompt';
import ConfigError from '@/components/ConfigError';
import SignUpScreen from '@/components/SignUpScreen';
import SignInScreen from '@/components/SignInScreen';
import { normalizeHashtag, createHashtag, hashtagExists, validatePin, HashtagError } from '@/lib/hashtags';
import { hasValidSupabaseConfig, supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/Toast';

export default function Home() {
  const [eventCode, setEventCode] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'initial' | 'signup' | 'signin' | 'guest' | 'authenticated'>('signin');
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState<'event' | 'name' | 'complete'>('event');
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [resetTrigger, setResetTrigger] = useState(0);
  // isValidEventCode state removed - now handling validation silently
  
  // Create form state
  const [hashtag, setHashtag] = useState('');
  const [normalized, setNormalized] = useState('');
  const [pin, setPin] = useState('');
  const [availability, setAvailability] = useState<'checking' | 'available' | 'taken' | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showPinStep, setShowPinStep] = useState(false);
  const [pinAnimate, setPinAnimate] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { showToast } = useToast();

  // Smooth scroll to top function
  const smoothScrollToTop = () => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth'
    });
  };

  // Scroll to top whenever step changes with smooth animation
  useEffect(() => {
    smoothScrollToTop();
  }, [step]);

  // Scroll to top when auth mode changes
  useEffect(() => {
    smoothScrollToTop();
  }, [authMode]);


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
    let value = e.target.value;
    
    // Remove any spaces from the input
    value = value.replace(/\s/g, '');
    
    // If user is typing and value doesn't start with #, add it
    if (value && !value.startsWith('#')) {
      setHashtag('#' + value);
    } else {
      setHashtag(value);
    }
    
    // Reset PIN step when hashtag changes
    setShowPinStep(false);
    setPinAnimate(false);
    
    // Update normalized version for validation
    updateNormalized(value);
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Only allow digits and limit to 4 characters
    const digitsOnly = value.replace(/\D/g, '').slice(0, 4);
    setPin(digitsOnly);
    
    // Clear error when user starts typing
    if (createError) {
      setCreateError(null);
    }
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

    if (availability === 'checking') {
      setCreateError('Please wait while we check availability');
      return;
    }

    // If PIN step is not shown yet, show it
    if (!showPinStep) {
      if (availability === 'available') {
        setShowPinStep(true);
        setCreateError(null);
        // Trigger animation after a delay
        setTimeout(() => {
          setPinAnimate(true);
        }, 100);
        return;
      } else {
        setCreateError('Please wait for availability check to complete');
        return;
      }
    }

    // If PIN step is shown, proceed with creation
    if (!pin || !validatePin(pin)) {
      setCreateError('Please enter a 4-digit PIN');
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const result = await createHashtag(normalized, pin);
      console.log('Hashtag created successfully:', result.code, 'with PIN:', result.pin);
      showToast(`Hashtag created successfully! PIN: ${result.pin}`);
      
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

  // Initialize app state from localStorage on page load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedEventCode = localStorage.getItem('eventCode');
        const storedDisplayName = localStorage.getItem('displayName');
        
        console.log('Restoring state from localStorage:', { storedEventCode, storedDisplayName });
        
        if (storedEventCode && storedDisplayName) {
          // User has both event and name - go to complete step
          setEventCode(storedEventCode);
          setDisplayName(storedDisplayName);
          setStep('complete');
          console.log('Restored to complete step');
        } else if (storedEventCode) {
          // User has event but no name - go to name step
          setEventCode(storedEventCode);
          setStep('name');
          console.log('Restored to name step');
        } else {
          // No stored state - start at event step
          setStep('event');
          console.log('Starting at event step');
        }
      } catch (error) {
        console.error('Error reading from localStorage on init:', error);
        setStep('event');
      }
    }
  }, []);

  useEffect(() => {
    // Set a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.log('Auth check timeout - setting loading to false');
      setIsLoading(false);
      setAuthMode('guest');
    }, 3000); // 3 second timeout

    // Check if Supabase is properly configured first
    if (!hasValidSupabaseConfig) {
      console.log('Supabase not configured, skipping auth check');
      setAuthMode('guest');
      setIsLoading(false);
      return;
    }

    // Check for existing auth session
    const checkAuthSession = async () => {
      try {
        console.log('Checking auth session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth session error:', error);
          setAuthMode('initial');
          return;
        }

        if (session?.user) {
          console.log('User found in session:', session.user.id);
          setUserId(session.user.id);
          setAuthMode('authenticated');
          
          // Try to load user's display name, but don't fail if it doesn't work
          try {
            const { data: userData } = await supabase
              .from('users')
              .select('email')
              .eq('id', session.user.id)
              .single();
            
            if (userData?.email) {
              setDisplayName(userData.email.split('@')[0]);
            } else {
              // Fallback to user email from session
              setDisplayName(session.user.email?.split('@')[0] || 'User');
            }
          } catch (userError) {
            console.log('Could not load user data, using fallback:', userError);
            setDisplayName(session.user.email?.split('@')[0] || 'User');
          }
        } else {
          console.log('No user in session');
          setAuthMode('guest');
        }
      } catch (error) {
        console.error('Error checking auth session:', error);
        setAuthMode('guest');
      } finally {
        console.log('Setting loading to false');
        clearTimeout(timeoutId);
        setIsLoading(false);
      }
    };

    checkAuthSession();

    // Cleanup timeout on unmount
    return () => clearTimeout(timeoutId);
  }, []);

  // Clear form fields when switching modes
  const clearFormFields = useCallback(() => {
    setHashtag('');
    setNormalized('');
    setPin('');
    setAvailability(null);
    setCreateError(null);
    setActiveTab('create');
    setShowPinStep(false);
    setPinAnimate(false);
    setResetTrigger(prev => prev + 1);
  }, []);

  // Add global error handler for localStorage issues
  useEffect(() => {
    const handleStorageError = (e: StorageEvent) => {
      // Handle storage events silently - only log in development
      if (process.env.NODE_ENV === 'development') {
        console.log('Storage event detected:', e.key, e.newValue);
      }
      
      // If there's a storage error, clear the data and reset
      if (e.key === 'eventCode' || e.key === 'displayName') {
        try {
          localStorage.removeItem('eventCode');
          localStorage.removeItem('displayName');
        } catch (error) {
          // Only log in development
          if (process.env.NODE_ENV === 'development') {
            console.log('Error clearing localStorage after storage event:', error);
          }
        }
        // No need to set validation state - handling silently
        setEventCode('');
        setDisplayName('');
        setStep('event');
      }
    };

    window.addEventListener('storage', handleStorageError);
    
    return () => {
      window.removeEventListener('storage', handleStorageError);
    };
  }, []);

  // Debug eventCode changes
  useEffect(() => {
    console.log('eventCode changed:', eventCode);
  }, [eventCode]);

  const handleEventJoin = () => {
    console.log('handleEventJoin called');
    // Re-read from localStorage after event form submission
    if (typeof window !== 'undefined') {
      try {
        const storedEventCode = localStorage.getItem('eventCode');
        console.log('Stored event code from localStorage:', storedEventCode);
        setEventCode(storedEventCode);
      } catch (error) {
        console.error('Error reading from localStorage in handleEventJoin:', error);
      }
    }
    console.log('Setting step to name');
    setStep('name');
  };

  const handleEventCreate = () => {
    // Re-read from localStorage after event form submission
    if (typeof window !== 'undefined') {
      try {
        const storedEventCode = localStorage.getItem('eventCode');
        setEventCode(storedEventCode);
      } catch (error) {
        console.error('Error reading from localStorage in handleEventCreate:', error);
      }
    }
    setStep('name');
    smoothScrollToTop();
  };

  const handleNameComplete = () => {
    // Re-read from localStorage after name form submission
    if (typeof window !== 'undefined') {
      try {
        const storedDisplayName = localStorage.getItem('displayName');
        setDisplayName(storedDisplayName);
      } catch (error) {
        console.error('Error reading from localStorage in handleNameComplete:', error);
      }
    }
    setStep('complete');
    smoothScrollToTop();
  };

  const handleBackToEvent = () => {
    // Go back to event step
    setStep('event');
    smoothScrollToTop();
  };

  // Authentication handlers
  const handleProceedAsGuest = useCallback(() => {
    setAuthMode('guest');
    clearFormFields();
    smoothScrollToTop();
  }, [clearFormFields]);

  const handleSignUp = useCallback(() => {
    setAuthMode('signup');
    smoothScrollToTop();
  }, []);

  const handleSignIn = useCallback(() => {
    setAuthMode('signin');
    smoothScrollToTop();
  }, []);

  const handleBackToAuth = useCallback(() => {
    setAuthMode('initial');
    smoothScrollToTop();
  }, []);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleSignUpSuccess = useCallback((newUserId: string) => {
    setUserId(newUserId);
    setAuthMode('authenticated');
    clearFormFields();
  }, [clearFormFields]);

  const handleSignInSuccess = useCallback((newUserId: string) => {
    setUserId(newUserId);
    setAuthMode('authenticated');
    clearFormFields();
  }, [clearFormFields]);

  const handleSignOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setUserId(null);
      setAuthMode('initial');
      setEventCode(null);
      setDisplayName(null);
      setStep('event');
      clearFormFields();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }, [clearFormFields]);

  const handleSwitchEvent = () => {
    // Clear localStorage and reset state
    localStorage.removeItem('eventCode');
    localStorage.removeItem('displayName');
    setEventCode(null);
    setDisplayName(null);
    setStep('event');
    
    // Clear all form fields
    clearFormFields();
    
    // Go back to guest mode
    setAuthMode('guest');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      </div>
    );
  }

  // Check if Supabase is properly configured
  if (!hasValidSupabaseConfig) {
    return <ConfigError />;
  }


  if (authMode === 'signup') {
    return (
      <SignUpScreen
        onSignUpSuccess={handleSignUpSuccess}
        onBackToAuth={handleBackToAuth}
      />
    );
  }

  if (authMode === 'signin') {
    return (
      <SignInScreen
        onSignInSuccess={handleSignInSuccess}
        onBackToAuth={handleProceedAsGuest}
        onSwitchToSignUp={handleSignUp}
      />
    );
  }

  if (step === 'event') {
    return (
      <div className="min-h-screen bg-white relative">
        {/* Hamburger Menu Button */}
        <button
          onClick={toggleMenu}
          className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-white shadow-md hover:shadow-lg transition-shadow"
        >
          <svg className="w-6 h-6 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Slide-out Menu Overlay */}
        {isMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40"
            onClick={toggleMenu}
          />
        )}

        {/* Slide-out Menu Panel */}
        <div className={`fixed top-0 left-0 h-full w-80 bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${
          isMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div className="p-6 pt-8">
            {/* Small Logo */}
            <div className="pt-8 pb-12">
              <img
                src="/hashtag logo.png"
                alt="Hashtag Logo"
                width="40"
                height="40"
              />
            </div>
            
            <div className="space-y-4">
              <button
                onClick={() => {
                  handleSignIn();
                  setIsMenuOpen(false);
                }}
                className="btn btn-primary w-full h-11"
              >
                Log In
              </button>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto">
            <div className="text-center mb-8">
              <div className="mt-8 mb-12">
                <img 
                  src="/hashtag logo.png" 
                  alt="Hashtag Logo" 
                  width="120" 
                  height="120" 
                  className="mx-auto"
                />
              </div>
              {authMode === 'authenticated' && (
                <div className="flex items-center justify-center gap-2 mb-4">
                  <span className="text-body-sm text-muted-foreground">Signed in as {displayName}</span>
                  <button
                    onClick={handleSignOut}
                    className="btn-ghost text-primary hover:text-primary/80"
                  >
                    Sign Out
                  </button>
                </div>
              )}
              <InstallPrompt />
            </div>
        
            {/* Tabs */}
            <div className="card p-2 mb-6">
              <div className="flex">
                <button
                  onClick={() => setActiveTab('create')}
                  className={`flex-1 py-3 px-4 text-body-sm font-medium rounded-lg transition-all ${
                    activeTab === 'create'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                >
                  Create
                </button>
                <button
                  onClick={() => setActiveTab('join')}
                  className={`flex-1 py-3 px-4 text-body-sm font-medium rounded-lg transition-all ${
                    activeTab === 'join'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                >
                  Join
                </button>
              </div>
            </div>
        
            {/* Tab Content */}
            {activeTab === 'create' ? (
              <div className="card p-6">
                <form onSubmit={handleCreateSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="hashtag" className="block text-body-sm font-medium text-foreground mb-2">
                      Create Hashtag
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        id="hashtag"
                        value={hashtag}
                        onChange={handleCreateInputChange}
                        placeholder="Enter Hashtag"
                        className="input w-full pr-20"
                        required
                      />
                      {availability && (
                        <div className={`absolute right-3 top-1/2 transform -translate-y-1/2 text-caption font-medium ${getAvailabilityColor()}`}>
                          {getAvailabilityText()}
                        </div>
                      )}
                    </div>
                  </div>

                  {showPinStep && (
                    <div className={`fade-in-slow ${pinAnimate ? 'animate' : ''}`}>
                      <label htmlFor="pin" className="block text-body-sm font-medium text-foreground mb-2">
                        PIN
                      </label>
                      <input
                        type="text"
                        id="pin"
                        value={pin}
                        onChange={handlePinChange}
                        placeholder="1234"
                        maxLength={4}
                        className="input"
                        required
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isCreating || !normalized || (showPinStep && (!pin || !validatePin(pin))) || availability === 'taken' || availability === 'checking'}
                    className="btn btn-primary w-full h-11"
                  >
                    {isCreating ? 'Creating...' : showPinStep ? 'Create Hashtag' : 'Continue'}
                  </button>
                </form>

                {createError && (
                  <div className="mt-4 bg-destructive/10 border border-destructive/20 rounded-md p-3">
                    <p className="text-destructive text-body-sm text-center">{createError}</p>
                  </div>
                )}

                {/* Hashtag rules - only show when not in PIN step */}
                {!showPinStep && (
                  <div className="mt-6 text-caption text-muted-foreground space-y-1">
                    <p>• 3-30 characters long</p>
                    <p>• Only letters, numbers, hyphens, and underscores</p>
                    <p>• No spaces allowed</p>
                    <p>• Will be converted to lowercase</p>
                  </div>
                )}

                {/* PIN rules - only show when in PIN step */}
                {showPinStep && (
                  <div className={`mt-6 text-caption text-muted-foreground space-y-1 fade-in-slow ${pinAnimate ? 'animate' : ''}`}>
                    <p>• PIN must be exactly 4 digits</p>
                    <p>• This PIN will be required for others to join your hashtag</p>
                  </div>
                )}
              </div>
            ) : (
              <JoinForm onJoin={handleEventJoin} resetTrigger={resetTrigger} />
            )}
          </div>
        </div>
      </div>
    );
  }

  if (step === 'name') {
    return (
      <div className="min-h-screen bg-white relative">
        {/* Hamburger Menu Button */}
        <button
          onClick={toggleMenu}
          className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-white shadow-md hover:shadow-lg transition-shadow"
        >
          <svg className="w-6 h-6 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Slide-out Menu Overlay */}
        {isMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40"
            onClick={toggleMenu}
          />
        )}

        {/* Slide-out Menu Panel */}
        <div className={`fixed top-0 left-0 h-full w-80 bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${
          isMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div className="p-6 pt-8">
            {/* Small Logo */}
            <div className="pt-8 pb-12">
              <img
                src="/hashtag logo.png"
                alt="Hashtag Logo"
                width="40"
                height="40"
              />
            </div>
            
            <div className="space-y-4">
              <button
                onClick={() => {
                  handleSignIn();
                  setIsMenuOpen(false);
                }}
                className="btn btn-primary w-full h-11"
              >
                Log In
              </button>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto">
            <div className="text-center mb-8">
              <div className="mt-8 mb-12">
                <img 
                  src="/hashtag logo.png" 
                  alt="Hashtag Logo" 
                  width="120" 
                  height="120" 
                  className="mx-auto"
                />
              </div>
              <InstallPrompt />
            </div>
            <NameForm onComplete={handleNameComplete} onBack={handleBackToEvent} eventCode={eventCode} />
          </div>
        </div>
      </div>
    );
  }

  // Note: Invalid eventCode handling is now done silently in useEffect
  // No need to show error messages to users

  // Complete step - show main app
  return (
    <div className="relative">
      {/* Hamburger Menu Button */}
      <button
        onClick={toggleMenu}
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-white shadow-md hover:shadow-lg transition-shadow"
      >
        <svg className="w-6 h-6 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Slide-out Menu Overlay */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={toggleMenu}
        />
      )}

      {/* Slide-out Menu Panel */}
      <div className={`fixed top-0 left-0 h-full w-80 bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${
        isMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-6 pt-8">
          {/* Small Logo */}
          <div className="pt-8 pb-12">
            <img 
              src="/hashtag logo.png" 
              alt="Hashtag Logo" 
              width="40" 
              height="40" 
            />
          </div>
          
          <div className="space-y-4">
            <button
              onClick={() => {
                handleSwitchEvent();
                setIsMenuOpen(false);
              }}
              className="btn btn-primary w-full h-11"
            >
              Switch Event
            </button>
            {authMode !== 'authenticated' && (
              <button
                onClick={() => {
                  handleSignUp();
                  setIsMenuOpen(false);
                }}
                className="btn btn-primary w-full h-11"
              >
                Sign Up
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="w-full">
        {/* Header Section - Centered */}
        <div className="text-center py-8 px-4">
          <div className="max-w-md mx-auto">
            <div className="mt-8 mb-8">
              <img 
                src="/hashtag logo.png" 
                alt="Hashtag Logo" 
                width="120" 
                height="120" 
                className="mx-auto"
              />
            </div>
            <h1 className="text-h3 text-foreground">
              Welcome to #{eventCode}, {displayName}!
            </h1>
            <InstallPrompt />
          </div>
        </div>

        {/* Gallery Section - Full Width */}
        <UploaderAndGallery />
      </div>
    </div>
  );
}
