import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === 'true';

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: isGitHubPages ? '/poker-rta' : '',
  assetPrefix: isGitHubPages ? '/poker-rta/' : '',
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
