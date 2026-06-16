import { NovelCritiqueConsole } from "@/components/novel-critique-console";

export default function BookPage() {
	return (
		<main className="min-h-screen bg-background text-foreground">
			<NovelCritiqueConsole initialView="book" />
		</main>
	);
}
