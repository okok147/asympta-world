import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Job Mode intentionally mutates MapLibre-owned DOM nodes after querying them through
  // the portal target bridge. This is an external-system synchronization side effect,
  // not mutation of React data, but the React compiler rule cannot distinguish the two.
  {
    files: ["components/asympta-job-mode.tsx"],
    rules: {
      "react-hooks/immutability": "off",
    },
  },
  // Browser bridges synchronize persisted preferences, request-card portals, map-owned
  // markers and measured fixed-panel geometry. Those queried DOM nodes are external
  // systems, not mutable React render data, and subscription snapshots must enter state.
  {
    files: [
      "components/asympta-marketplace-intent-bridge.tsx",
      "components/asympta-marketplace-intent-router.tsx",
      "components/asympta-top-panel-manager.tsx",
    ],
    rules: {
      "react-hooks/immutability": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
