import type { NextConfig } from "next";

const isGitHubPagesBuild = process.env.ASYMPTA_PAGES_BUILD === "1";

const nextConfig: NextConfig = isGitHubPagesBuild
  ? {
      // The repository is published at github.io/asympta-world. Vinext mirrors
      // this base path into asset URLs, including links injected at runtime.
      basePath: "/asympta-world",
    }
  : {};

export default nextConfig;
