import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Check,
  Download,
  Image as ImageIcon,
  Link2,
  Share2,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { calendarCsv, calendarJson } from "@/lib/github/csv";
import {
  downloadSvgAsPng,
  downloadText,
  shareSvgAsPng,
} from "@/lib/github/download";
import { heatmapSvg, shareCardSvg, skylineSvg } from "@/lib/github/svg";
import { SITE_ORIGIN } from "@/lib/site";
import type { CalendarPayload } from "@/lib/github/types";
import {
  isReservedRoute,
  profilePath,
  recapPath,
} from "@/lib/github/username";
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
  onCopyLink,
  recapYear,
  primary = false,
}: {
  calendar: CalendarPayload;
  year?: number;
  onShareX?: () => void;
  onCopyLink?: () => void | Promise<void>;
  recapYear?: number;
  primary?: boolean;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const login = calendar.profile.login;
  const userPath = profilePath(login);
  const recapTo = isReservedRoute(login)
    ? "/u/$username/$year"
    : "/$username/$year";
  const embedQuery = year ? `?y=${year}&view=3d` : "?view=3d";
  const apiQuery = year ? `?year=${year}` : "";
  const shareMode = Boolean(onShareX) || primary;
  const targetRecapYear = recapYear ?? year ?? new Date().getFullYear();
  const hasNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

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
        <Button
          type="button"
          variant={primary ? "default" : "outline"}
          size="sm"
        >
          {shareMode ? <Share2 /> : <Download />}
          {shareMode ? "Share" : "Export"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        <div className="flex flex-col">
          {onCopyLink ? (
            <Action
              label={copied === "link" ? "Copied link" : "Copy link"}
              done={copied === "link"}
              icon={<Link2 className="size-3.5 text-accent" />}
              onClick={async () => {
                await onCopyLink();
                setCopied("link");
                window.setTimeout(() => setCopied(null), 1600);
              }}
            />
          ) : null}
          <Action
            label="Share image"
            icon={<ImageIcon className="size-3.5 text-accent" />}
            onClick={() =>
              hasNativeShare
                ? shareSvgAsPng({
                    svg: shareCardSvg(calendar, { view: "3d" }),
                    filename: `${login}-cadence-3d.png`,
                    width: 1200,
                    height: 630,
                    title: `${calendar.profile.name || login} on Cadence`,
                    text: `${calendar.profile.name || login} (@${login}) · ${calendar.stats.total.toLocaleString("en-IN")} contributions · ${calendar.stats.currentStreak}d streak`,
                    url: `${SITE_ORIGIN}${year ? recapPath(login, year) : userPath}`,
                  })
                : downloadSvgAsPng(
                    shareCardSvg(calendar, { view: "3d" }),
                    `${login}-cadence-3d.png`,
                    1200,
                    630,
                  )
            }
          />
          <Link
            to={recapTo}
            params={{
              username: login,
              year: String(targetRecapYear),
            }}
            className="flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-foreground hover:bg-secondary"
          >
            <Sparkles className="size-3.5 text-accent" />
            {targetRecapYear} Recap
          </Link>
          <div className="my-1 h-px bg-border" />
          {hasNativeShare ? (
            <Action
              label="Share 3D card…"
              icon={<Smartphone className="size-3.5 text-accent" />}
              onClick={() =>
                shareSvgAsPng({
                  svg: shareCardSvg(calendar, { view: "3d" }),
                  filename: `${login}-cadence-3d.png`,
                  width: 1200,
                  height: 630,
                  title: `${calendar.profile.name || login} on Cadence`,
                  text: `${calendar.profile.name || login} (@${login}) · ${calendar.stats.total.toLocaleString("en-IN")} contributions · ${calendar.stats.currentStreak}d streak`,
                  url: `${SITE_ORIGIN}${year ? recapPath(login, year) : userPath}`,
                })
              }
            />
          ) : null}
          {onShareX ? (
            <>
              <Action label="Share on X" onClick={onShareX} />
              <div className="my-1 h-px bg-border" />
            </>
          ) : null}
          <Action
            label="3D Share card (PNG)"
            onClick={() =>
              downloadSvgAsPng(
                shareCardSvg(calendar, { view: "3d" }),
                `${login}-cadence-3d.png`,
                1200,
                630,
              )
            }
          />
          <Action
            label="3D Share card (SVG)"
            onClick={() =>
              downloadText(
                `${login}-cadence-3d.svg`,
                "image/svg+xml",
                shareCardSvg(calendar, { view: "3d" }),
              )
            }
          />
          <Action
            label="3D Skyline (SVG)"
            onClick={() =>
              downloadText(
                `${login}-skyline-3d.svg`,
                "image/svg+xml",
                skylineSvg(calendar.days),
              )
            }
          />
          <Action
            label="2D Heatmap (SVG)"
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
                `[![Cadence](${SITE_ORIGIN}/api/badge/${login}.svg)](${SITE_ORIGIN}${userPath})`,
              )
            }
          />
          <Action
            label={copied === "embed" ? "Copied 3D embed" : "Copy 3D embed code"}
            done={copied === "embed"}
            onClick={() =>
              copy(
                "embed",
                `<iframe src="${SITE_ORIGIN}/embed/${login}${embedQuery}" title="${login} on Cadence" width="100%" height="260" style="border:0;background:#0c0c0d"></iframe>`,
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
  icon,
}: {
  label: string;
  onClick: () => void | Promise<void>;
  done?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      className="flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-foreground hover:bg-secondary"
    >
      {done ? <Check className="size-3.5 text-accent" /> : icon}
      {label}
    </button>
  );
}
