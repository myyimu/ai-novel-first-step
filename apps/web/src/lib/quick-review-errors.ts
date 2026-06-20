export function toQuickReviewErrorMessage(error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);
	const normalized = message.toLowerCase();

	if (
		normalized.includes("403") ||
		normalized.includes("kudos") ||
		normalized.includes("heavy demand") ||
		normalized.includes("429") ||
		normalized.includes("rate limit") ||
		normalized.includes("too many requests")
	) {
		return "当前模型服务正在限流或排队，请等 30 秒后再试。";
	}

	if (
		normalized.includes("503") ||
		normalized.includes("502") ||
		normalized.includes("504") ||
		normalized.includes("temporarily unavailable") ||
		normalized.includes("provider request failed")
	) {
		return "模型服务暂时繁忙，请稍后重试。";
	}

	if (
		normalized.includes("timed out") ||
		normalized.includes("timeout") ||
		normalized.includes("public workers may be busy")
	) {
		return "当前模型服务请求超时，请稍后重试；如果使用共享站，可能正在排队。";
	}

	if (
		normalized.includes("failed to fetch") ||
		normalized.includes("networkerror") ||
		normalized.includes("network")
	) {
		return "网络连接失败，请确认 API 服务已启动，然后重试。";
	}

	if (
		normalized.includes("json") ||
		normalized.includes("unexpected token") ||
		normalized.includes("extract")
	) {
		return "模型返回内容不完整，请重试一次。";
	}

	return message || "快速点评失败，请稍后重试。";
}
