"use client";

import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
	CheckCircle2,
	ChevronDown,
	Loader2,
	ScanText,
	ShieldAlert,
	TriangleAlert,
} from "lucide-react";

export interface WorkspaceNavItem<TView extends string = string> {
	id: TView;
	label: string;
	title: string;
	description: string;
	icon: LucideIcon;
}

function getStatusMeta(status: string, loading: boolean) {
	if (loading) {
		return {
			title: "处理中",
			icon: Loader2,
			className: "border-primary/30 bg-primary/10 text-primary",
			iconClassName: "animate-spin",
			tone: "loading" as const,
		};
	}

	if (
		status.includes("完成") ||
		status.includes("已") ||
		status.includes("connected") ||
		status.includes("ready")
	) {
		return {
			title: "状态",
			icon: CheckCircle2,
			className: "border-success-border bg-success-surface text-success-foreground",
			iconClassName: "",
			tone: "success" as const,
		};
	}

	if (
		status.includes("请先") ||
		status.includes("失败") ||
		status.includes("failed") ||
		status.includes("Error") ||
		status.includes("requires") ||
		status.includes("Unsupported")
	) {
		return {
			title: "需要处理",
			icon: TriangleAlert,
			className: "border-warning-border bg-warning-surface text-warning-foreground",
			iconClassName: "",
			tone: "warning" as const,
		};
	}

	return {
		title: "状态",
		icon: ShieldAlert,
		className: "border-border bg-card text-muted-foreground",
		iconClassName: "",
		tone: "neutral" as const,
	};
}

function StatusBanner({
	status,
	loading,
	compact = false,
}: {
	status: string;
	loading: boolean;
	compact?: boolean;
}) {
	const meta = getStatusMeta(status, loading);
	const Icon = meta.icon;

	// Success 状态降级为一行小提示，不占大卡片；其它状态保持原样
	if (meta.tone === "success") {
		return (
			<div className="flex items-center gap-2 text-xs text-success-foreground">
				<Icon className="size-3.5 shrink-0" />
				<span className="break-words leading-5">{status}</span>
			</div>
		);
	}

	return (
		<div
			className={`rounded-md border ${meta.className} ${
				compact ? "p-3 text-xs" : "p-4 text-sm"
			}`}
		>
			<div className="flex items-start gap-3">
				<Icon className={`mt-0.5 size-4 shrink-0 ${meta.iconClassName}`} />
				<div className="min-w-0">
					<p className="font-semibold text-foreground">{meta.title}</p>
					<p className="mt-1 break-words leading-5">{status}</p>
				</div>
			</div>
		</div>
	);
}

export function WorkspaceShell<TView extends string>({
	activeView,
	activeMeta,
	navItems,
	advancedNavItems,
	status,
	loading,
	onOpenView,
	children,
}: {
	activeView: TView;
	activeMeta: WorkspaceNavItem<TView>;
	navItems: Array<WorkspaceNavItem<TView>>;
	advancedNavItems?: Array<WorkspaceNavItem<TView>>;
	status: string;
	loading: boolean;
	onOpenView: (view: TView) => void;
	children: ReactNode;
}) {
	const hasAdvanced = Boolean(advancedNavItems && advancedNavItems.length > 0);
	const activeIsAdvanced = Boolean(
		advancedNavItems?.some((item) => item.id === activeView),
	);
	// 当前停留在高级页面时默认展开，避免视觉上"找不到自己在哪儿"
	const [advancedOpen, setAdvancedOpen] = useState(activeIsAdvanced);

	const renderNavButton = (item: WorkspaceNavItem<TView>) => {
		const Icon = item.icon;
		const isActive = item.id === activeView;
		return (
			<button
				key={item.id}
				type="button"
				onClick={() => onOpenView(item.id)}
				aria-current={isActive ? "page" : undefined}
				className={`flex min-w-max items-center gap-2 rounded-md px-3 py-2 text-left transition-colors lg:w-full ${
					isActive
						? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
						: "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
				}`}
			>
				<Icon className="size-4 shrink-0" />
				<span>{item.label}</span>
			</button>
		);
	};

	return (
		<div className="min-h-screen bg-background lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
			<aside className="sticky top-0 z-20 border-b border-sidebar-border bg-sidebar text-sidebar-foreground lg:h-screen lg:border-b-0 lg:border-r">
				<div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:h-full lg:px-5 lg:py-6">
					<div className="flex items-center gap-3">
						<div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
							<ScanText className="size-5" />
						</div>
						<div className="min-w-0">
							<p className="truncate text-sm font-semibold">AI网文诊断台</p>
							<p className="truncate text-xs text-muted-foreground">
								本地小说诊断与 AI 拆书
							</p>
						</div>
					</div>

					<nav
						aria-label="主导航"
						className="-mx-1 flex gap-1 overflow-x-auto pb-1 text-sm lg:mx-0 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0"
					>
						{navItems.map(renderNavButton)}
					</nav>

					{hasAdvanced ? (
						<div className="border-t border-sidebar-border pt-3 lg:mt-1">
							<button
								type="button"
								onClick={() => setAdvancedOpen((value) => !value)}
								aria-expanded={advancedOpen}
								className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
							>
								<span>高级功能</span>
								<ChevronDown
									className={`size-3.5 transition-transform ${
										advancedOpen ? "rotate-180" : ""
									}`}
								/>
							</button>
							{advancedOpen ? (
								<nav
									aria-label="高级功能"
									className="mt-1 space-y-1 text-sm"
								>
									{advancedNavItems!.map(renderNavButton)}
								</nav>
							) : null}
						</div>
					) : null}
				</div>
			</aside>

			<section className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
				<header className="border-b border-border pb-4">
					<h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
						{activeMeta.title}
					</h1>
					{activeMeta.description ? (
						<p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted-foreground">
							{activeMeta.description}
						</p>
					) : null}
				</header>
				<StatusBanner status={status} loading={loading} compact />
				{children}
			</section>
		</div>
	);
}
