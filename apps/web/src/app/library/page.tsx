import { NovelCritiqueConsole } from "@/components/novel-critique-console";

export default function LibraryPage() {
	return (
		<main className="min-h-screen bg-background text-foreground">
			<NovelCritiqueConsole initialView="library" />
		</main>
	);
}
