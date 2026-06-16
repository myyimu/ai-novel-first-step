import { NovelCritiqueConsole } from "@/components/novel-critique-console";

export default function CritiquePage() {
	return (
		<main className="min-h-screen bg-background text-foreground">
			<NovelCritiqueConsole initialView="chapter" />
		</main>
	);
}
