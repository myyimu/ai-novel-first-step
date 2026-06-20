export interface ApiEnvelope<T> {
	code: number;
	message: string;
	data: T;
}

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1";

export function apiUrl(path: string) {
	return `${API_BASE_URL}${path}`;
}

async function readApiEnvelope<T>(response: Response): Promise<ApiEnvelope<T> | null> {
	const contentType = response.headers.get("content-type") ?? "";
	if (!contentType.includes("application/json")) {
		return null;
	}

	try {
		return (await response.json()) as ApiEnvelope<T>;
	} catch {
		return null;
	}
}

function assertApiResponse<T>(
	response: Response,
	payload: ApiEnvelope<T> | null,
	fallbackMessage?: string,
): asserts payload is ApiEnvelope<T> {
	if (!response.ok || payload?.code !== 0) {
		throw new Error(
			payload?.message || fallbackMessage || `Request failed: ${response.status}`,
		);
	}
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
	const response = await fetch(apiUrl(path), {
		method: "POST",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify(body),
	});

	const payload = await readApiEnvelope<T>(response);
	assertApiResponse(response, payload);

	return payload.data;
}

export async function postForm<T>(path: string, body: FormData): Promise<T> {
	const response = await fetch(apiUrl(path), {
		method: "POST",
		body,
	});

	const payload = await readApiEnvelope<T>(response);

	if (!response.ok || payload?.code !== 0) {
		if (response.status === 413) {
			throw new Error("上传文件过大。当前单个 TXT 最多支持 50MB。");
		}
		throw new Error(payload?.message || `Request failed: ${response.status}`);
	}

	return payload.data;
}

export async function getJson<T>(path: string): Promise<T> {
	const response = await fetch(apiUrl(path));
	const payload = await readApiEnvelope<T>(response);
	assertApiResponse(response, payload);

	return payload.data;
}

export async function deleteJson<T>(path: string): Promise<T> {
	const response = await fetch(apiUrl(path), {
		method: "DELETE",
	});
	const payload = await readApiEnvelope<T>(response);
	assertApiResponse(response, payload);

	return payload.data;
}
