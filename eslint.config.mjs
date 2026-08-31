import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  {
    ignores: [".next/**", ".teamflow-next/**", "node_modules/**", "next-env.d.ts"]
  },
  ...nextVitals,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off"
    }
  }
];

export default eslintConfig;
