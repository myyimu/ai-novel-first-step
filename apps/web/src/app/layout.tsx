import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

export async function generateMetadata(): Promise<Metadata> {
	const siteUrl =
		process.env.NEXT_PUBLIC_SITE_URL ??
		(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://127.0.0.1:3000");
	const title = "AI网文诊断台 | 别急着重写，先找出小说为什么没人追";
	const description =
		"本地 AI 小说诊断与 AI 拆书工具，定位第一章流失点，用正文证据解释为什么没人追，并生成可复制的改稿 Prompt。";

	return {
		metadataBase: new URL(siteUrl),
		applicationName: "AI网文诊断台",
		title,
		description,
		keywords: [
			"AI网文诊断台",
			"AI novel diagnosis",
			"AI拆书",
			"AI小说诊断",
			"小说诊断",
			"网文诊断",
			"小说哪里不好",
			"网文没流量",
			"为什么没人看",
			"网文第一章",
			"小说改稿",
			"改稿 Prompt",
			"小说质检",
			"小说拆解",
			"关系图谱",
			"web novel writing tool",
			"AI novel critique",
		],
		authors: [{ name: "myyimu" }],
		creator: "myyimu",
		publisher: "AI网文诊断台",
		category: "writing tools",
		alternates: {
			canonical: "/",
		},
		openGraph: {
			type: "website",
			locale: "zh_CN",
			url: "/",
			siteName: "AI网文诊断台",
			title,
			description,
		},
		twitter: {
			card: "summary",
			title,
			description,
		},
		robots: {
			index: true,
			follow: true,
			googleBot: {
				index: true,
				follow: true,
				"max-image-preview": "large",
				"max-snippet": -1,
				"max-video-preview": -1,
			},
		},
	};
}

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="zh-CN" suppressHydrationWarning>
			<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
				<ThemeProvider
					attribute="class"
					defaultTheme="light"
					enableSystem
					disableTransitionOnChange
				>
					{children}
					<Toaster />
				</ThemeProvider>
			</body>
		</html>
	);
}
