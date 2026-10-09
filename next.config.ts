import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The email-code step was removed from signup; old links and open tabs go to the dashboard.
      { source: "/get-started/verify", destination: "/home/overview", permanent: false },
    ];
  },
};

export default nextConfig;
