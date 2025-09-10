'use client';

import React from 'react';

interface AuthSelectionScreenProps {
  onProceedAsGuest: () => void;
  onSignUp: () => void;
  onSignIn: () => void;
}

export default function AuthSelectionScreen({ onProceedAsGuest, onSignUp, onSignIn }: AuthSelectionScreenProps) {
  return (
    <div className="min-h-screen bg-subtle flex flex-col items-center justify-center p-4 relative">
      {/* Hamburger Menu Button */}
      <button
        onClick={() => {}}
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-white shadow-md hover:shadow-lg transition-shadow"
      >
        <svg className="w-6 h-6 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <div className="card-floating p-8 w-full max-w-md text-center">
        <h1 className="text-h1 text-foreground mb-8">
          Welcome to Hashtag.
        </h1>
        
        <div className="mb-8">
          <h2 className="text-h3 text-foreground mb-4">How would you like to proceed?</h2>
          <p className="text-body text-muted-foreground mb-6">
            Create an account to keep track of all your hashtags, or proceed as a guest for a quick start.
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={onSignUp}
            className="btn btn-primary w-full py-3 floating-hover"
          >
            Sign Up for an Account
          </button>
          
          <button
            onClick={onSignIn}
            className="btn btn-secondary w-full py-3 floating-hover"
          >
            Sign In
          </button>
          
          <button
            onClick={onProceedAsGuest}
            className="btn btn-ghost w-full py-3 floating-hover"
          >
            Proceed as Guest
          </button>
        </div>

        <div className="mt-8 text-caption text-muted-foreground">
          <p className="mb-2 font-semibold">With an account:</p>
          <p>• Keep track of all hashtags you&apos;ve joined</p>
          <p>• Access your history across devices</p>
          <p>• Manage your uploaded content</p>
        </div>
      </div>
    </div>
  );
}
