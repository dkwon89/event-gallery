'use client';

import { useState } from 'react';

interface JoinFormProps {
  onJoin: () => void;
}

export default function JoinForm({ onJoin }: JoinFormProps) {
  const [eventCode, setEventCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!eventCode.trim() || !displayName.trim()) {
      return;
    }

    setIsSubmitting(true);
    
    // Save to localStorage
    localStorage.setItem('eventCode', eventCode.trim());
    localStorage.setItem('displayName', displayName.trim());
    
    // Signal parent to re-render
    onJoin();
    
    setIsSubmitting(false);
  };

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">
        Join Event Gallery
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="eventCode" className="block text-sm font-medium text-gray-700 mb-1">
            Event Code
          </label>
          <input
            type="text"
            id="eventCode"
            value={eventCode}
            onChange={(e) => setEventCode(e.target.value)}
            placeholder="Enter event code"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>
        
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
            Your Name
          </label>
          <input
            type="text"
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Enter your name"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>
        
        <button
          type="submit"
          disabled={isSubmitting || !eventCode.trim() || !displayName.trim()}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Joining...' : 'Join Event'}
        </button>
      </form>
    </div>
  );
}
