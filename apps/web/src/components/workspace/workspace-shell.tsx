"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2, Loader2, ScanText, ShieldAlert, TriangleAlert } from "lucide-react";

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
		};
	}

	return {
		title: "状态",
		icon: ShieldAlert,
		className: "border-border bg-card text-muted-foreground",
		iconClassName: "",
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
	status,
	loading,
	onOpenView,
	children,
}: {
	activeView: TView;
	activeMeta: WorkspaceNavItem<TView>;
	navItems: Array<WorkspaceNavItem<TView>>;
	status: string;
	loading: boolean;
	onOpenView: (view: TView) => void;
	children: ReactNode;
}) {
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
						{navItems.map((item) => {
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
						})}
					</nav>

					<div className="hidden text-xs leading-5 text-muted-foreground lg:mt-auto lg:block">
						<p>本机使用</p>
						<p>共享站/自备 Key</p>
					</div>
				</div>
			</aside>

			<section className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
				<header className="border-b border-border pb-4">
					<div>
						<h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
							{activeMeta.title}
						</h1>
					</div>
				</header>
				<StatusBanner status={status} loading={loading} compact />
				{children}
			</section>
		</div>
	);
}
