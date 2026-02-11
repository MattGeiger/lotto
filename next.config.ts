import type { NextConfig } from "next";

const enableTweakcnPreview = process.env.VERCEL !== "1";
const speedInsightsScriptHost = "https://va.vercel-scripts.com";
const speedInsightsConnectHost = "https://vitals.vercel-insights.com";

const scriptSrc = enableTweakcnPreview
  ? `script-src 'self' 'unsafe-inline' ${speedInsightsScriptHost} https://tweakcn.com https://*.tweakcn.com`
  : `script-src 'self' 'unsafe-inline' ${speedInsightsScriptHost}`;

const connectSrc = enableTweakcnPreview
  ? `connect-src 'self' ${speedInsightsConnectHost} ${speedInsightsScriptHost} https://tweakcn.com https://*.tweakcn.com`
  : `connect-src 'self' ${speedInsightsConnectHost} ${speedInsightsScriptHost}`;

const frameAncestors = enableTweakcnPreview
  ? "frame-ancestors 'self' https://tweakcn.com https://*.tweakcn.com"
  : "frame-ancestors 'none'";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  turbopack: {},
  webpack: (config, { isServer, dev }) => {
    if (isServer && !dev && !process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for production builds.");
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              scriptSrc,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              connectSrc,
              frameAncestors,
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
