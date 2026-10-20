export async function waitForChartsReady(timeoutMs = 2500): Promise<void> {
  if (typeof document === "undefined") return;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const rootReady = document.querySelector('[data-charts-ready="true"]');
    const pendingCharts = document.querySelectorAll('[data-chart-ready="false"]');
    if (rootReady && pendingCharts.length === 0) {
      return;
    }
    await new Promise<void>((resolve) => window.setTimeout(resolve, 40));
  }
}

export function downloadText(filename: string, mime: string, body: string) {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function svgToPngBlob(
  svg: string,
  width: number,
  height: number,
): Promise<Blob> {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        image.onload = null;
        image.onerror = null;
        reject(new Error("Timed out rasterizing the SVG."));
      }, 10000);
      image.onload = () => {
        window.clearTimeout(timer);
        resolve();
      };
      image.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error("Could not rasterize the SVG."));
      };
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable.");
    ctx.fillStyle = "#0c0c0d";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (next) => (next ? resolve(next) : reject(new Error("PNG failed."))),
        "image/png",
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadSvgAsPng(
  svg: string,
  filename: string,
  width: number,
  height: number,
) {
  const png = await svgToPngBlob(svg, width, height);
  triggerBlobDownload(png, filename);
}

export async function shareSvgAsPng(input: {
  svg: string;
  filename: string;
  width: number;
  height: number;
  title: string;
  text: string;
  url: string;
}) {
  const { svg, filename, width, height, title, text, url } = input;
  const png = await svgToPngBlob(svg, width, height);
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      const file = new File([png], filename, { type: "image/png" });
      if (
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({ title, text, url, files: [file] });
        return;
      }
      await navigator.share({ title, text, url });
      return;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
    }
  }
  triggerBlobDownload(png, filename);
}
