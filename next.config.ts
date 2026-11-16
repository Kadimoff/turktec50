import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  devIndicators: false,
  // Extra hostnames (e.g. this machine's Wi-Fi IP) that may load dev assets, so phones/laptops on the same network can use
  // `next dev`. Comma-separated hostnames without scheme/port, from .env: ALLOWED_DEV_ORIGINS="192.168.1.20".
  allowedDevOrigins: (process.env.ALLOWED_DEV_ORIGINS ?? "").split(",").map((h) => h.trim()).filter(Boolean),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    serverActions: { bodySizeLimit: "16mb" },
  },
};

export default withNextIntl(nextConfig);
