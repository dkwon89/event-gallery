'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from './Toast';
import InstallPrompt from './InstallPrompt';

interface SignInScreenProps {
  onSignInSuccess: (userId: string) => void;
  onBackToAuth: () => void;
  onSwitchToSignUp: () => void;
  onToggleMenu?: () => void;
}

export default function SignInScreen({ onSignInSuccess, onBackToAuth, onSwitchToSignUp, onToggleMenu }: SignInScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { showToast } = useToast();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    setIsLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password,
      });

      if (signInError) {
        throw signInError;
      }

      if (data.user) {
        showToast('Welcome back!');
        onSignInSuccess(data.user.id);
      }
    } catch (err: any) {
      console.error('Sign in error:', err);
      let errorMessage = 'Failed to sign in. Please try again.';
      
      if (err.message?.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password. Please try again.';
      } else if (err.message?.includes('Email not confirmed')) {
        errorMessage = 'Please check your email and click the confirmation link before signing in.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

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
                onBackToAuth();
                setIsMenuOpen(false);
              }}
              className="btn btn-secondary w-full h-11"
            >
              Continue as Guest
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
        </div>

        <div className="max-w-md mx-auto">
          <div className="card p-8">
            <div className="mb-6">
          <button
            onClick={onBackToAuth}
            className="btn-ghost text-primary hover:text-primary/80 text-body-sm font-medium mb-4 inline-flex items-center"
          >
            ← Continue as Guest
          </button>
          <h1 className="text-h2 text-foreground mb-2">Sign In</h1>
          <p className="text-body text-muted-foreground">
            Welcome back! Sign in to access your hashtags.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-body-sm font-medium text-foreground mb-2">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="input"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-body-sm font-medium text-foreground mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="input"
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
              <p className="text-destructive text-body-sm text-center">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !email || !password}
            className="btn btn-primary w-full"
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-body-sm text-muted-foreground">
            Don't have an account?{' '}
            <button
              onClick={onSwitchToSignUp}
              className="text-primary hover:text-primary/80 font-medium"
            >
              Sign up here
            </button>
          </p>
        </div>
          </div>
        </div>
      </div>
    </div>
  );
}
