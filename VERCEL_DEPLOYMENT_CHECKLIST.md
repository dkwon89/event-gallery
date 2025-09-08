# Vercel Deployment Checklist for Event Gallery

## ✅ Pre-deployment Verification (Completed)

- [x] **Build Scripts**: Added `"build": "next build"` and `"start": "next start"` to package.json
- [x] **Production Build**: Local build test passed successfully
- [x] **Hardcoded URLs**: No localhost URLs found in source code (only in dev files)
- [x] **Environment Variables**: Added graceful fallback for missing Supabase config
- [x] **TypeScript Errors**: Fixed all build-time TypeScript errors

## 🚀 Vercel Dashboard Setup

### 1. Connect Repository
- [ ] Go to [vercel.com](https://vercel.com) and sign in
- [ ] Click "New Project"
- [ ] Import your GitHub repository: `event-gallery`
- [ ] Select the project root directory: `event-gallery/`

### 2. Configure Build Settings
- [ ] **Framework Preset**: Next.js (should auto-detect)
- [ ] **Root Directory**: `event-gallery` (if not auto-detected)
- [ ] **Build Command**: `npm run build` (should be auto-detected)
- [ ] **Output Directory**: `.next` (should be auto-detected)
- [ ] **Install Command**: `npm install` (should be auto-detected)

### 3. Set Environment Variables
In the Vercel dashboard, go to Project Settings → Environment Variables:

- [ ] **NEXT_PUBLIC_SUPABASE_URL**
  - Value: Your Supabase project URL (e.g., `https://your-project.supabase.co`)
  - Environment: Production, Preview, Development

- [ ] **NEXT_PUBLIC_SUPABASE_ANON_KEY**
  - Value: Your Supabase anonymous key
  - Environment: Production, Preview, Development

### 4. Deploy
- [ ] Click "Deploy" button
- [ ] Wait for build to complete (should take 2-3 minutes)
- [ ] Verify deployment URL works

## 🔍 Post-Deployment Verification

### 1. Test the Application
- [ ] Visit your Vercel deployment URL
- [ ] Verify the app loads without errors
- [ ] Test creating a new hashtag event
- [ ] Test joining an existing hashtag event
- [ ] Test uploading images/videos
- [ ] Test gallery functionality (swipe navigation, lightbox)

### 2. Test Error Handling
- [ ] Temporarily remove environment variables in Vercel dashboard
- [ ] Redeploy and verify ConfigError component shows
- [ ] Restore environment variables and redeploy

### 3. Performance Check
- [ ] Run Lighthouse audit on deployed URL
- [ ] Verify images load properly
- [ ] Test on mobile devices

## 🛠️ Troubleshooting

### If Build Fails
- Check Vercel build logs for specific errors
- Verify all environment variables are set correctly
- Ensure package.json scripts are correct

### If App Shows ConfigError
- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set
- Check that Supabase project is active
- Verify environment variable names match exactly

### If Images Don't Load
- Check Supabase Storage bucket permissions
- Verify CORS settings in Supabase
- Check Next.js image configuration

## 📋 Required Supabase Setup

Before deploying, ensure your Supabase project has:

- [ ] **Storage Bucket**: Create a bucket for event galleries
- [ ] **Database Table**: `hashtags` table for storing hashtag metadata
- [ ] **Row Level Security**: Configure RLS policies for public read access
- [ ] **CORS Settings**: Allow your Vercel domain in CORS configuration

## 🔗 Useful Links

- [Vercel Dashboard](https://vercel.com/dashboard)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- [Supabase Documentation](https://supabase.com/docs)
- [Environment Variables Guide](https://vercel.com/docs/concepts/projects/environment-variables)

---

**Note**: The app will show a friendly configuration error message if Supabase environment variables are missing, making it easy to identify configuration issues.
