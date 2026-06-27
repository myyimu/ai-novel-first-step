"use client";

import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { type BookExportFormat, type BookExportMode } from "@/components/workspace/export-view";
import { apiUrl, type ApiEnvelope } from "@/lib/api-client";
import {
	diagnosisExampleOptions,
	findDiagnosisExampleByChapterText,
	getDiagnosisExampleOption,
} from "@/lib/diagnosis-examples";
import { providerPresets } from "@/lib/provider-presets";
import { toQuickReviewErrorMessage } from "@/lib/quick-review-errors";
import {
	askResearchLibrary as requestResearchQa,
	compactReferenceText,
	compareResearchBooks,
	createBookAnalysisJobFromUpload,
	deleteBookAnalysisJob,
	listBookHistory,
	readBookAnalysisJob,
	readResearchLibrary,
	readWorkspaceAssets,
	requestQuickReview,
	requestReferenceProfile,
	requestRubric,
	requestScoreChapter,
	resumeBookAnalysisJob,
	testProviderConnection,
	updateRevisionSessionNote,
	uploadBookPreview,
	upsertRevisionAssets,
	upsertWorkspaceProject,
	type ReferenceProfileResult,
	type WorkspaceAssetsPayload,
} from "@/lib/workspace-analysis-client";
import {
	buildReferenceProfileFacts,
	useReferenceProfileProgressController,
	useScoreProgressController,
} from "@/lib/workspace-progress";
import {
	buildBookWorkspaceSummary,
	buildChapterWorkspaceSummary,
	buildResearchWorkspaceSummary,
	getAdvancedWorkspaceNavItems,
	getPerformanceSnapshotNote,
	getWorkspaceNavItems,
	getWorkspaceViewMeta,
} from "@/lib/workspace-view-model";
import {
	buildProjectExportMarkdown,
	createRevisionSession,
	mergeProjectMethodologyCards,
	upsertRevisionSession,
} from "@/lib/workspace-iteration";
import {
	buildBookAnalysisCacheKey as createBookAnalysisCacheKey,
	buildQuickReviewCacheKey as createQuickReviewCacheKey,
	buildReferenceProfileCacheKey as createReferenceProfileCacheKey,
	buildRubricCacheKey as createRubricCacheKey,
	buildScoreCacheKey as createScoreCacheKey,
	createBookAnalysisCacheEntry,
	createQuickReviewCacheEntry,
	createRubricCacheEntry,
	createScoreCacheEntry,
	updateCachedBookAnalysisByJobId,
	upsertCacheEntry,
} from "@/lib/workspace-cache";
import { type WorkspaceView, workspaceViewRoutes } from "@/lib/workspace-routes";
import {
	buildBeginnerLearningDigest,
	buildComparisonSamples,
	buildResearchGraph,
	buildResearchPromptSeed,
	buildScoreEvidenceChain,
} from "@/lib/research-library";
import {
	formatFileSize,
	basenameWithoutExtension,
	toSafeFilename,
	downloadText,
	mergeById,
	mergeMethodologyCards,
	wait,
	isTransientFetchError,
	toBookPollingNetworkMessage,
	inferReferenceProfile,
	inferPlatformStrategyFromProfile,
	buildReferenceProfileSample,
	getBookJobProgressDetail,
	LARGE_BOOK_INLINE_BYTES,
	optionLabel,
	platformOptions,
	audienceOptions,
	readingModeOptions,
	competitionLevelOptions,
	pushStageOptions,
	type InferredReferenceProfile,
} from "@/lib/workspace-utils";
import {
	type BookAnalysisResult,
	type BookAnalysisJob,
	type ProviderPresetId,
	type QuickReviewResult,
	type RubricResult,
	type ScoreResult,
	type WorkspaceProject,
	defaultBookText,
	defaultWorkspaceProject,
	defaultProvider,
	defaultReferenceText,
	useWorkspaceStore,
} from "@/stores/workspace-store";

export type LoadingState =
	| "provider"
	| "profile"
	| "rubric"
	| "score"
	| "quick"
	| "upload"
	| "book"
	| "history"
	| "research"
	| "compare"
	| "ask"
	| "export"
	| null;

export function useWorkspaceHandlers(activeView: WorkspaceView) {
	const router = useRouter();
	const {
		provider,
		setProvider,
		referenceTitle,
		setReferenceTitle,
		genre,
		setGenre,
		platform,
		audience,
		readingMode,
		category,
		setCategory,
		theme,
		setTheme,
		tags,
		setTags,
		explicitKeywords,
		setExplicitKeywords,
		implicitExpectations,
		setImplicitExpectations,
		positioningPromise,
		setPositioningPromise,
		recommendationSignals,
		setRecommendationSignals,
		competitionLevel,
		setCompetitionLevel,
		competitionNotes,
		setCompetitionNotes,
		pushStage,
		setPushStage,
		trafficEntry,
		setTrafficEntry,
		impressions,
		clickThroughRate,
		validReadRate,
		read30sRate,
		read60sRate,
		bottomRate,
		followRate,
		bookshelfRate,
		firstChapterCompletionRate,
		nextChapterClickRate,
		threeChapterRetentionRate,
		avgReadProgressRate,
		paidUnlockRate,
		aiSelfTestEnabled,
		enabledAiSelfTests,
		referenceText,
		setReferenceText,
		referenceFileName,
		setReferenceFileName,
		chapterTitle,
		setChapterTitle,
		chapterText,
		setChapterText,
		quickReviewGenre,
		setQuickReviewGenre,
		quickReviewInputKind,
		setQuickReviewInputKind,
		quickReviewPreviousPrompt,
		setQuickReviewPreviousPrompt,
		rubricResult,
		setRubricResult,
		scoreResult,
		setScoreResult,
		quickReviewResult,
		setQuickReviewResult,
		referenceProfileProgress,
		setReferenceProfileProgress,
		setScoreProgress,
		bookTitle,
		setBookTitle,
		bookGenre,
		setBookGenre,
		bookText,
		setBookText,
		bookFile,
		setBookFile,
		bookUpload,
		setBookUpload,
		bookHistory,
		setBookHistory,
		uploadHistory,
		setUploadHistory,
		bookAnalysisResult,
		setBookAnalysisResult,
		bookJob,
		setBookJob,
		persistedResearchLibrary,
		setPersistedResearchLibrary,
		selectedResearchJobIds,
		setSelectedResearchJobIds,
		comparisonFocus,
		setResearchComparison,
		researchQuestion,
		setResearchQaResult,
		quickReviewCache,
		setQuickReviewCache,
		revisionSessions,
		setRevisionSessions,
		methodologyCards,
		setMethodologyCards,
		rubricCache,
		setRubricCache,
		scoreCache,
		setScoreCache,
		bookAnalysisCache,
		setBookAnalysisCache,
		projects,
		setProjects,
		activeProjectId,
		setActiveProjectId,
	} = useWorkspaceStore();

	/* ──────────── local state ──────────── */

	const [status, setStatus] = useState<string>(
		"默认使用共享站；配置自己的 API Key 后，会使用你选择的模型服务。",
	);
	const [loading, setLoading] = useState<LoadingState>(null);
	const [quickReviewElapsedSeconds, setQuickReviewElapsedSeconds] = useState(0);
	const [bookUtilityPanel, setBookUtilityPanel] = useState<"history" | "exports" | null>(null);
	const [newProjectName, setNewProjectName] = useState("");
	const [previousQuickReviewResult, setPreviousQuickReviewResult] =
		useState<QuickReviewResult | null>(null);
	const [quickReviewError, setQuickReviewError] = useState<string | null>(null);

	/* ──────────── refs ──────────── */

	const referenceProfileCacheRef = useRef<Map<string, ReferenceProfileResult>>(new Map());
	const chapterDraftTouchedRef = useRef(false);
	const platformStrategyTouchedRef = useRef(false);
	const activeBookPollJobIdRef = useRef<string | null>(null);
	const workspaceAssetsLoadedRef = useRef(false);

	/* ──────────── progress controllers ──────────── */

	const {
		resetScoreProgress,
		initializeScoreProgress,
		revealScoreProgress,
		failCurrentScoreProgress,
	} = useScoreProgressController(setScoreProgress);
	const {
		resetReferenceProfileProgress,
		initializeReferenceProfileProgress,
		updateReferenceProfileProgress,
	} = useReferenceProfileProgressController(setReferenceProfileProgress);

	/* ──────────── derived values ──────────── */

	const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0];
	const projectRevisionSessions = revisionSessions.filter(
		(session) => (session.projectId || "default-project") === activeProjectId,
	);
	const projectMethodologyCards = methodologyCards.filter(
		(card) => (card.projectId || "default-project") === activeProjectId,
	);

	/* ──────────── timer effect ──────────── */

	useEffect(() => {
		if (loading !== "quick") {
			setQuickReviewElapsedSeconds(0);
			return;
		}

		const startedAt = Date.now();
		setQuickReviewElapsedSeconds(0);
		const timer = window.setInterval(() => {
			setQuickReviewElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
		}, 1000);

		return () => window.clearInterval(timer);
	}, [loading]);

	/* ──────────── handler functions (batch 1) ──────────── */

	function openView(view: WorkspaceView) {
		router.push(workspaceViewRoutes[view]);
	}

	function openBookUtility(panel: "history" | "exports") {
		setBookUtilityPanel((current) => (current === panel ? null : panel));
	}

	function switchProject(projectId: string) {
		if (projectId === activeProjectId) {
			return;
		}

		const project = projects.find((item) => item.id === projectId);
		setActiveProjectId(projectId);
		setPreviousQuickReviewResult(null);
		setQuickReviewResult(null);
		setStatus(`已切换到项目：${project?.name || "未命名项目"}`);
	}

	function applyWorkspaceAssets(assets: WorkspaceAssetsPayload) {
		const hasAssets =
			assets.projects.length ||
			assets.revisionSessions.length ||
			assets.methodologyCards.length;
		if (!hasAssets) {
			return;
		}

		setProjects((current) => mergeById(assets.projects, current));
		setRevisionSessions((current) => mergeById(assets.revisionSessions, current));
		setMethodologyCards((current) => mergeMethodologyCards(assets.methodologyCards, current));
		setActiveProjectId((current) => {
			const mergedProjects = mergeById(assets.projects, projects);
			return mergedProjects.some((project) => project.id === current)
				? current
				: mergedProjects[0]?.id || defaultWorkspaceProject.id;
		});
	}

	async function loadWorkspaceAssets() {
		try {
			const assets = await readWorkspaceAssets();
			applyWorkspaceAssets(assets);
		} catch {
			// API 持久化是增强能力；离线时继续使用浏览器本地状态。
		}
	}

	function createProject() {
		const name = newProjectName.trim();
		if (!name) {
			setStatus("请先填写项目名称。");
			return;
		}

		const now = new Date().toISOString();
		const project = {
			id: `project-${Date.now().toString(36)}`,
			name,
			createdAt: now,
			updatedAt: now,
		};
		setProjects((current) => [project, ...current]);
		setActiveProjectId(project.id);
		setNewProjectName("");
		setPreviousQuickReviewResult(null);
		setQuickReviewResult(null);
		setStatus(`已创建并切换到项目：${project.name}`);
		void upsertWorkspaceProject(project).catch(() => {
			setStatus("项目已在本地创建；后端暂时未同步成功。");
		});
	}

	function saveRevisionNote(sessionId: string, note: string) {
		const now = new Date().toISOString();
		setRevisionSessions((current) =>
			current.map((session) =>
				session.id === sessionId
					? {
							...session,
							revisionNote: note.trim(),
							revisionNoteUpdatedAt: now,
						}
					: session,
			),
		);
		setProjects((current) =>
			current.map((project) =>
				project.id === activeProjectId ? { ...project, updatedAt: now } : project,
			),
		);
		setStatus("复诊备注已保存。");
		void updateRevisionSessionNote({
			sessionId,
			note: note.trim(),
			updatedAt: now,
		}).catch(() => {
			setStatus("复诊备注已本地保存；后端暂时未同步成功。");
		});
	}

	async function exportProjectMarkdown() {
		if (!projectRevisionSessions.length && !projectMethodologyCards.length) {
			setStatus("当前项目还没有可导出的复诊记录或方法论卡。");
			return;
		}

		const project = activeProject ?? defaultWorkspaceProject;
		try {
			const response = await fetch(
				apiUrl(`/analysis/workspace/projects/${encodeURIComponent(project.id)}/export`),
			);
			if (response.ok) {
				const content = await response.text();
				const disposition = response.headers.get("content-disposition") || "";
				const filenameMatch = disposition.match(/filename\*=UTF-8''([^;]+)/);
				const filename = filenameMatch
					? decodeURIComponent(filenameMatch[1])
					: `ai-novel-diagnosis-${toSafeFilename(project.name)}-${new Date()
							.toISOString()
							.slice(0, 10)}.md`;
				downloadText(
					filename,
					content,
					response.headers.get("content-type") || "text/markdown;charset=utf-8",
				);
				setStatus(`项目导出完成：${filename}`);
				return;
			}
		} catch {
			// Fall back to browser-local export below.
		}

		const content = buildProjectExportMarkdown({
			project,
			revisionSessions: projectRevisionSessions,
			methodologyCards: projectMethodologyCards,
		});
		const filename = `ai-novel-diagnosis-${toSafeFilename(project.name)}-${new Date()
			.toISOString()
			.slice(0, 10)}.md`;
		downloadText(filename, content, "text/markdown;charset=utf-8");
		setStatus(`项目导出完成：${filename}`);
	}

	/* ──────────── nav items ──────────── */

	const navItems = getWorkspaceNavItems();
	const advancedNavItems = getAdvancedWorkspaceNavItems();
	const activeMeta = getWorkspaceViewMeta(activeView);

	/* ──────────── computed values ──────────── */

	const providerPayload = useMemo(
		() => ({
			preset: provider.preset,
			kind: provider.kind,
			baseUrl: provider.baseUrl,
			apiKey: provider.apiKey,
			model: provider.model,
			temperature: provider.temperature,
			jsonMode: provider.jsonMode,
		}),
		[provider],
	);
	const selectedProviderPreset = providerPresets[provider.preset];
	const providerModelOptions = selectedProviderPreset.modelOptions ?? [];
	const selectedModelOption = providerModelOptions.includes(provider.model)
		? provider.model
		: "__custom__";
	const isBackendFreeProvider = provider.preset === "shared-gpu";
	const isShortPaidReading = readingMode === "short-paid";
	const isShortFormReading = isShortPaidReading || platform === "wechat-short";
	const isLongSerialization = readingMode === "long-serialization";
	const isAlgorithmPlatform =
		platform === "fanqie" || platform === "qimao" || platform === "wechat-short";
	const performanceSnapshotNote = getPerformanceSnapshotNote({
		isShortFormReading,
		isLongSerialization,
	});
	const providerLabel =
		provider.kind === "mock" ? "本地演示" : providerPresets[provider.preset].label;
	const referenceProfileApplied = referenceProfileProgress.some(
		(item) => item.id === "apply" && item.status === "completed",
	);
	const platformLabel = optionLabel(platformOptions, platform);
	const audienceLabel = optionLabel(audienceOptions, audience);
	const readingModeLabel = optionLabel(readingModeOptions, readingMode);
	const {
		chapterProjectSteps,
		chapterCompletion,
		nextChapterAction,
	} = buildChapterWorkspaceSummary({
		platformLabel,
		audienceLabel,
		readingModeLabel,
		referenceText,
		referenceFileName,
		chapterText,
		quickReviewResult,
		referenceProfileApplied,
		category,
		theme,
		rubricResult,
		scoreResult,
		performanceValues: [
			impressions,
			clickThroughRate,
			validReadRate,
			read30sRate,
			read60sRate,
			bottomRate,
			followRate,
			bookshelfRate,
			firstChapterCompletionRate,
			nextChapterClickRate,
			threeChapterRetentionRate,
			avgReadProgressRate,
			paidUnlockRate,
		],
		performanceSnapshotNote,
	});
	const { bookStatusText, bookCompletion } = buildBookWorkspaceSummary({
		bookJob,
		bookUpload,
	});
	const bookProgressDetail = getBookJobProgressDetail(bookJob);
	const quickReviewCacheHit = quickReviewCache.find(
		(item) => item.key === buildQuickReviewCacheKey(),
	);
	const rubricCacheHit = rubricCache.find((item) => item.key === buildRubricCacheKey());
	const scoreCacheHit = scoreCache.find((item) => item.key === buildScoreCacheKey());
	const bookAnalysisCacheHit = bookAnalysisCache.find(
		(item) => item.key === buildBookAnalysisCacheKey(),
	);
	const researchGraph = buildResearchGraph(bookAnalysisResult);
	const scoreEvidenceChain = buildScoreEvidenceChain(scoreResult);
	const comparisonSamples = buildComparisonSamples(bookAnalysisResult, bookHistory);
	const researchPromptSeed = buildResearchPromptSeed(
		researchGraph,
		scoreEvidenceChain,
		comparisonSamples,
	);
	const beginnerLearningDigest = buildBeginnerLearningDigest(bookAnalysisResult);
	const graphNodeCount = researchGraph.nodes.length;
	const graphEdgeCount = researchGraph.edges.length;
	const bookFileTooLargeForInlinePreview = Boolean(
		bookFile && bookFile.size > LARGE_BOOK_INLINE_BYTES && !bookText.trim(),
	);
	const foreshadowingCount = researchGraph.nodes.filter(
		(item) => item.type === "foreshadowing",
	).length;
	const evidenceScoreCount = scoreEvidenceChain.items.filter((item) => item.evidence).length;
	const comparableBookCount = comparisonSamples.samples.length;
	const { researchSourceCount, researchReadiness, researchSources } =
		buildResearchWorkspaceSummary({
			referenceText,
			chapterText,
			chapterTitle,
			referenceFileName,
			bookUpload,
			bookAnalysisResult,
			scoreResult,
			graphNodeCount,
			graphEdgeCount,
			evidenceScoreCount,
			comparableBookCount,
		});

	/* ──────────── effects ──────────── */

	useEffect(() => {
		if (workspaceAssetsLoadedRef.current) {
			return;
		}

		workspaceAssetsLoadedRef.current = true;
		void loadWorkspaceAssets();
	}, []);

	useEffect(() => {
		if (activeView === "library" && !persistedResearchLibrary) {
			void loadResearchLibrary();
		}
	}, [activeView, persistedResearchLibrary]);

	useEffect(() => {
		if (bookHistory.length || uploadHistory.length) {
			return;
		}

		void loadHistory({ silent: true });
	}, [bookHistory.length, uploadHistory.length]);

	useEffect(() => {
		if (!bookJob?.id) {
			return;
		}

		if (bookJob.status === "queued" || bookJob.status === "running") {
			void followBookJob(bookJob.id, {
				background: true,
				silent: true,
				maxAttempts: 600,
			});
			return;
		}

		if (
			(bookJob.status === "succeeded" ||
				(bookJob.status === "failed" && Boolean(bookJob.partialResult))) &&
			!bookAnalysisResult
		) {
			void openHistoryJob(bookJob.id, { silent: true, preserveLoading: true });
		}
	}, [bookAnalysisResult, bookJob?.id, bookJob?.status]);

	/* ──────────── cache key builders ──────────── */

	function buildQuickReviewCacheKey() {
		return createQuickReviewCacheKey({
			provider,
			quickReviewGenre,
			quickReviewInputKind,
			quickReviewPreviousPrompt,
			chapterTitle,
			chapterText,
		});
	}

	function buildRubricCacheKey() {
		return createRubricCacheKey({
			provider,
			referenceTitle,
			genre,
			platform,
			audience,
			readingMode,
			category,
			theme,
			tags,
			explicitKeywords,
			implicitExpectations,
			positioningPromise,
			recommendationSignals,
			competitionLevel,
			competitionNotes,
			pushStage,
			trafficEntry,
			referenceText,
		});
	}

	function buildScoreCacheKey() {
		return createScoreCacheKey({
			provider,
			rubricResult,
			platform,
			audience,
			readingMode,
			category,
			theme,
			tags,
			explicitKeywords,
			implicitExpectations,
			positioningPromise,
			recommendationSignals,
			competitionLevel,
			competitionNotes,
			pushStage,
			trafficEntry,
			chapterTitle,
			chapterText,
			aiSelfTestEnabled,
			enabledAiSelfTests,
			performanceValues: [
				impressions,
				clickThroughRate,
				validReadRate,
				read30sRate,
				read60sRate,
				bottomRate,
				followRate,
				bookshelfRate,
				firstChapterCompletionRate,
				nextChapterClickRate,
				threeChapterRetentionRate,
				avgReadProgressRate,
				paidUnlockRate,
			],
		});
	}

	function buildBookAnalysisCacheKey() {
		return createBookAnalysisCacheKey({
			provider,
			bookGenre,
			bookTitle,
			bookText,
			bookFile,
		});
	}

	/* ──────────── cache remember functions ──────────── */

	function rememberQuickReview(key: string, result: QuickReviewResult) {
		const entry = createQuickReviewCacheEntry({
			key,
			chapterTitle,
			quickReviewGenre,
			result,
		});
		setQuickReviewCache((current) => upsertCacheEntry(current, entry));
	}

	function rememberQuickReviewIteration(result: QuickReviewResult) {
		const now = new Date().toISOString();
		const project: WorkspaceProject = activeProject
			? { ...activeProject, updatedAt: now }
			: { ...defaultWorkspaceProject, updatedAt: now };
		const mergedCards = mergeProjectMethodologyCards({
			projectId: activeProjectId,
			currentCards: methodologyCards,
			resultCards: result.methodologyCards,
			result,
			chapterTitle,
			now,
		});
		const session = createRevisionSession({
			projectId: activeProjectId,
			chapterTitle,
			chapterText,
			result,
			methodologyCardIds: mergedCards.cardIds,
			now,
		});

		setMethodologyCards(mergedCards.cards);
		setRevisionSessions((current) => upsertRevisionSession(current, session));
		setProjects((current) =>
			current.map((project) =>
				project.id === activeProjectId ? { ...project, updatedAt: now } : project,
			),
		);
		void upsertRevisionAssets({
			project,
			session,
			methodologyCards: mergedCards.cards.filter(
				(card) => (card.projectId || defaultWorkspaceProject.id) === activeProjectId,
			),
		})
			.then(applyWorkspaceAssets)
			.catch(() => {
				setStatus("复诊结果已本地保存；后端暂时未同步成功。");
			});
	}

	function rememberRubric(key: string, result: RubricResult) {
		const entry = createRubricCacheEntry({
			key,
			referenceTitle,
			result,
		});
		setRubricCache((current) => upsertCacheEntry(current, entry));
	}

	function rememberScore(key: string, result: ScoreResult) {
		const entry = createScoreCacheEntry({
			key,
			chapterTitle,
			result,
		});
		setScoreCache((current) => upsertCacheEntry(current, entry));
	}

	function rememberBookAnalysis(
		key: string,
		job: BookAnalysisJob,
		result: BookAnalysisResult | null,
	) {
		const entry = createBookAnalysisCacheEntry({
			key,
			bookTitle,
			job,
			result,
		});
		setBookAnalysisCache((current) => upsertCacheEntry(current, entry));
	}

	function updateBookAnalysisCacheByJobId(jobId: string, job: BookAnalysisJob) {
		setBookAnalysisCache((current) => updateCachedBookAnalysisByJobId(current, jobId, job));
	}

	/* ──────────── handler functions (batch 2) ──────────── */

	async function testProvider() {
		setLoading("provider");
		setStatus("正在测试模型服务...");
		try {
			const result = await testProviderConnection(providerPayload);
			const providerName = providerPresets[provider.preset].label;
			const modelName =
				provider.kind === "mock"
					? "本地演示"
					: provider.model || String(result.model || "未指定模型");
			setStatus(`模型服务可用：${providerName} · ${modelName}`);
		} catch (error) {
			setStatus((error as Error).message);
		} finally {
			setLoading(null);
		}
	}

	function applyProviderPreset(presetId: ProviderPresetId) {
		const preset = providerPresets[presetId];
		setProvider((current) => ({
			...current,
			preset: presetId,
			kind: preset.kind,
			baseUrl: preset.baseUrl,
			model: preset.model,
			jsonMode: preset.jsonMode,
			apiKey: preset.needsApiKey ? current.apiKey : "",
		}));
	}

	function resetProviderSettings() {
		setProvider(defaultProvider);
		setStatus("已恢复默认 AI 设置，并保存到本机浏览器。");
	}

	function useExampleChapter(exampleId?: string) {
		const example = getDiagnosisExampleOption(exampleId);
		setChapterTitle(example.chapterTitle);
		setChapterText(example.chapterText);
		setQuickReviewGenre(example.genre);
		setQuickReviewInputKind(example.inputKind);
		setQuickReviewPreviousPrompt(example.previousPrompt);
		setPreviousQuickReviewResult(null);
		setQuickReviewResult(null);
		setScoreResult(null);
		setStatus(`已填入示例章节：${example.label}。示例只用于演示，你可以直接替换成自己的正文。`);
	}

	function useExampleReference() {
		setReferenceTitle("第一章 少年被逐");
		setReferenceText(defaultReferenceText);
		setReferenceFileName("");
		setRubricResult(null);
		setScoreResult(null);
		setReferenceProfileProgress([]);
		setStatus("已填入示例参考章节。示例只用于演示，市场定位仍需 AI 识别或手动校正。");
	}

	function useExampleBook() {
		setBookTitle("示例长篇小说");
		setBookText(defaultBookText);
		setBookUpload(null);
		setBookAnalysisResult(null);
		setBookJob(null);
		setStatus("已填入示例整书文本。示例只用于演示，请在正式拆解前替换为自己的 TXT。");
	}

	function applyInferredPlatformStrategy(
		profile: InferredReferenceProfile | ReferenceProfileResult,
		force = false,
	) {
		if (platformStrategyTouchedRef.current && !force) {
			return;
		}

		const inferredStrategy = inferPlatformStrategyFromProfile(profile, platform, readingMode);
		setRecommendationSignals(inferredStrategy.recommendationSignals);
		setCompetitionLevel(inferredStrategy.competitionLevel);
		setCompetitionNotes(inferredStrategy.competitionNotes);
		setPushStage(inferredStrategy.pushStage);
		setTrafficEntry(inferredStrategy.trafficEntry);
	}

	function applyLocalReferenceInference(text: string, filename?: string) {
		const inferred = inferReferenceProfile(text, filename ?? referenceTitle);
		setReferenceTitle(inferred.title);
		if (!chapterDraftTouchedRef.current) {
			setChapterTitle(inferred.title);
			setChapterText(text);
		}
		setGenre(inferred.genre);
		setCategory(inferred.category);
		setTheme(inferred.theme);
		setTags(inferred.tags);
		setExplicitKeywords(inferred.explicitKeywords);
		setImplicitExpectations(inferred.implicitExpectations);
		setPositioningPromise(inferred.positioningPromise);
		applyInferredPlatformStrategy(inferred, true);
		setRubricResult(null);
		setScoreResult(null);
		resetScoreProgress();
		setStatus("本地演示结果已写入；切换到可用模型服务后可用 AI 重新识别。");
		return inferred;
	}

	function applyReferenceProfileResult(result: ReferenceProfileResult) {
		setReferenceTitle(result.referenceTitle || referenceTitle);
		if (!chapterDraftTouchedRef.current && result.referenceTitle) {
			setChapterTitle(result.referenceTitle);
		}
		setGenre(result.genre || "other");
		setCategory(result.category);
		setTheme(result.theme);
		setTags(result.tags.join("，"));
		setExplicitKeywords(result.explicitKeywords.join("，"));
		setImplicitExpectations(result.implicitExpectations.join("，"));
		setPositioningPromise(result.positioningPromise);
		applyInferredPlatformStrategy(result, true);
		setRubricResult(null);
		setScoreResult(null);
		resetScoreProgress();
		const confidence =
			typeof result.confidence === "number"
				? `，置信度 ${Math.round(result.confidence * 100)}%`
				: "";
		const suffix = result.notes ? `。${result.notes}` : "";
		setStatus(`AI 已识别市场定位${confidence}；你可以校正后生成评分标准${suffix}`);
	}

	async function inferReferenceProfileFromModel(text = referenceText, filename?: string) {
		if (!text.trim()) {
			setStatus("请先导入或粘贴成熟章节。");
			return;
		}

		initializeReferenceProfileProgress();
		if (provider.kind === "mock") {
			const inferred = applyLocalReferenceInference(text, filename);
			updateReferenceProfileProgress("sample", {
				status: "completed",
				detail: "本地演示不会请求在线模型。",
			});
			updateReferenceProfileProgress("model", {
				status: "completed",
				detail: "已生成演示用市场定位结果。",
				facts: buildReferenceProfileFacts(inferred),
			});
			updateReferenceProfileProgress("apply", {
				status: "completed",
				detail: "已写入演示结果；切换到可用模型服务后可重新识别。",
				facts: buildReferenceProfileFacts(inferred),
			});
			return;
		}

		const sampledText = buildReferenceProfileSample(text);
		updateReferenceProfileProgress("sample", {
			status: "completed",
			detail:
				sampledText.length === text.trim().length
					? `已使用全文识别，共 ${sampledText.length} 字。`
					: `已抽取 ${sampledText.length} 字样本，保留开头和结尾以加快识别。`,
		});
		const cacheKey = createReferenceProfileCacheKey({
			provider,
			platform,
			audience,
			readingMode,
			referenceTitle: filename ? basenameWithoutExtension(filename) : referenceTitle,
			sampledText,
		});
		const cached = referenceProfileCacheRef.current.get(cacheKey);
		if (cached) {
			updateReferenceProfileProgress("model", {
				status: "completed",
				detail: "命中缓存，未重复请求模型。",
				facts: buildReferenceProfileFacts(cached),
			});
			applyReferenceProfileResult(cached);
			updateReferenceProfileProgress("apply", {
				status: "completed",
				detail: "已把缓存识别结果写入市场定位字段。",
				facts: buildReferenceProfileFacts(cached),
			});
			setStatus("已使用缓存的 AI 识别结果；你可以校正后生成评分标准。");
			return;
		}

		setLoading("profile");
		setStatus("正在用 AI 识别市场定位...");
		updateReferenceProfileProgress("model", {
			status: "checking",
			detail: "正在请求模型识别参考章节的市场定位。",
		});
		try {
			const result = await requestReferenceProfile({
				provider: providerPayload,
				referenceTitle: filename ? basenameWithoutExtension(filename) : referenceTitle,
				platform,
				audience,
				readingMode,
				referenceText: sampledText,
			});
			referenceProfileCacheRef.current.set(cacheKey, result);
			updateReferenceProfileProgress("model", {
				status: "completed",
				detail: result.notes || "模型已返回结构化市场定位。",
				facts: buildReferenceProfileFacts(result),
			});
			applyReferenceProfileResult(result);
			updateReferenceProfileProgress("apply", {
				status: "completed",
				detail: "已把 AI 识别结果写入下面字段，仍可手动校正。",
				facts: buildReferenceProfileFacts(result),
			});
		} catch (error) {
			updateReferenceProfileProgress("model", {
				status: "failed",
				detail: (error as Error).message,
			});
			updateReferenceProfileProgress("apply", {
				status: "failed",
				detail: "AI 识别失败，未写入市场定位字段；请切换可用模型重试，或手动填写下面字段。",
			});
			setStatus(
				`${(error as Error).message}；AI 识别失败，未自动改写市场定位字段。请切换可用模型重试，或手动填写后生成评分标准。`,
			);
		} finally {
			setLoading(null);
		}
	}

	async function importReferenceFile(event: ChangeEvent<HTMLInputElement>) {
		const input = event.currentTarget;
		const file = input.files?.[0];
		if (!file) {
			return;
		}

		try {
			const text = await file.text();
			platformStrategyTouchedRef.current = false;
			setReferenceText(text);
			setReferenceFileName(file.name);
			await inferReferenceProfileFromModel(text, file.name);
		} catch (error) {
			setStatus((error as Error).message);
		} finally {
			input.value = "";
		}
	}

	async function buildRubric(force = false) {
		const cacheKey = buildRubricCacheKey();
		if (!force) {
			const cached = rubricCache.find((item) => item.key === cacheKey);
			if (cached) {
				setRubricResult(cached.result);
				setScoreResult(null);
				resetScoreProgress();
				setStatus("已使用缓存的评分标准；如需让 AI 重新拆解，请点“重新分析”。");
				return;
			}
		}

		setLoading("rubric");
		setScoreResult(null);
		resetScoreProgress();
		const rubricReferenceText = compactReferenceText(referenceText);
		setStatus(
			rubricReferenceText.length === referenceText.trim().length
				? "正在拆解参考章节并生成评分标准..."
				: `参考章节超过单次分析长度，已抽取 ${rubricReferenceText.length} 字的开头和结尾生成评分标准...`,
		);
		try {
			const result = await requestRubric({
				provider: providerPayload,
				referenceTitle,
				genre,
				platform,
				audience,
				readingMode,
				category,
				theme,
				tags,
				explicitKeywords,
				implicitExpectations,
				positioningPromise,
				recommendationSignals,
				competitionLevel,
				competitionNotes,
				pushStage,
				trafficEntry,
				referenceText: rubricReferenceText,
			});
			setRubricResult(result);
			rememberRubric(cacheKey, result);
			setStatus(`评分标准已生成：${result.rubric.metrics.length} 个指标`);
		} catch (error) {
			setStatus((error as Error).message);
		} finally {
			setLoading(null);
		}
	}

	async function scoreChapter(force = false) {
		if (!rubricResult) {
			setStatus("请先生成评分标准。");
			return;
		}

		const cacheKey = buildScoreCacheKey();
		if (!force) {
			const cached = scoreCache.find((item) => item.key === cacheKey);
			if (cached) {
				setScoreResult(cached.result);
				revealScoreProgress(cached.result);
				setStatus("已使用缓存的章节评分结果；如需让 AI 重新评分，请点“重新分析”。");
				return;
			}
		}

		setLoading("score");
		setScoreResult(null);
		initializeScoreProgress(rubricResult.rubric.metrics);
		setStatus("正在按评分标准质检你的章节...");
		try {
			const result = await requestScoreChapter({
				provider: providerPayload,
				rubric: rubricResult.rubric,
				platform,
				audience,
				readingMode,
				category,
				theme,
				tags,
				explicitKeywords,
				implicitExpectations,
				positioningPromise,
				recommendationSignals,
				competitionLevel,
				competitionNotes,
				pushStage,
				trafficEntry,
				chapterTitle,
				chapterText,
				aiSelfTestEnabled,
				enabledAiSelfTests,
				isAlgorithmPlatform,
				isShortFormReading,
				impressions,
				clickThroughRate,
				validReadRate,
				read30sRate,
				read60sRate,
				bottomRate,
				followRate,
				bookshelfRate,
				firstChapterCompletionRate,
				nextChapterClickRate,
				threeChapterRetentionRate,
				avgReadProgressRate,
				paidUnlockRate,
			});
			setScoreResult(result);
			rememberScore(cacheKey, result);
			revealScoreProgress(result);
			setStatus(`评分完成：${result.totalScore}/10`);
		} catch (error) {
			failCurrentScoreProgress();
			setStatus((error as Error).message);
		} finally {
			setLoading(null);
		}
	}

	async function runQuickExperience(force = false) {
		if (chapterText.trim().length < 50) {
			setStatus("请先粘贴至少 50 字章节正文，再运行快速点评。");
			return;
		}

		const cacheKey = buildQuickReviewCacheKey();
		if (!force) {
			const cached = quickReviewCache.find((item) => item.key === cacheKey);
			if (cached) {
				if (quickReviewResult) {
					setPreviousQuickReviewResult(quickReviewResult);
				}
				setQuickReviewResult(cached.result);
				setQuickReviewError(null);
				setStatus("已使用缓存的快速点评；如需让 AI 重新点评，请点“重新分析”。");
				return;
			}
		}

		const matchedExample =
			provider.kind === "mock" ? findDiagnosisExampleByChapterText(chapterText) : undefined;
		if (matchedExample?.result) {
			const result = matchedExample.result;
			if (quickReviewResult) {
				setPreviousQuickReviewResult(quickReviewResult);
			}
			setQuickReviewResult(result);
			setQuickReviewError(null);
			rememberQuickReview(cacheKey, result);
			rememberQuickReviewIteration(result);
			setStatus(`已载入示例诊断报告：${matchedExample.label}。`);
			return;
		}

		setLoading("quick");
		if (quickReviewResult) {
			setPreviousQuickReviewResult(quickReviewResult);
		}
		setQuickReviewResult(null);
		setQuickReviewError(null);
		setStatus("正在读取章节...");
		const queueStatusTimer = window.setTimeout(() => {
			setStatus(
				provider.preset === "shared-gpu"
					? "共享站可能正在排队，请继续等待..."
					: "正在等待你配置的模型返回结果...",
			);
		}, 10_000);
		try {
			setStatus("正在生成快速点评...");
			const result = await requestQuickReview({
				provider: providerPayload,
				chapterText,
				chapterTitle,
				quickReviewGenre,
				quickReviewInputKind,
				quickReviewPreviousPrompt,
			});
			setQuickReviewResult(result);
			rememberQuickReview(cacheKey, result);
			rememberQuickReviewIteration(result);
			setStatus(`快速点评完成：${result.quickScore}/10`);
		} catch (error) {
			const message = toQuickReviewErrorMessage(error);
			setStatus(message);
			setQuickReviewError(message);
			toast.error("诊断失败", { description: message });
		} finally {
			window.clearTimeout(queueStatusTimer);
			setLoading(null);
		}
	}

	async function analyzeBook(force = false) {
		const cacheKey = buildBookAnalysisCacheKey();
		if (!force) {
			const cached = bookAnalysisCache.find((item) => item.key === cacheKey);
			if (cached) {
				setBookJob(cached.job);
				if (cached.result) {
					setBookAnalysisResult(cached.result);
				}
				setStatus(
					cached.job.status === "succeeded"
						? "已使用缓存的整书拆解结果；如需让 AI 重新拆解，请点“重新拆解”。"
						: "已恢复这本书的历史任务，继续同步最新状态。",
				);
				if (cached.job.status === "queued" || cached.job.status === "running") {
					await followBookJob(cached.job.id, {
						background: true,
						silent: true,
						maxAttempts: 600,
					});
				}
				return;
			}
		}

		setLoading("book");
		setBookAnalysisResult(null);
		setBookJob(null);
		setStatus("正在准备上传文本并创建整书异步拆解任务...");
		try {
			const upload = bookUpload ?? (await uploadBookForPreview(false));
			if (!upload) {
				return;
			}
			const createdUploadJob = await createBookAnalysisJobFromUpload(
				upload.id,
				providerPayload,
			);
			setBookJob(createdUploadJob);
			rememberBookAnalysis(cacheKey, createdUploadJob, null);
			setStatus(`任务已创建：${createdUploadJob.id}`);

			await followBookJob(createdUploadJob.id);
		} catch (error) {
			setStatus((error as Error).message);
		} finally {
			setLoading(null);
		}
	}

	async function resumeBookAnalysis() {
		if (!bookJob?.id) {
			setStatus("请先打开一个可继续的整书任务。");
			return;
		}

		setLoading("book");
		setBookAnalysisResult(null);
		setStatus("正在从已完成章节继续整书拆解...");
		try {
			const resumedJob = await resumeBookAnalysisJob(bookJob.id, providerPayload);
			setBookJob(resumedJob);
			await followBookJob(resumedJob.id);
		} catch (error) {
			setStatus((error as Error).message);
		} finally {
			setLoading(null);
		}
	}

	async function followBookJob(
		jobId: string,
		options?: {
			background?: boolean;
			silent?: boolean;
			maxAttempts?: number;
		},
	) {
		if (activeBookPollJobIdRef.current === jobId) {
			return null;
		}

		activeBookPollJobIdRef.current = jobId;
		let latestSnapshot: BookAnalysisJob | null = null;
		let transientFetchFailures = 0;
		const maxTransientFetchFailures = options?.background ? 60 : 12;

		const readJobSnapshot = async (includeResult: boolean) => {
			try {
				const snapshot = await readBookAnalysisJob(jobId, includeResult);
				transientFetchFailures = 0;
				return snapshot;
			} catch (error) {
				if (!isTransientFetchError(error)) {
					throw error;
				}

				transientFetchFailures += 1;
				if (!options?.silent) {
					setStatus(
						transientFetchFailures === 1
							? "本地 API 连接暂时中断，正在自动重连..."
							: `本地 API 连接仍未恢复，正在第 ${transientFetchFailures} 次重试...`,
					);
				}

				if (transientFetchFailures >= maxTransientFetchFailures) {
					throw new Error(
						`${toBookPollingNetworkMessage(error)}。任务已保留，API 恢复后可从历史任务继续打开。`,
					);
				}

				return null;
			}
		};

		try {
			for (let attempt = 0; attempt < (options?.maxAttempts ?? 120); attempt += 1) {
				await wait(1000);
				const latestJob = await readJobSnapshot(false);
				if (!latestJob) {
					continue;
				}
				latestSnapshot = latestJob;
				setBookJob(latestJob);
				updateBookAnalysisCacheByJobId(jobId, latestJob);
				if (!options?.silent) {
					setStatus(latestJob.progress.message);
				}

				if (latestJob.status === "succeeded") {
					const completedJob = await readJobSnapshot(true);
					if (!completedJob) {
						continue;
					}
					setBookJob(completedJob);
					if (completedJob.result) {
						latestJob.result = completedJob.result;
						setBookAnalysisResult(completedJob.result);
						updateBookAnalysisCacheByJobId(jobId, completedJob);
						if (!options?.silent) {
							setStatus(
								`整书拆解完成：${latestJob.result.characters.length} 张角色卡，已分析 ${latestJob.result.mapReduce?.mapCount ?? 0} 个章节片段`,
							);
						}
					}
					return latestJob;
				}

				if (latestJob.status === "failed") {
					const failedJob = await readJobSnapshot(true);
					if (!failedJob) {
						continue;
					}
					setBookJob(failedJob);
					if (failedJob.result) {
						setBookAnalysisResult(failedJob.result);
						updateBookAnalysisCacheByJobId(jobId, failedJob);
						if (!options?.silent) {
							setStatus(
								failedJob.error
									? `${failedJob.error} ???????/??????`
									: "???????????????????????",
							);
						}
						return failedJob;
					}
					throw new Error(latestJob.error || "????????");
				}
			}

			if (latestSnapshot && !options?.silent) {
				setStatus("整书拆解仍在后台运行，刷新页面后也会自动恢复任务状态。");
			}
			return latestSnapshot;
		} finally {
			if (activeBookPollJobIdRef.current === jobId) {
				activeBookPollJobIdRef.current = null;
			}
		}
	}

	async function uploadBookForPreview(manageLoading = true) {
		const hasBookFile = Boolean(bookFile);
		const hasBookText = Boolean(bookText.trim());
		if (!hasBookFile && !hasBookText) {
			setStatus("请先上传 TXT 文件，或在文本框粘贴整书内容。");
			return null;
		}
		if (bookFile && bookFile.size === 0) {
			setStatus("这个 TXT 文件是空的，请换一个有正文内容的文件。");
			return null;
		}
		if (manageLoading) {
			setLoading("upload");
		}
		setBookAnalysisResult(null);
		setBookJob(null);
		setStatus("正在上传 TXT 并生成章节预览...");
		try {
			const upload = await uploadBookPreview({
				bookFile,
				bookText,
				bookTitle,
				bookGenre,
			});
			setBookUpload(upload);
			setStatus(`章节预览完成：${upload.chapterCount} 个章节片段`);
			return upload;
		} catch (error) {
			setStatus((error as Error).message);
			throw error;
		} finally {
			if (manageLoading) {
				setLoading(null);
			}
		}
	}

	async function loadHistory(options?: { silent?: boolean }) {
		if (!options?.silent) {
			setLoading("history");
			setStatus("正在加载历史任务...");
		}
		try {
			const { jobs, uploads } = await listBookHistory(10);
			setBookHistory(jobs);
			setUploadHistory(uploads);
			if (!options?.silent) {
				setStatus(`历史已加载：${jobs.length} 个任务，${uploads.length} 个上传`);
			}
		} catch (error) {
			if (!options?.silent) {
				setStatus((error as Error).message);
			}
		} finally {
			if (!options?.silent) {
				setLoading(null);
			}
		}
	}

	async function deleteHistoryJob(jobId: string) {
		const target = bookHistory.find((job) => job.id === jobId);
		const title = target?.inputSummary.title || jobId;
		if (!window.confirm(`删除历史任务「${title}」？删除后不能从历史记录恢复。`)) {
			return;
		}

		setLoading("history");
		setStatus("正在删除历史任务...");
		try {
			await deleteBookAnalysisJob(jobId);
			setBookHistory((current) => current.filter((job) => job.id !== jobId));
			setBookAnalysisCache((current) => current.filter((entry) => entry.job.id !== jobId));
			setSelectedResearchJobIds((current) =>
				current.filter((selectedJobId) => selectedJobId !== jobId),
			);
			if (bookJob?.id === jobId) {
				setBookJob(null);
				setBookAnalysisResult(null);
				setResearchComparison(null);
				setResearchQaResult(null);
			}
			setStatus(`已删除历史任务：${title}`);
		} catch (error) {
			setStatus((error as Error).message);
		} finally {
			setLoading(null);
		}
	}

	async function loadResearchLibrary() {
		setLoading("research");
		setStatus("正在读取本地研究库资产...");
		try {
			const result = await readResearchLibrary(50);
			setPersistedResearchLibrary(result);
			setSelectedResearchJobIds((current) => {
				const availableIds = new Set(
					result.comparisonSamples.map((sample) => sample.jobId),
				);
				const kept = current.filter((jobId) => availableIds.has(jobId));
				if (kept.length) {
					return kept;
				}

				return result.comparisonSamples.slice(0, 3).map((sample) => sample.jobId);
			});
			setStatus(
				`研究库已更新：${result.sourceSummary.completedBooks} 本完成样本，${result.graphAssets.length} 组图谱资产`,
			);
		} catch (error) {
			setStatus((error as Error).message);
		} finally {
			setLoading(null);
		}
	}

	function toggleResearchSample(jobId: string) {
		setSelectedResearchJobIds((current) =>
			current.includes(jobId)
				? current.filter((item) => item !== jobId)
				: [...current, jobId],
		);
	}

	async function runResearchComparison() {
		if (selectedResearchJobIds.length < 2) {
			setStatus("横向对比至少需要选择 2 本已完成样本。");
			return;
		}

		setLoading("compare");
		setStatus("正在对选中样本做多书横向对比...");
		try {
			const result = await compareResearchBooks(selectedResearchJobIds, comparisonFocus);
			setResearchComparison(result);
			setStatus(`已完成 ${result.sampleCount} 本样本横向对比。`);
		} catch (error) {
			setStatus((error as Error).message);
		} finally {
			setLoading(null);
		}
	}

	async function askResearchLibrary() {
		if (!researchQuestion.trim()) {
			setStatus("请先输入要问研究库的问题。");
			return;
		}

		setLoading("ask");
		setStatus("正在基于已拆解资料回答问题...");
		try {
			const result = await requestResearchQa({
				provider: providerPayload,
				question: researchQuestion,
				jobIds: selectedResearchJobIds.length ? selectedResearchJobIds : undefined,
			});
			setResearchQaResult(result);
			setStatus(`资料问答完成：引用 ${result.citations.length} 条资料证据。`);
		} catch (error) {
			setStatus((error as Error).message);
		} finally {
			setLoading(null);
		}
	}

	async function openHistoryJob(
		jobId: string,
		options?: { silent?: boolean; preserveLoading?: boolean },
	) {
		if (!options?.preserveLoading) {
			setLoading("history");
		}
		if (!options?.silent) {
			setStatus("正在打开历史结果...");
		}
		try {
			const job = await readBookAnalysisJob(jobId, true);
			setBookJob(job);
			if (job.result) {
				setBookAnalysisResult(job.result);
			}
			if (bookText.trim() || bookFile) {
				rememberBookAnalysis(buildBookAnalysisCacheKey(), job, job.result ?? null);
			}
			if (!options?.silent) {
				setStatus(`已打开任务：${job.status}`);
			}
		} catch (error) {
			if (!options?.silent) {
				setStatus((error as Error).message);
			}
		} finally {
			if (!options?.preserveLoading) {
				setLoading(null);
			}
		}
	}

	async function exportBookResult(format: BookExportFormat, mode: BookExportMode) {
		if (!bookJob?.id || !bookAnalysisResult) {
			setStatus("?????????????????");
			return;
		}

		setLoading("export");
		setStatus(mode === "originalized" ? "正在生成原创化导出文件..." : "正在生成导出文件...");
		try {
			const response = await fetch(
				apiUrl(`/analysis/book/jobs/${bookJob.id}/export?format=${format}&mode=${mode}`),
			);
			if (!response.ok) {
				const payload = (await response.json()) as ApiEnvelope<unknown>;
				throw new Error(payload.message || `Export failed: ${response.status}`);
			}
			const content = await response.text();
			const disposition = response.headers.get("content-disposition") || "";
			const filenameMatch = disposition.match(/filename\*=UTF-8''([^;]+)/);
			const filename = filenameMatch
				? decodeURIComponent(filenameMatch[1])
				: `book-analysis-${format}.txt`;
			downloadText(
				filename,
				content,
				response.headers.get("content-type") || "text/plain;charset=utf-8",
			);
			setStatus(`导出完成：${filename}`);
		} catch (error) {
			setStatus((error as Error).message);
		} finally {
			setLoading(null);
		}
	}

	async function readBookFile(file: File | undefined) {
		if (!file) {
			return;
		}

		setBookFile(file);
		setBookTitle(file.name.replace(/\.[^.]+$/, ""));
		setBookUpload(null);
		setBookAnalysisResult(null);
		setBookJob(null);

		if (file.size > LARGE_BOOK_INLINE_BYTES) {
			setBookText("");
			setStatus(
				`已选择大文件 ${file.name}（${formatFileSize(file.size)}）。为避免浏览器卡顿，不再展开全文，后续会直接上传并拆解。`,
			);
			return;
		}

		const text = await file.text();
		setBookText(text);
	}

	/* ──────────── inline handler wrappers ──────────── */

	function handleChapterTextChange(value: string) {
		chapterDraftTouchedRef.current = true;
		setChapterText(value);
	}

	function handleReferenceTextChange(value: string) {
		setReferenceText(value);
		setRubricResult(null);
		setScoreResult(null);
		resetReferenceProfileProgress();
		resetScoreProgress();
	}

	function handlePlatformStrategyChange(patch: {
		recommendationSignals?: string;
		trafficEntry?: string;
		competitionLevel?: string;
		pushStage?: string;
		competitionNotes?: string;
	}) {
		platformStrategyTouchedRef.current = true;
		if (patch.recommendationSignals !== undefined) {
			setRecommendationSignals(patch.recommendationSignals);
		}
		if (patch.trafficEntry !== undefined) {
			setTrafficEntry(patch.trafficEntry);
		}
		if (patch.competitionLevel !== undefined) {
			setCompetitionLevel(patch.competitionLevel);
		}
		if (patch.pushStage !== undefined) {
			setPushStage(patch.pushStage);
		}
		if (patch.competitionNotes !== undefined) {
			setCompetitionNotes(patch.competitionNotes);
		}
	}

	function handleChapterDraftChange(patch: { chapterTitle?: string; chapterText?: string }) {
		chapterDraftTouchedRef.current = true;
		if (patch.chapterTitle !== undefined) {
			setChapterTitle(patch.chapterTitle);
		}
		if (patch.chapterText !== undefined) {
			setChapterText(patch.chapterText);
		}
	}

	function handleCopyText(text: string, message: string) {
		void navigator.clipboard.writeText(text);
		setStatus(message);
	}

	/* ──────────── return ──────────── */

	return {
		/* navigation / UI */
		activeView,
		activeMeta,
		navItems,
		advancedNavItems,
		status,
		loading,

		/* project */
		projects,
		activeProjectId,
		activeProject,
		projectRevisionSessions,
		projectMethodologyCards,
		newProjectName,
		setNewProjectName,

		/* provider */
		provider,
		setProvider,
		providerPayload,
		selectedProviderPreset,
		providerModelOptions,
		selectedModelOption,
		isBackendFreeProvider,
		providerLabel,

		/* reference / profile */
		referenceTitle,
		setReferenceTitle,
		referenceText,
		setReferenceText,
		referenceFileName,
		genre,
		setGenre,
		category,
		setCategory,
		theme,
		setTheme,
		tags,
		setTags,
		explicitKeywords,
		setExplicitKeywords,
		implicitExpectations,
		setImplicitExpectations,
		positioningPromise,
		setPositioningPromise,
		referenceProfileProgress,
		referenceProfileApplied,

		/* platform */
		platform,
		audience,
		readingMode,
		platformLabel,
		audienceLabel,
		readingModeLabel,
		recommendationSignals,
		setRecommendationSignals,
		competitionLevel,
		setCompetitionLevel,
		competitionNotes,
		setCompetitionNotes,
		pushStage,
		setPushStage,
		trafficEntry,
		setTrafficEntry,
		isShortPaidReading,
		isShortFormReading,
		isLongSerialization,
		isAlgorithmPlatform,
		performanceSnapshotNote,

		/* chapter */
		chapterTitle,
		chapterText,
		chapterProjectSteps,
		chapterCompletion,
		nextChapterAction,

		/* quick review */
		quickReviewGenre,
		setQuickReviewGenre,
		quickReviewInputKind,
		setQuickReviewInputKind,
		quickReviewPreviousPrompt,
		setQuickReviewPreviousPrompt,
		quickReviewResult,
		previousQuickReviewResult,
		quickReviewElapsedSeconds,
		quickReviewError,
		quickReviewCacheHit,

		/* rubric / score */
		rubricResult,
		rubricCacheHit,
		scoreResult,
		scoreCacheHit,
		scoreEvidenceChain,

		/* book */
		bookTitle,
		setBookTitle,
		bookGenre,
		setBookGenre,
		bookText,
		setBookText,
		bookFile,
		bookUpload,
		bookJob,
		bookAnalysisResult,
		bookStatusText,
		bookCompletion,
		bookProgressDetail,
		bookAnalysisCacheHit,
		bookFileTooLargeForInlinePreview,
		bookHistory,
		uploadHistory,
		bookUtilityPanel,
		setBookUtilityPanel,

		/* research */
		researchGraph,
		graphNodeCount,
		graphEdgeCount,
		foreshadowingCount,
		evidenceScoreCount,
		comparableBookCount,
		comparisonSamples,
		researchPromptSeed,
		researchSourceCount,
		researchReadiness,
		researchSources,
		beginnerLearningDigest,

		/* handlers */
		openView,
		openBookUtility,
		switchProject,
		createProject,
		saveRevisionNote,
		exportProjectMarkdown,
		testProvider,
		applyProviderPreset,
		resetProviderSettings,
		useExampleChapter,
		useExampleReference,
		useExampleBook,
		runQuickExperience,
		buildRubric,
		scoreChapter,
		analyzeBook,
		resumeBookAnalysis,
		uploadBookForPreview,
		loadHistory,
		deleteHistoryJob,
		loadResearchLibrary,
		toggleResearchSample,
		runResearchComparison,
		askResearchLibrary,
		openHistoryJob,
		exportBookResult,
		readBookFile,
		importReferenceFile,
		inferReferenceProfileFromModel,
		handleChapterTextChange,
		handleReferenceTextChange,
		handlePlatformStrategyChange,
		handleChapterDraftChange,
		handleCopyText,

		/* option lists (for rendering) */
		competitionLevelOptions,
		pushStageOptions,
		platformOptions,
		audienceOptions,
		readingModeOptions,
		optionLabel,
		formatFileSize,
		diagnosisExampleOptions,
	};
}
