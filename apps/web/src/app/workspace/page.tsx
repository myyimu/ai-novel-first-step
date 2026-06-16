import { NovelCritiqueConsole } from "@/components/novel-critique-console";

export default function WorkspacePage() {
	return (
		<main className="min-h-screen bg-background text-foreground">
			<NovelCritiqueConsole initialView="overview" />
		</main>
	);
}
