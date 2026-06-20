import axios, { type AxiosInstance, type AxiosResponse } from "axios";

// --- 1. 定义 API 响应和错误结构 ---

// API 响应的基础结构
interface BaseResponse<T> {
	code: string | number;
	msg?: string;
	message?: string;
	data: T;
}

// 自定义业务错误类
export class ApiError extends Error {
	public readonly code: string;
	public readonly data: unknown;

	constructor(code: string, message: string, data: unknown = null) {
		super(message);
		this.name = "ApiError";
		this.code = code;
		this.data = data;
	}
}

// --- 2. 创建和配置 Axios 实例 ---

const http: AxiosInstance = axios.create({
	// baseURL: process.env.NEXT_PUBLIC_API_URL, // 如果有统一的 API 地址
	timeout: 10000, // 请求超时时间
	headers: {
		"Content-Type": "application/json",
	},
});

// --- 3. 设置响应拦截器 ---

http.interceptors.response.use(
	(response: AxiosResponse<BaseResponse<any>>) => {
		const { code, msg, message, data } = response.data;
		if (code === "00000" || code === 0) {
			// 直接返回业务数据
			return data as any;
		}

		// 如果是业务错误，则抛出 ApiError
		return Promise.reject(
			new ApiError(String(code), message || msg || "Request failed", data as any),
		);
	},
	(error) => {
		const message =
			error.response?.data?.message ||
			error.response?.data?.msg ||
			error.message ||
			"Network request failed";
		return Promise.reject(new ApiError(String(error.response?.status || "NETWORK"), message));
	},
);

export default http;
