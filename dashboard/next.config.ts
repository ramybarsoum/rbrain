import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['postgres'],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
