import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/setupTests.ts"],
    include: ["src/**/*.test.{ts,tsx}", "src/**/*.spec.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // "server-only" 真包在非 react-server 环境 import 即 throw(build 期护栏),
      // jsdom 测试环境会中招——替换为空模块,让 server-api 等服务端模块可测。
      "server-only": path.resolve(__dirname, "./src/test-utils/server-only-stub.ts"),
    },
  },
});
