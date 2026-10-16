import type { NextConfig } from "next";

const predictionUpstream =
  process.env.CAUSYN_PREDICTION_UPSTREAM ||
  "http://127.0.0.1:8000";

const causalUpstream =
  process.env.CAUSYN_CAUSAL_UPSTREAM ||
  "http://127.0.0.1:8001";

const nextConfig: NextConfig = {
  output: "standalone",

  async rewrites() {
    return [
      {
        source: "/api/prediction/:path*",
        destination: `${predictionUpstream}/:path*`,
      },
      {
        source: "/api/causal/:path*",
        destination: `${causalUpstream}/:path*`,
      },
    ];
  },
};

export default nextConfig;