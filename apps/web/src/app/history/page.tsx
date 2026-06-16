import { NovelCritiqueConsole } from "@/components/novel-critique-console";

export default function HistoryPage() {
	return (
		<main className="min-h-screen bg-background text-foreground">
			<NovelCritiqueConsole initialView="history" />
		</main>
	);
}
