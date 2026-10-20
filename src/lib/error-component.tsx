import { Link, type ErrorComponentProps } from "@tanstack/react-router";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

const FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return FALLBACK_MESSAGE;
}

export function AppErrorComponent({ error, reset }: ErrorComponentProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center text-foreground">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-2xl bg-card p-6 shadow-[var(--shadow-border)] sm:p-8">
        <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-accent" aria-hidden="true">
          <TriangleAlert className="size-6" strokeWidth={2} />
        </span>
        <div className="space-y-1.5">
          <h1 className="font-display text-xl font-semibold tracking-tight">
            Something went wrong
          </h1>
          <p className="text-sm leading-relaxed break-words text-muted-foreground">
            {errorMessage(error)}
          </p>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              if (typeof reset === "function") {
                reset();
              } else {
                window.location.reload();
              }
            }}
          >
            <RotateCcw />
            Try again
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
