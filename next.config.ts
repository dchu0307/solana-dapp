import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /* config options here */
  // Suppress browser extension errors in production
  reactStrictMode: true,
  // swcMinify is enabled by default in Next.js 15, no need to specify
  
  webpack: (config, { isServer, webpack }) => {
    // Allow eval for Solana/Anchor libraries
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    }
    
    // Ignore browser extension errors during build
    if (!isServer) {
      config.plugins.push(
        new webpack.DefinePlugin({
          'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
        })
      )
    }
    
    return config
  },
  // CSP headers are set in middleware.ts to avoid conflicts
}

export default nextConfig
