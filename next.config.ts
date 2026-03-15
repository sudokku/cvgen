import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['puppeteer-core', '@sparticuz/chromium'],
  outputFileTracingIncludes: {
    '/api/pdf': ['./node_modules/@sparticuz/chromium/**/*'],
  },
};

export default nextConfig;
