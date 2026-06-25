import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)));

const targets = {
	web: {
		dir: "apps/web",
		outDir: "apps/web/.one-container",
		prepare() {
			run("pnpm", ["--filter", "web", "build"]);
			run("pnpm", ["--filter", "web", "deploy", "--prod", "--legacy", this.outDir]);

			const standalone = join(root, this.outDir, "standalone");
			mkdirSync(standalone, { recursive: true });
			copy("apps/web/.next/standalone", standalone);
			copy("apps/web/.next/static", join(standalone, "apps/web/.next/static"));
			copy("apps/web/public", join(standalone, "apps/web/public"));
		},
	},
	api: {
		dir: "services/api",
		outDir: "services/api/.one-container",
		prepare() {
			run("pnpm", ["--filter", "api", "build"]);
			run("pnpm", ["--filter", "api", "deploy", "--prod", "--legacy", this.outDir]);
			copy("services/api/dist", join(root, this.outDir, "dist"));
		},
	},
};

function run(command, args) {
	const result = spawnSync(command, args, {
		cwd: root,
		env: {
			...process.env,
			HUSKY: "0",
			NEXT_TELEMETRY_DISABLED: "1",
		},
		encoding: "utf8",
		shell: process.platform === "win32",
		stdio: "inherit",
	});

	if (result.status !== 0) {
		throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
	}
}

function clean(relativePath) {
	const absolutePath = join(root, relativePath);
	if (!absolutePath.startsWith(root)) {
		throw new Error(`Refusing to remove outside workspace: ${absolutePath}`);
	}
	rmSync(absolutePath, { recursive: true, force: true });
}

function copy(fromRelativePath, toAbsolutePath) {
	const fromAbsolutePath = join(root, fromRelativePath);
	if (!existsSync(fromAbsolutePath)) {
		throw new Error(`Missing build artifact: ${fromRelativePath}`);
	}
	mkdirSync(toAbsolutePath, { recursive: true });
	cpSync(fromAbsolutePath, toAbsolutePath, { recursive: true, force: true });
}

for (const target of Object.values(targets)) {
	clean(target.outDir);
}

run("pnpm", ["--filter", "@ai-novel-diagnosis/ai-core", "build"]);
targets.web.prepare();
targets.api.prepare();

console.log("Prepared One container contexts in apps/web/.one-container and services/api/.one-container.");
