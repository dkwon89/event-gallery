'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from './Toast';

interface SignUpScreenProps {
  onSignUpSuccess: (userId: string) => void;
  onBackToAuth: () => void;
}

export default function SignUpScreen({ onSignUpSuccess, onBackToAuth }: SignUpScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!email || !password || !confirmPassword) {
      setError('All fields are required');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    // More comprehensive email validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      console.log('Starting signup process...');
      
      // Sign up with Supabase Auth
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password,
      });

      console.log('Auth signup result:', { data, error: signUpError });

      if (signUpError) {
        console.error('Auth signup error:', signUpError);
        
        // Handle specific email validation errors
        if (signUpError.message?.includes('Invalid email')) {
          setError('Please enter a valid email address. Make sure it contains @ and a valid domain.');
          return;
        }
        
        throw signUpError;
      }

      if (data.user) {
        console.log('User created in auth:', data.user.id, data.user.email);
        
        // Try to create user profile, but don't fail if it doesn't work
        console.log('Creating user profile...');
        try {
          const { data: profileData, error: profileError } = await supabase
            .from('users')
            .insert({
              id: data.user.id,
              email: data.user.email,
              created_at: new Date().toISOString(),
              last_active: new Date().toISOString()
            })
            .select();

          if (profileError) {
            console.warn('Profile creation failed, but continuing:', profileError);
            // Don't fail the signup, just log the warning
          } else {
            console.log('User profile created successfully:', profileData);
          }
        } catch (profileError) {
          console.warn('Profile creation failed, but continuing:', profileError);
          // Don't fail the signup, just log the warning
        }

        showToast('Account created successfully! Please check your email to verify your account.');
        onSignUpSuccess(data.user.id);
      } else {
        console.log('No user data returned from auth signup');
        setError('Account creation failed - no user data returned');
      }
    } catch (err: unknown) {
      console.error('Sign up error:', err);
      let errorMessage = 'Failed to create account. Please try again.';
      
      if (err && typeof err === 'object' && 'message' in err) {
        const error = err as { message: string };
        if (error.message.includes('already registered') || error.message.includes('already been registered')) {
          errorMessage = 'An account with this email already exists. Please sign in instead.';
        } else if (error.message.includes('Invalid email') || (error.message.includes('email address') && error.message.includes('invalid'))) {
          errorMessage = 'Please enter a valid email address. Make sure it contains @ and a valid domain.';
        } else if (error.message.includes('Password should be at least')) {
          errorMessage = 'Password must be at least 6 characters long.';
        } else if (error.message.includes('User already registered')) {
          errorMessage = 'An account with this email already exists. Please sign in instead.';
        } else if (error.message.includes('Signup is disabled')) {
          errorMessage = 'Account creation is currently disabled. Please contact support.';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = 'Please check your email and click the confirmation link before signing in.';
        } else {
          errorMessage = error.message;
        }
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
        onClick={() => {}}
        className="fixed top-4 right-4 z-50 p-2 rounded-lg bg-white shadow-md hover:shadow-lg transition-shadow"
      >
        <svg className="w-6 h-6 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

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

      <div className="container mx-auto px-4 py-4 sm:py-8">
        <div className="max-w-md mx-auto">
        </div>

        {/* Welcome Text */}
        <div className="text-center pt-20 pb-4 mb-4">
          <h1 className="text-2xl font-semibold text-foreground">Welcome to Hashtag.</h1>
        </div>

        <div className="max-w-md mx-auto">
          <div className="card p-6">
            <div className="mb-6">
              <button
                onClick={onBackToAuth}
                className="btn-ghost text-primary hover:text-primary/80 text-body-sm font-medium mb-4 inline-flex items-center"
              >
                ← Back to options
              </button>
              <h2 className="text-h2 text-foreground mb-2">Create Account</h2>
              <p className="text-body text-muted-foreground">
                Sign up to keep track of all your hashtags and access them across devices.
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
              placeholder="Create a password"
              className="input"
              required
              minLength={6}
              autoComplete="new-password"
            />
            <p className="mt-2 text-caption text-muted-foreground">Must be at least 6 characters long</p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-body-sm font-medium text-foreground mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              className="input"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
              <p className="text-destructive text-body-sm text-center">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !email || !password || !confirmPassword}
            className="btn btn-primary w-full"
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-caption text-muted-foreground text-center">
          <p>By creating an account, you agree to our terms of service.</p>
        </div>
          </div>
        </div>
      </div>
    </div>
  );
}
