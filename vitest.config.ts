import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		tsconfigPaths: true,
	},
	test: {
		globals: true,
		root: "./",
		include: ["src/**/*.spec.ts"],
		environment: "node",
		coverage: {
			provider: "v8",
			reportsDirectory: "./coverage",
			include: ["src/**/*.ts"],
			exclude: ["src/**/*.spec.ts", "src/main.ts"],
		},
	},
	// Compila com o mesmo suporte a decorators/metadata que o Nest usa em runtime.
	plugins: [swc.vite()],
});
