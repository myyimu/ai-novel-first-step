import { NovelCritiqueConsole } from "@/components/novel-critique-console";

export default function ExportPage() {
	return (
		<main className="min-h-screen bg-background text-foreground">
			<NovelCritiqueConsole initialView="exports" />
		</main>
	);
}
