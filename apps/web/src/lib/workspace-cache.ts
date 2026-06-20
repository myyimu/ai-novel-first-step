import type {
	BookAnalysisJob,
	BookAnalysisResult,
	CachedBookAnalysis,
	CachedQuickReview,
	CachedRubricResult,
	CachedScoreResult,
	ProviderForm,
	QuickReviewResult,
	RubricResult,
	ScoreResult,
} from "@/stores/workspace-store";

export function hashString(value: string): string {
	let hash = 0;
	for (let index = 0; index < value.length; index += 1) {
		hash = (hash << 5) - hash + value.charCodeAt(index);
		hash |= 0;
	}

	return String(hash);
}

export function upsertCacheEntry<T extends { key: string; updatedAt: string }>(
	items: T[],
	entry: T,
	limit = 20,
) {
	return [entry, ...items.filter((item) => item.key !== entry.key)].slice(0, limit);
}

export function buildProviderCacheFingerprint(provider: ProviderForm) {
	return [provider.preset, provider.baseUrl, provider.model, provider.kind].join("|");
}

export function buildQuickReviewCacheKey({
	provider,
	quickReviewGenre,
	chapterTitle,
	chapterText,
}: {
	provider: ProviderForm;
	quickReviewGenre: string;
	chapterTitle: string;
	chapterText: string;
}) {
	return [
		buildProviderCacheFingerprint(provider),
		quickReviewGenre || "auto",
		chapterTitle.trim(),
		hashString(chapterText.trim()),
	].join("|");
}

export function buildReferenceProfileCacheKey({
	provider,
	platform,
	audience,
	readingMode,
	referenceTitle,
	sampledText,
}: {
	provider: ProviderForm;
	platform: string;
	audience: string;
	readingMode: string;
	referenceTitle: string;
	sampledText: string;
}) {
	return [
		buildProviderCacheFingerprint(provider),
		platform,
		audience,
		readingMode,
		referenceTitle.trim(),
		hashString(sampledText),
	].join("|");
}

export function buildRubricCacheKey({
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
	return [
		buildProviderCacheFingerprint(provider),
		referenceTitle.trim(),
		genre,
		platform,
		audience,
		readingMode,
		category.trim(),
		theme.trim(),
		tags.trim(),
		explicitKeywords.trim(),
		implicitExpectations.trim(),
		positioningPromise.trim(),
		recommendationSignals.trim(),
		competitionLevel,
		competitionNotes.trim(),
		pushStage,
		trafficEntry.trim(),
		hashString(referenceText.trim()),
	].join("|");
}

export function buildScoreCacheKey({
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
	performanceValues,
}: {
	provider: ProviderForm;
	rubricResult: RubricResult | null;
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
	performanceValues: string[];
}) {
	return [
		buildProviderCacheFingerprint(provider),
		rubricResult?.rubric.id || "",
		hashString(JSON.stringify(rubricResult?.rubric ?? {})),
		platform,
		audience,
		readingMode,
		category.trim(),
		theme.trim(),
		tags.trim(),
		explicitKeywords.trim(),
		implicitExpectations.trim(),
		positioningPromise.trim(),
		recommendationSignals.trim(),
		competitionLevel,
		competitionNotes.trim(),
		pushStage,
		trafficEntry.trim(),
		chapterTitle.trim(),
		hashString(chapterText.trim()),
		aiSelfTestEnabled ? enabledAiSelfTests.join(",") : "self-test-off",
		performanceValues.join("|"),
	].join("|");
}

export function buildBookAnalysisCacheKey({
	provider,
	bookGenre,
	bookTitle,
	bookText,
	bookFile,
}: {
	provider: ProviderForm;
	bookGenre: string;
	bookTitle: string;
	bookText: string;
	bookFile: File | null;
}) {
	const bookFingerprint = bookFile
		? [bookFile.name, bookFile.size, bookFile.lastModified].join(":")
		: hashString(bookText.trim());

	return [
		buildProviderCacheFingerprint(provider),
		bookGenre,
		bookTitle.trim(),
		bookFingerprint,
	].join("|");
}

export function createQuickReviewCacheEntry({
	key,
	chapterTitle,
	quickReviewGenre,
	result,
}: {
	key: string;
	chapterTitle: string;
	quickReviewGenre: string;
	result: QuickReviewResult;
}): CachedQuickReview {
	return {
		key,
		updatedAt: new Date().toISOString(),
		title: chapterTitle.trim() || result.title || "未命名章节",
		genre: quickReviewGenre || result.genre || "other",
		result,
	};
}

export function createRubricCacheEntry({
	key,
	referenceTitle,
	result,
}: {
	key: string;
	referenceTitle: string;
	result: RubricResult;
}): CachedRubricResult {
	return {
		key,
		updatedAt: new Date().toISOString(),
		referenceTitle: referenceTitle.trim() || result.reference.title || "未命名参考章节",
		result,
	};
}

export function createScoreCacheEntry({
	key,
	chapterTitle,
	result,
}: {
	key: string;
	chapterTitle: string;
	result: ScoreResult;
}): CachedScoreResult {
	return {
		key,
		updatedAt: new Date().toISOString(),
		chapterTitle: chapterTitle.trim() || result.chapterTitle || "未命名章节",
		result,
	};
}

export function createBookAnalysisCacheEntry({
	key,
	bookTitle,
	job,
	result,
}: {
	key: string;
	bookTitle: string;
	job: BookAnalysisJob;
	result: BookAnalysisResult | null;
}): CachedBookAnalysis {
	return {
		key,
		updatedAt: new Date().toISOString(),
		bookTitle: bookTitle.trim() || job.inputSummary.title || "未命名长篇",
		job,
		result,
	};
}

export function updateCachedBookAnalysisByJobId(
	current: CachedBookAnalysis[],
	jobId: string,
	job: BookAnalysisJob,
) {
	const matched = current.find((item) => item.job.id === jobId);
	if (!matched) {
		return current;
	}

	return upsertCacheEntry(current, {
		...matched,
		updatedAt: new Date().toISOString(),
		job,
		result: job.result ?? matched.result,
	});
}
