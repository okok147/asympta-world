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
  // The marketplace bridge synchronizes two browser-owned external systems: the
  // persisted localStorage profile and a DOM portal host rendered by the request-card
  // component. Hydrating subscription state and annotating that queried HTMLElement
  // are intentional bridge effects rather than mutation of React render data.
  {
    files: ["components/asympta-marketplace-intent-bridge.tsx"],
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
