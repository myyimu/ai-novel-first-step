import { describe, expect, it } from "vitest";
import type { WorkspaceStore, WorkspaceStoreState } from "./workspace-store";
import { mergeWorkspaceState, partializeWorkspaceState } from "./workspace-store";

function createState(overrides: Partial<WorkspaceStoreState> = {}): WorkspaceStoreState {
	return {
		provider: {
			preset: "shared-gpu",
			kind: "openai-compatible",
			baseUrl: "",
			apiKey: "",
			model: "",
			temperature: 0.2,
			jsonMode: false,
		},
		referenceTitle: "",
		genre: "xuanhuan",
		platform: "fanqie",
		audience: "male-fast-paced",
		readingMode: "mobile-fragmented",
		category: "",
		theme: "",
		tags: "",
		explicitKeywords: "",
		implicitExpectations: "",
		positioningPromise: "",
		recommendationSignals: "",
		competitionLevel: "high",
		competitionNotes: "",
		pushStage: "cold-start",
		trafficEntry: "",
		impressions: "",
		clickThroughRate: "",
		validReadRate: "",
		read30sRate: "",
		read60sRate: "",
		bottomRate: "",
		followRate: "",
		bookshelfRate: "",
		firstChapterCompletionRate: "",
		nextChapterClickRate: "",
		threeChapterRetentionRate: "",
		avgReadProgressRate: "",
		paidUnlockRate: "",
		aiSelfTestEnabled: false,
		enabledAiSelfTests: [],
		referenceText: "",
		referenceFileName: "",
		chapterTitle: "",
		chapterText: "",
		quickReviewGenre: "",
		rubricResult: null,
		scoreResult: null,
		quickReviewResult: null,
		referenceProfileProgress: [],
		scoreProgress: [],
		bookTitle: "",
		bookGenre: "xuanhuan",
		bookText: "",
		bookFile: null,
		bookUpload: null,
		bookHistory: [],
		uploadHistory: [],
		bookAnalysisResult: null,
		bookJob: null,
		persistedResearchLibrary: null,
		selectedResearchJobIds: [],
		comparisonFocus: "",
		researchComparison: null,
		researchQuestion: "",
		researchQaResult: null,
		quickReviewCache: [],
		rubricCache: [],
		scoreCache: [],
		bookAnalysisCache: [],
		...overrides,
	};
}

describe("workspace store persistence", () => {
	it("persists only lightweight book job data needed after refresh", () => {
		const partialized = partializeWorkspaceState(
			createState({
				bookTitle: "测试长篇",
				bookText: "very large book text",
				bookJob: {
					id: "job-1",
					type: "book-map-reduce-analysis",
					status: "running",
					inputSummary: {
						title: "测试长篇",
						genre: "xuanhuan",
						textLength: 12000,
					},
					progress: {
						stage: "map",
						current: 3,
						total: 10,
						message: "正在拆解第 3 章",
					},
					result: {
						mode: "book-asset-analysis",
						book: {
							title: "测试长篇",
							genre: "xuanhuan",
							chapterCountEstimate: 10,
							oneSentencePremise: "premise",
							coreAppeal: ["appeal"],
						},
						worldbuilding: {
							worldRules: [],
							powerSystem: [],
							locations: [],
							factions: [],
							itemsAndTerms: [],
						},
						characters: [],
						relationships: { nodes: [], edges: [] },
						plotlines: [],
						chronicle: [],
						historyBook: {
							ancientHistory: [],
							recentHistory: [],
							publicMyths: [],
							hiddenTruths: [],
						},
						exportPackage: {
							tavernCharacterCards: [],
							worldBookEntries: [],
							writingConstraints: [],
							doNotCopyList: [],
						},
						originalizationReport: {
							riskLevel: "low",
							safeToLearn: [],
							mustTransform: [],
							fanFictionWarning: "",
							rewriteStrategy: [],
						},
					},
				},
			}),
		);

		expect(partialized.bookTitle).toBe("测试长篇");
		expect(partialized.bookJob?.id).toBe("job-1");
		expect(partialized.bookJob?.result).toBeUndefined();
		expect("bookHistory" in partialized).toBe(false);
		expect("bookText" in partialized).toBe(false);
		expect("bookFile" in partialized).toBe(false);
	});

	it("strips heavy cached book results before persisting", () => {
		const partialized = partializeWorkspaceState(
			createState({
				bookAnalysisCache: [
					{
						key: "book-1",
						updatedAt: "2026-06-20T00:00:00.000Z",
						bookTitle: "测试长篇",
						job: {
							id: "job-1",
							type: "book-map-reduce-analysis",
							status: "succeeded",
							inputSummary: {
								title: "测试长篇",
								genre: "xuanhuan",
								textLength: 12000,
							},
							progress: {
								stage: "succeeded",
								current: 10,
								total: 10,
								message: "done",
							},
							result: {
								mode: "book-asset-analysis",
								book: {
									title: "测试长篇",
									genre: "xuanhuan",
									chapterCountEstimate: 10,
									oneSentencePremise: "premise",
									coreAppeal: ["appeal"],
								},
								worldbuilding: {
									worldRules: [],
									powerSystem: [],
									locations: [],
									factions: [],
									itemsAndTerms: [],
								},
								characters: [],
								relationships: { nodes: [], edges: [] },
								plotlines: [],
								chronicle: [],
								historyBook: {
									ancientHistory: [],
									recentHistory: [],
									publicMyths: [],
									hiddenTruths: [],
								},
								exportPackage: {
									tavernCharacterCards: [],
									worldBookEntries: [],
									writingConstraints: [],
									doNotCopyList: [],
								},
								originalizationReport: {
									riskLevel: "low",
									safeToLearn: [],
									mustTransform: [],
									fanFictionWarning: "",
									rewriteStrategy: [],
								},
							},
						},
						result: {
							mode: "book-asset-analysis",
							book: {
								title: "测试长篇",
								genre: "xuanhuan",
								chapterCountEstimate: 10,
								oneSentencePremise: "premise",
								coreAppeal: ["appeal"],
							},
							worldbuilding: {
								worldRules: [],
								powerSystem: [],
								locations: [],
								factions: [],
								itemsAndTerms: [],
							},
							characters: [],
							relationships: { nodes: [], edges: [] },
							plotlines: [],
							chronicle: [],
							historyBook: {
								ancientHistory: [],
								recentHistory: [],
								publicMyths: [],
								hiddenTruths: [],
							},
							exportPackage: {
								tavernCharacterCards: [],
								worldBookEntries: [],
								writingConstraints: [],
								doNotCopyList: [],
							},
							originalizationReport: {
								riskLevel: "low",
								safeToLearn: [],
								mustTransform: [],
								fanFictionWarning: "",
								rewriteStrategy: [],
							},
						},
					},
				],
			}),
		);

		expect(partialized.bookAnalysisCache).toHaveLength(1);
		expect(partialized.bookAnalysisCache[0]?.result).toBeNull();
		expect(partialized.bookAnalysisCache[0]?.job.result).toBeUndefined();
	});

	it("merges persisted data while resetting non-serializable file references", () => {
		const merged = mergeWorkspaceState(
			{
				provider: {
					preset: "deepseek",
					kind: "openai-compatible",
					baseUrl: "https://api.deepseek.com/v1",
					apiKey: "sk-test",
					model: "deepseek-chat",
					temperature: 0.2,
					jsonMode: false,
				},
				bookJob: {
					id: "job-2",
					type: "book-map-reduce-analysis",
					status: "queued",
					inputSummary: {
						title: "恢复任务",
						genre: "romance",
						textLength: 9000,
					},
					progress: {
						stage: "queued",
						current: 0,
						total: 1,
						message: "排队中",
					},
				},
			},
			createState({
				bookFile: {} as File,
			}) as WorkspaceStore,
		);

		expect(merged.provider.preset).toBe("deepseek");
		expect(merged.bookJob?.id).toBe("job-2");
		expect(merged.bookFile).toBeNull();
	});
});
