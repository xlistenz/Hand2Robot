import { defineConfig } from "vite";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];

export default defineConfig({
  base: process.env.GITHUB_ACTIONS && repositoryName ? `/${repositoryName}/` : "/",
  // The Three.js scene is lazy-loaded only when Robot Arm mode is opened.
  build: { chunkSizeWarningLimit: 600 },
});
