import { useState } from "react";
import { Check, Download, Share2 } from "lucide-react";
import { calendarCsv, calendarJson } from "@/lib/github/csv";
import { downloadSvgAsPng, downloadText } from "@/lib/github/download";
import { heatmapSvg, shareCardSvg } from "@/lib/github/svg";
import { SITE_ORIGIN } from "@/lib/site";
import type { CalendarPayload } from "@/lib/github/types";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function ExportMenu({
  calendar,
  year,
  onShareX,
}: {
  calendar: CalendarPayload;
  year?: number;
  onShareX?: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const login = calendar.profile.login;
  const embedQuery = year ? `?y=${year}` : "";
  const apiQuery = year ? `?year=${year}` : "";
  const shareMode = Boolean(onShareX);

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      window.prompt("Copy this", value);
    }
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1600);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          {shareMode ? <Share2 /> : <Download />}
          {shareMode ? "Share" : "Export"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2">
        <div className="flex flex-col">
          {onShareX ? (
            <>
              <Action label="Share on X" onClick={onShareX} />
              <div className="my-1 h-px bg-border" />
            </>
          ) : null}
          <Action
            label="Share card (SVG)"
            onClick={() =>
              downloadText(
                `${login}-cadence.svg`,
                "image/svg+xml",
                shareCardSvg(calendar),
              )
            }
          />
          <Action
            label="Share card (PNG)"
            onClick={() =>
              downloadSvgAsPng(
                shareCardSvg(calendar),
                `${login}-cadence.png`,
                1200,
                630,
              )
            }
          />
          <Action
            label="Heatmap (SVG)"
            onClick={() =>
              downloadText(
                `${login}-heatmap.svg`,
                "image/svg+xml",
                heatmapSvg(calendar.days),
              )
            }
          />
          <Action
            label="Calendar CSV"
            onClick={() =>
              downloadText(
                `${login}-cadence.csv`,
                "text/csv",
                calendarCsv(calendar.days),
              )
            }
          />
          <Action
            label="Calendar JSON"
            onClick={() =>
              downloadText(
                `${login}-cadence.json`,
                "application/json",
                calendarJson({
                  username: login,
                  range: calendar.range,
                  days: calendar.days,
                }),
              )
            }
          />
          <Action
            label={copied === "badge" ? "Copied badge" : "Copy README badge"}
            done={copied === "badge"}
            onClick={() =>
              copy(
                "badge",
                `[![Cadence](${SITE_ORIGIN}/api/badge/${login}.svg)](${SITE_ORIGIN}/u/${login})`,
              )
            }
          />
          <Action
            label={copied === "embed" ? "Copied embed" : "Copy embed code"}
            done={copied === "embed"}
            onClick={() =>
              copy(
                "embed",
                `<iframe src="${SITE_ORIGIN}/embed/${login}${embedQuery}" title="${login} on Cadence" width="100%" height="200" style="border:0;background:#0c0c0d"></iframe>`,
              )
            }
          />
          <Action
            label={copied === "json" ? "Copied URL" : "Copy JSON API URL"}
            done={copied === "json"}
            onClick={() =>
              copy("json", `${SITE_ORIGIN}/api/calendar/${login}${apiQuery}`)
            }
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Action({
  label,
  onClick,
  done,
}: {
  label: string;
  onClick: () => void | Promise<void>;
  done?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      className="flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-foreground hover:bg-secondary"
    >
      {done ? <Check className="size-3.5" /> : null}
      {label}
    </button>
  );
}
