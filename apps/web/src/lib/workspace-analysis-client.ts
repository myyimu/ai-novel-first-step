import { deleteJson, getJson, patchJson, postForm, postJson } from "@/lib/api-client";
import type {
	BookAnalysisJob,
	BookUploadPreview,
	PersistedResearchLibrary,
	ProjectMethodologyCard,
	ProviderForm,
	QuickReviewInputKind,
	QuickReviewResult,
	ResearchComparisonResult,
	ResearchQaResult,
	RevisionSession,
	RubricResult,
	ScoreResult,
	WorkspaceProject,
} from "@/stores/workspace-store";

export const REFERENCE_TEXT_MAX_LENGTH = 30000;
export const CHAPTER_TEXT_MAX_LENGTH = 30000;

export interface ReferenceProfileResult {
	mode: string;
	referenceTitle: string;
	genre: string;
	category: string;
	theme: string;
	tags: string[];
	explicitKeywords: string[];
	implicitExpectations: string[];
	positioningPromise: string;
	confidence?: number;
	evidence?: string[];
	notes?: string;
}

export function parseList(value: string): string[] {
	return value
		.split(/[,，\n]/)
		.map((item) => item.trim())
		.filter(Boolean);
}

export function parseOptionalNumber(value: string): number | undefined {
	if (!value.trim()) {
		return undefined;
	}

	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

export function compactReferenceText(text: string, maxLength = REFERENCE_TEXT_MAX_LENGTH): string {
	const normalized = text.trim();
	if (normalized.length <= maxLength) {
		return normalized;
	}

	const marker = "\n\n……中间内容已省略，用于满足单次参考章节分析长度限制……\n\n";
	const contentBudget = Math.max(0, maxLength - marker.length);
	const headLength = Math.floor(contentBudget * 0.72);
	const tailLength = contentBudget - headLength;

	return `${normalized.slice(0, headLength)}${marker}${normalized.slice(-tailLength)}`;
}

export function compactChapterText(text: string, maxLength = CHAPTER_TEXT_MAX_LENGTH): string {
	const normalized = text.trim();
	if (normalized.length <= maxLength) {
		return normalized;
	}

	const marker = "\n\n……中间内容已省略，用于满足单次章节分析长度限制……\n\n";
	const contentBudget = Math.max(0, maxLength - marker.length);
	const headLength = Math.floor(contentBudget * 0.8);
	const tailLength = contentBudget - headLength;

	return `${normalized.slice(0, headLength)}${marker}${normalized.slice(-tailLength)}`;
}

export function testProviderConnection(provider: ProviderForm) {
	return postJson<Record<string, unknown>>("/analysis/provider/test", {
		provider,
	});
}

export function testProviderConnectionWithTimeout(provider: ProviderForm, timeoutMs?: number) {
	return postJson<Record<string, unknown>>(
		"/analysis/provider/test",
		{
			provider,
		},
		{
			timeoutMs,
		},
	);
}

export function listProviderModels(provider: ProviderForm, timeoutMs?: number) {
	return postJson<{ models: string[] }>(
		"/analysis/provider/models",
		{
			provider,
		},
		{
			timeoutMs,
		},
	);
}

export function requestReferenceProfile({
	provider,
	referenceTitle,
	platform,
	audience,
	readingMode,
	referenceText,
}: {
	provider: ProviderForm;
	referenceTitle: string;
	platform: string;
	audience: string;
	readingMode: string;
	referenceText: string;
}) {
	return postJson<ReferenceProfileResult>("/analysis/reference/profile", {
		provider,
		referenceTitle,
		platform,
		audience,
		readingMode,
		referenceText,
	});
}

export function requestRubric({
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
}: {
	provider: ProviderForm;
	referenceTitle: string;
	genre: string;
	platform: string;
	audience: string;
	readingMode: string;
	category: string;
	theme: string;
	tags: string;
	explicitKeywords: string;
	implicitExpectations: string;
	positioningPromise: string;
	recommendationSignals: string;
	competitionLevel: string;
	competitionNotes: string;
	pushStage: string;
	trafficEntry: string;
	referenceText: string;
}) {
	const compactedReferenceText = compactReferenceText(referenceText);

	return postJson<RubricResult>("/analysis/rubric", {
		provider,
		referenceTitle,
		genre,
		platform,
		audience,
		readingMode,
		category,
		theme,
		tags: parseList(tags),
		explicitKeywords: parseList(explicitKeywords),
		implicitExpectations: parseList(implicitExpectations),
		positioningPromise,
		recommendationSignals: parseList(recommendationSignals),
		competitionLevel,
		competitionNotes,
		pushStage,
		trafficEntry: parseList(trafficEntry),
		referenceText: compactedReferenceText,
	});
}

export function requestScoreChapter({
	provider,
	rubric,
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
}: {
	provider: ProviderForm;
	rubric: RubricResult["rubric"];
	platform: string;
	audience: string;
	readingMode: string;
	category: string;
	theme: string;
	tags: string;
	explicitKeywords: string;
	implicitExpectations: string;
	positioningPromise: string;
	recommendationSignals: string;
	competitionLevel: string;
	competitionNotes: string;
	pushStage: string;
	trafficEntry: string;
	chapterTitle: string;
	chapterText: string;
	aiSelfTestEnabled: boolean;
	enabledAiSelfTests: string[];
	isAlgorithmPlatform: boolean;
	isShortFormReading: boolean;
	impressions: string;
	clickThroughRate: string;
	validReadRate: string;
	read30sRate: string;
	read60sRate: string;
	bottomRate: string;
	followRate: string;
	bookshelfRate: string;
	firstChapterCompletionRate: string;
	nextChapterClickRate: string;
	threeChapterRetentionRate: string;
	avgReadProgressRate: string;
	paidUnlockRate: string;
}) {
	const compactedChapterText = compactChapterText(chapterText);

	return postJson<ScoreResult>("/analysis/score", {
		provider,
		rubric,
		platform,
		audience,
		readingMode,
		category,
		theme,
		tags: parseList(tags),
		explicitKeywords: parseList(explicitKeywords),
		implicitExpectations: parseList(implicitExpectations),
		positioningPromise,
		recommendationSignals: parseList(recommendationSignals),
		competitionLevel,
		competitionNotes,
		pushStage,
		trafficEntry: parseList(trafficEntry),
		chapterTitle,
		chapterText: compactedChapterText,
		aiSelfTest: {
			enabled: aiSelfTestEnabled && enabledAiSelfTests.length > 0,
			tests: enabledAiSelfTests,
		},
		performanceSnapshot: {
			impressions: parseOptionalNumber(impressions),
			clickThroughRate: parseOptionalNumber(clickThroughRate),
			validReadRate: isAlgorithmPlatform ? parseOptionalNumber(validReadRate) : undefined,
			read30sRate: parseOptionalNumber(read30sRate),
			read60sRate: parseOptionalNumber(read60sRate),
			bottomRate: parseOptionalNumber(bottomRate),
			followRate: isShortFormReading ? undefined : parseOptionalNumber(followRate),
			bookshelfRate: parseOptionalNumber(bookshelfRate),
			firstChapterCompletionRate: parseOptionalNumber(firstChapterCompletionRate),
			nextChapterClickRate: isShortFormReading
				? undefined
				: parseOptionalNumber(nextChapterClickRate),
			threeChapterRetentionRate: isShortFormReading
				? undefined
				: parseOptionalNumber(threeChapterRetentionRate),
			avgReadProgressRate: isShortFormReading
				? parseOptionalNumber(avgReadProgressRate)
				: undefined,
			paidUnlockRate: isShortFormReading ? parseOptionalNumber(paidUnlockRate) : undefined,
		},
	});
}

export function requestQuickReview({
	provider,
	chapterText,
	chapterTitle,
	quickReviewGenre,
	quickReviewInputKind,
	quickReviewPreviousPrompt,
}: {
	provider: ProviderForm;
	chapterText: string;
	chapterTitle: string;
	quickReviewGenre: string;
	quickReviewInputKind?: QuickReviewInputKind;
	quickReviewPreviousPrompt?: string;
}) {
	const compactedChapterText = compactChapterText(chapterText);

	return postJson<QuickReviewResult>("/analysis/quick-review", {
		provider,
		chapterText: compactedChapterText,
		title: chapterTitle || undefined,
		genre: quickReviewGenre || undefined,
		inputKind: quickReviewInputKind || undefined,
		previousPrompt: quickReviewPreviousPrompt?.trim() || undefined,
	});
}

export interface WorkspaceAssetsPayload {
	projects: WorkspaceProject[];
	revisionSessions: RevisionSession[];
	methodologyCards: ProjectMethodologyCard[];
}

export function readWorkspaceAssets() {
	return getJson<WorkspaceAssetsPayload>("/analysis/workspace/assets");
}

export function upsertWorkspaceProject(project: WorkspaceProject) {
	return postJson<WorkspaceProject>("/analysis/workspace/projects", {
		project,
	});
}

export function upsertRevisionAssets({
	project,
	session,
	methodologyCards,
}: {
	project: WorkspaceProject;
	session: RevisionSession;
	methodologyCards: ProjectMethodologyCard[];
}) {
	return postJson<WorkspaceAssetsPayload>("/analysis/workspace/revision-assets", {
		project,
		session,
		methodologyCards,
	});
}

export function updateRevisionSessionNote({
	sessionId,
	note,
	updatedAt,
}: {
	sessionId: string;
	note: string;
	updatedAt: string;
}) {
	return patchJson<RevisionSession>(`/analysis/workspace/revision-sessions/${sessionId}/note`, {
		note,
		updatedAt,
	});
}

export function uploadBookPreview({
	bookFile,
	bookText,
	bookTitle,
	bookGenre,
}: {
	bookFile: File | null;
	bookText: string;
	bookTitle: string;
	bookGenre: string;
}) {
	const formData = new FormData();
	const file =
		bookFile ??
		new File([bookText], `${bookTitle || "novel"}.txt`, {
			type: "text/plain",
		});
	formData.append("file", file);
	formData.append("title", bookTitle);
	formData.append("genre", bookGenre);

	return postForm<BookUploadPreview>("/analysis/book/uploads", formData);
}

export function createBookAnalysisJobFromUpload(uploadId: string, provider: ProviderForm) {
	return postJson<BookAnalysisJob>(`/analysis/book/uploads/${uploadId}/jobs`, {
		provider,
	});
}

export function resumeBookAnalysisJob(jobId: string, provider: ProviderForm) {
	return postJson<BookAnalysisJob>(`/analysis/book/jobs/${jobId}/resume`, {
		provider,
	});
}

export function readBookAnalysisJob(jobId: string, includeResult: boolean) {
	return getJson<BookAnalysisJob>(
		`/analysis/book/jobs/${jobId}?includeResult=${includeResult ? "true" : "false"}`,
	);
}

export function deleteBookAnalysisJob(jobId: string) {
	return deleteJson<{ deleted: true; jobId: string }>(`/analysis/book/jobs/${jobId}`);
}

export async function listBookHistory(limit = 10) {
	const [jobs, uploads] = await Promise.all([
		getJson<BookAnalysisJob[]>(`/analysis/book/jobs?limit=${limit}`),
		getJson<BookUploadPreview[]>(`/analysis/book/uploads?limit=${limit}`),
	]);

	return { jobs, uploads };
}

export function readResearchLibrary(limit = 50) {
	return getJson<PersistedResearchLibrary>(`/analysis/research/library?limit=${limit}`);
}

export function compareResearchBooks(jobIds: string[], focus: string) {
	return postJson<ResearchComparisonResult>("/analysis/research/compare", {
		jobIds,
		focus,
		includePromptSeed: true,
	});
}

export function askResearchLibrary({
	provider,
	question,
	jobIds,
}: {
	provider: ProviderForm;
	question: string;
	jobIds?: string[];
}) {
	return postJson<ResearchQaResult>("/analysis/research/ask", {
		provider,
		question,
		jobIds,
		answerMode: "beginner",
	});
}
