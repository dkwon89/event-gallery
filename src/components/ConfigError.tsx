'use client';

export default function ConfigError() {
  return (
    <div className="min-h-screen bg-subtle flex items-center justify-center p-4">
      <div className="card-floating p-8 max-w-md mx-auto text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-h1 text-foreground mb-2">Configuration Required</h1>
          <p className="text-muted-foreground">
            This app needs to be configured with Supabase credentials to work properly.
          </p>
        </div>
        
        <div className="bg-muted rounded-lg p-4 mb-6 text-left">
          <h3 className="font-semibold text-foreground mb-2">Required Environment Variables:</h3>
          <div className="space-y-2 text-body-sm">
            <div>
              <code className="bg-background px-2 py-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code>
              <p className="text-muted-foreground mt-1">Your Supabase project URL</p>
            </div>
            <div>
              <code className="bg-background px-2 py-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
              <p className="text-muted-foreground mt-1">Your Supabase anonymous key</p>
            </div>
          </div>
        </div>

        <div className="text-body-sm text-muted-foreground">
          <p>Please contact your administrator or check the deployment configuration.</p>
        </div>
      </div>
    </div>
  );
}
