import { useCallback, useEffect, useRef } from "react";
import type { ReferenceProfileResult } from "@/lib/workspace-analysis-client";
import type {
	ReferenceProfileProgressItem,
	ReferenceProfileProgressStepId,
	RubricMetric,
	ScoreProgressItem,
	ScoreResult,
} from "@/stores/workspace-store";

type StoreSetter<T> = (value: T | ((current: T) => T)) => void;

export interface ReferenceProfileFactsSource {
	title: string;
	genre: string;
	category: string;
	theme: string;
	tags: string | string[];
	explicitKeywords: string | string[];
	implicitExpectations: string | string[];
	positioningPromise: string;
}

export function useScoreProgressController(setScoreProgress: StoreSetter<ScoreProgressItem[]>) {
	const scoreProgressTimersRef = useRef<number[]>([]);

	const clearScoreProgressTimers = useCallback(() => {
		scoreProgressTimersRef.current.forEach((timer) => window.clearTimeout(timer));
		scoreProgressTimersRef.current = [];
	}, []);

	useEffect(() => {
		return () => clearScoreProgressTimers();
	}, [clearScoreProgressTimers]);

	const resetScoreProgress = useCallback(() => {
		clearScoreProgressTimers();
		setScoreProgress([]);
	}, [clearScoreProgressTimers, setScoreProgress]);

	const initializeScoreProgress = useCallback(
		(metrics: RubricMetric[]) => {
			clearScoreProgressTimers();
			setScoreProgress(
				metrics.map((metric, index) => ({
					metricId: metric.id,
					name: metric.name,
					status: index === 0 ? "checking" : "pending",
				})),
			);
		},
		[clearScoreProgressTimers, setScoreProgress],
	);

	const revealScoreProgress = useCallback(
		(result: ScoreResult) => {
			clearScoreProgressTimers();
			setScoreProgress(
				result.scores.map((score, index) => ({
					metricId: score.metricId,
					name: score.name,
					status: index === 0 ? "checking" : "pending",
				})),
			);

			result.scores.forEach((score, index) => {
				const timer = window.setTimeout(
					() => {
						setScoreProgress((current) =>
							current.map((item, itemIndex) => {
								if (item.metricId === score.metricId) {
									return {
										...item,
										status: "completed",
										score: score.score,
										reason: score.reason,
										evidence: score.evidence,
										fix: score.fix,
									};
								}

								if (itemIndex === index + 1 && item.status === "pending") {
									return { ...item, status: "checking" };
								}

								return item;
							}),
						);
					},
					200 + index * 320,
				);
				scoreProgressTimersRef.current.push(timer);
			});
		},
		[clearScoreProgressTimers, setScoreProgress],
	);

	const failCurrentScoreProgress = useCallback(() => {
		clearScoreProgressTimers();
		setScoreProgress((current) =>
			current.map((item) =>
				item.status === "checking" ? { ...item, status: "failed" } : item,
			),
		);
	}, [clearScoreProgressTimers, setScoreProgress]);

	return {
		resetScoreProgress,
		initializeScoreProgress,
		revealScoreProgress,
		failCurrentScoreProgress,
	};
}

export function useReferenceProfileProgressController(
	setReferenceProfileProgress: StoreSetter<ReferenceProfileProgressItem[]>,
) {
	const resetReferenceProfileProgress = useCallback(() => {
		setReferenceProfileProgress([]);
	}, [setReferenceProfileProgress]);

	const initializeReferenceProfileProgress = useCallback(() => {
		setReferenceProfileProgress([
			{
				id: "sample",
				name: "准备识别样本",
				status: "checking",
				detail: "长文本会抽取开头和结尾，减少等待时间。",
			},
			{
				id: "model",
				name: "AI 校准市场定位",
				status: "pending",
				detail: "等待模型识别分类、主题、标签和读者期待。",
			},
			{
				id: "apply",
				name: "写入画像字段",
				status: "pending",
				detail: "把识别结果同步到下面可修改的字段。",
			},
		]);
	}, [setReferenceProfileProgress]);

	const updateReferenceProfileProgress = useCallback(
		(
			id: ReferenceProfileProgressStepId,
			patch: Partial<Omit<ReferenceProfileProgressItem, "id" | "name">>,
		) => {
			setReferenceProfileProgress((current) =>
				current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
			);
		},
		[setReferenceProfileProgress],
	);

	return {
		resetReferenceProfileProgress,
		initializeReferenceProfileProgress,
		updateReferenceProfileProgress,
	};
}

export function buildReferenceProfileFacts(
	profile: ReferenceProfileFactsSource | ReferenceProfileResult,
): ReferenceProfileProgressItem["facts"] {
	const isModelProfile = "referenceTitle" in profile;
	const title = isModelProfile ? profile.referenceTitle : profile.title;
	const facts = [
		{ label: "标题", value: title },
		{ label: "题材", value: profile.genre },
		{ label: "细分分类", value: profile.category },
		{ label: "主题承诺", value: profile.theme },
		{
			label: "标签",
			value: Array.isArray(profile.tags) ? profile.tags.join("、") : profile.tags,
		},
		{
			label: "显性关键词",
			value: Array.isArray(profile.explicitKeywords)
				? profile.explicitKeywords.join("、")
				: profile.explicitKeywords,
		},
		{
			label: "隐性期待",
			value: Array.isArray(profile.implicitExpectations)
				? profile.implicitExpectations.join("、")
				: profile.implicitExpectations,
		},
		{ label: "标题/简介承诺", value: profile.positioningPromise },
	].filter((item) => item.value);

	if (isModelProfile && typeof profile.confidence === "number") {
		facts.push({
			label: "置信度",
			value: `${Math.round(profile.confidence * 100)}%`,
		});
	}

	if (isModelProfile && profile.evidence?.length) {
		facts.push({
			label: "识别证据",
			value: profile.evidence.join("；"),
		});
	}

	return facts;
}
