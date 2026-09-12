import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_ACTIONS === "true";
const repositoryBasePath = "/game-calculators";
const basePath = isGitHubPages ? repositoryBasePath : "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  assetPrefix: isGitHubPages ? `${repositoryBasePath}/` : "",
  images: { unoptimized: true },
  // Exposed so `lib/site.ts` can prefix plain string URLs (such as the
  // Irrigation Planner iframe) that Next.js does not rewrite itself.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
