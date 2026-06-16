import { NovelCritiqueConsole } from "@/components/novel-critique-console";

export default function StarterPage() {
	return (
		<main className="min-h-screen bg-background text-foreground">
			<NovelCritiqueConsole initialView="starter" />
		</main>
	);
}
