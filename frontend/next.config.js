/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    let backendUrl = (process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8080").trim();
    backendUrl = backendUrl.replace(/\/+$/, "");

    if (!backendUrl.startsWith("http://") && !backendUrl.startsWith("https://") && !backendUrl.startsWith("/")) {
      if (backendUrl.includes(".railway.app") || backendUrl.includes(".vercel.app") || backendUrl.includes(".render.com")) {
        backendUrl = `https://${backendUrl}`;
      } else {
        backendUrl = `http://${backendUrl}`;
      }
    }

    // If Railway internal network is specified without a port, append backend port :8080
    if (backendUrl.includes(".railway.internal") && !backendUrl.match(/:\d+$/)) {
      backendUrl = `${backendUrl}:8080`;
    }

    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
