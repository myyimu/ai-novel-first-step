import type { NextRequest } from "next/server";

const HOP_BY_HOP_HEADERS = new Set([
	"connection",
	"content-length",
	"keep-alive",
	"proxy-authenticate",
	"proxy-authorization",
	"te",
	"trailer",
	"transfer-encoding",
	"upgrade",
]);

type RouteContext = {
	params: Promise<{
		path: string[];
	}>;
};

type ProxyRequestInit = RequestInit & {
	duplex?: "half";
};

function getApiBaseUrl() {
	return (process.env.API_INTERNAL_BASE_URL ?? "http://localhost:3001/api/v1").replace(
		/\/+$/,
		"",
	);
}

function createProxyHeaders(request: NextRequest) {
	const headers = new Headers(request.headers);
	for (const name of HOP_BY_HOP_HEADERS) {
		headers.delete(name);
	}
	headers.set("x-forwarded-host", request.headers.get("host") ?? "");
	headers.set("x-forwarded-proto", request.nextUrl.protocol.replace(":", ""));
	return headers;
}

function createResponseHeaders(headers: Headers) {
	const responseHeaders = new Headers(headers);
	for (const name of HOP_BY_HOP_HEADERS) {
		responseHeaders.delete(name);
	}
	return responseHeaders;
}

async function proxy(request: NextRequest, context: RouteContext) {
	const { path } = await context.params;
	const upstreamUrl = new URL(`${getApiBaseUrl()}/${path.map(encodeURIComponent).join("/")}`);
	upstreamUrl.search = request.nextUrl.search;

	const hasBody = request.method !== "GET" && request.method !== "HEAD";
	const init: ProxyRequestInit = {
		method: request.method,
		headers: createProxyHeaders(request),
		redirect: "manual",
		body: hasBody ? request.body : undefined,
		duplex: hasBody ? "half" : undefined,
	};

	const response = await fetch(upstreamUrl, init);
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: createResponseHeaders(response.headers),
	});
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
