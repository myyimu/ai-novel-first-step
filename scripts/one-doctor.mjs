import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const failures = [];
const warnings = [];

function runOne(args) {
	const result = spawnSync("one", args, {
		cwd: root,
		encoding: "utf8",
		shell: process.platform === "win32",
	});

	return {
		...result,
		status: result.status ?? 1,
		stdout: (result.stdout ?? "").trim(),
		stderr: (result.stderr ?? result.error?.message ?? "").trim(),
	};
}

function parseJson(text) {
	if (!text) {
		return null;
	}

	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}

function pushFailure(message) {
	failures.push(message);
}

function pushWarning(message) {
	warnings.push(message);
}

function readText(relativePath) {
	const absolutePath = join(root, relativePath);
	if (!existsSync(absolutePath)) {
		pushFailure(`Missing ${relativePath}`);
		return "";
	}

	return readFileSync(absolutePath, "utf8");
}

function readJson(relativePath) {
	const absolutePath = join(root, relativePath);
	if (!existsSync(absolutePath)) {
		pushFailure(`Missing ${relativePath}`);
		return null;
	}

	try {
		return JSON.parse(readFileSync(absolutePath, "utf8"));
	} catch (error) {
		pushFailure(`Invalid JSON in ${relativePath}: ${error.message}`);
		return null;
	}
}

const oneVersion = runOne(["--version"]);
if (oneVersion.status !== 0) {
	pushFailure("One CLI is not available on PATH. Install it before running workspace commands.");
}

const manifest = readJson("one.manifest.json");
const rootPackage = readJson("package.json");

if (manifest) {
	if (manifest.version !== 1) {
		pushFailure(`Unsupported one.manifest.json version: ${manifest.version}`);
	}

	if (!Array.isArray(manifest.projects) || manifest.projects.length === 0) {
		pushFailure("one.manifest.json must declare at least one project.");
	}

	for (const project of manifest.projects ?? []) {
		if (!project.name || !project.relativeDir || !project.templateId) {
			pushFailure(`Project entry is incomplete: ${JSON.stringify(project)}`);
			continue;
		}

		const projectDir = join(root, project.relativeDir);
		if (!existsSync(projectDir)) {
			pushFailure(`Project ${project.name} directory does not exist: ${project.relativeDir}`);
		}

		if (project.toolchain === "node") {
			const projectPackage = readJson(join(project.relativeDir, "package.json"));
			if (!projectPackage) {
				continue;
			}

			const devCommand = project.domains?.dev?.command;
			if (!devCommand) {
				pushWarning(`Project ${project.name} has no One dev command.`);
			} else if (!projectPackage.scripts) {
				pushFailure(`Project ${project.name} has dev command but no package scripts.`);
			}
		}

		if (project.domains?.container?.kind === "docker") {
			const dockerfilePath = join(projectDir, "Dockerfile");
			if (!existsSync(dockerfilePath)) {
				pushFailure(`Project ${project.name} declares Docker container but has no Dockerfile.`);
			}

			const dockerignorePath = join(projectDir, ".dockerignore");
			if (!existsSync(dockerignorePath)) {
				pushFailure(`Project ${project.name} declares Docker container but has no .dockerignore.`);
			}
		}
	}
}

if (rootPackage) {
	const scripts = rootPackage.scripts ?? {};
	if (scripts.dev !== "one dev") {
		pushFailure('Root package script "dev" should delegate to "one dev".');
	}
	if (scripts["dev:dry-run"] !== "one dev --dry-run") {
		pushFailure('Root package script "dev:dry-run" should delegate to "one dev --dry-run".');
	}
	if (scripts["container:prepare"] !== "node scripts/prepare-one-container.mjs") {
		pushFailure('Root package script "container:prepare" should prepare One container contexts.');
	}
}

if (oneVersion.status === 0) {
	const devDryRun = runOne(["dev", "--dry-run", "-o", "json"]);
	if (devDryRun.status !== 0) {
		const error = parseJson(devDryRun.stderr);
		pushFailure(`one dev --dry-run failed: ${error?.error?.code ?? devDryRun.stderr}`);
	}

	const containerInfo = runOne(["container", "info", "-o", "json"]);
	if (containerInfo.status !== 0) {
		const error = parseJson(containerInfo.stderr);
		pushFailure(`one container info failed: ${error?.error?.code ?? containerInfo.stderr}`);
	} else {
		const payload = parseJson(containerInfo.stdout);
		for (const project of payload?.projects ?? []) {
			if (!project.has_artifact) {
				pushFailure(`Container artifact missing for ${project.name}.`);
			}
		}
	}

	const containerBuildDryRun = runOne(["container", "build", "--dry-run", "-o", "json"]);
	if (containerBuildDryRun.status !== 0) {
		const error = parseJson(containerBuildDryRun.stderr);
		pushFailure(`one container build --dry-run failed: ${error?.error?.code ?? containerBuildDryRun.stderr}`);
	}

	const deployDryRun = runOne(["deploy", "--dry-run", "-o", "json"]);
	if (deployDryRun.status !== 0) {
		const error = parseJson(deployDryRun.stderr);
		if (error?.error?.code === "PROFILE_NONE_CONFIGURED") {
			pushWarning("Deploy dry-run is blocked until a deploy/kustomize profile is configured.");
		} else {
			pushFailure(`one deploy --dry-run failed: ${error?.error?.code ?? deployDryRun.stderr}`);
		}
	}
}

const webDockerfile = readText("apps/web/Dockerfile");
if (!webDockerfile.includes("COPY .one-container/standalone ./")) {
	pushFailure("apps/web/Dockerfile must copy the prepared standalone container artifact.");
}
if (/next\s+dev|pnpm .*dev/.test(webDockerfile)) {
	pushFailure("apps/web/Dockerfile must not run the Next.js dev server.");
}

const apiDockerfile = readText("services/api/Dockerfile");
if (!apiDockerfile.includes("COPY .one-container/dist ./dist")) {
	pushFailure("services/api/Dockerfile must copy the prepared API dist artifact.");
}
if (/start:dev|nest start --watch|pnpm .*dev/.test(apiDockerfile)) {
	pushFailure("services/api/Dockerfile must not run the NestJS dev server.");
}

const preparedArtifacts = [
	"apps/web/.one-container/standalone/apps/web/server.js",
	"apps/web/.one-container/standalone/apps/web/.next/static",
	"services/api/.one-container/dist/services/api/src/main.js",
];
for (const artifact of preparedArtifacts) {
	if (!existsSync(join(root, artifact))) {
		pushFailure(`Missing prepared container artifact ${artifact}. Run pnpm run container:prepare.`);
	}
}

const apiKustomize = readText("kustomize/base/api.yaml");
if (!apiKustomize.includes("containerPort: 3001") || !apiKustomize.includes("targetPort: 3001")) {
	pushFailure("kustomize/base/api.yaml must expose the API on port 3001.");
}
if (!apiKustomize.includes("name: PORT") || !apiKustomize.includes('value: "3001"')) {
	pushFailure("kustomize/base/api.yaml must set PORT=3001 for the API container.");
}

const webKustomize = readText("kustomize/base/web.yaml");
if (!webKustomize.includes("name: API_INTERNAL_BASE_URL")) {
	pushFailure("kustomize/base/web.yaml must set API_INTERNAL_BASE_URL for the web proxy.");
}
if (!webKustomize.includes("value: /api/v1")) {
	pushFailure("kustomize/base/web.yaml must keep NEXT_PUBLIC_API_BASE_URL relative.");
}

const report = {
	schema: "ai-novel-first-step/one-doctor/v1",
	oneVersion: oneVersion.status === 0 ? oneVersion.stdout : null,
	workspace: manifest?.workspace ?? null,
	projectCount: manifest?.projects?.length ?? 0,
	warnings,
	failures,
};

console.log(JSON.stringify(report, null, 2));

if (failures.length > 0) {
	process.exit(1);
}
