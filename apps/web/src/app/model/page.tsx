import { NovelCritiqueConsole } from "@/components/novel-critique-console";

export default function ModelPage() {
	return (
		<main className="min-h-screen bg-background text-foreground">
			<NovelCritiqueConsole initialView="provider" />
		</main>
	);
}
