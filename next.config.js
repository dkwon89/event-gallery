/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow external connections for mobile testing
  serverExternalPackages: [],
  // Allow cross-origin requests from local network
  allowedDevOrigins: ['192.168.5.64'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

module.exports = nextConfig
