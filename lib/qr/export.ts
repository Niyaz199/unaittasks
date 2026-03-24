type DownloadQrPngOptions = {
  svgElement: SVGSVGElement;
  fileName: string;
  title: string;
  subtitle?: string;
  token?: string;
};

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  const lines: string[] = [];
  let currentLine = words[0] ?? "";

  for (let index = 1; index < words.length; index += 1) {
    const word = words[index] ?? "";
    const candidate = `${currentLine} ${word}`;
    if (context.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
      continue;
    }
    lines.push(currentLine);
    currentLine = word;
  }

  lines.push(currentLine);
  return lines;
}

export function downloadQrPng({ svgElement, fileName, title, subtitle, token }: DownloadQrPngOptions) {
  const svgData = new XMLSerializer().serializeToString(svgElement);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const image = new Image();

  const width = 1200;
  const padding = 96;
  const qrSize = width - padding * 2;
  const captionTop = padding + qrSize + 70;
  const contentWidth = width - padding * 2;
  const titleLineHeight = 56;
  const subtitleLineHeight = 38;
  const tokenLineHeight = 34;

  canvas.width = width;
  canvas.height = 1600;

  image.onload = () => {
    if (!context) return;

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, padding, padding, qrSize, qrSize);

    let currentY = captionTop;
    context.fillStyle = "#111827";
    context.textAlign = "center";

    context.font = "600 46px sans-serif";
    const titleLines = wrapText(context, title, contentWidth);
    for (const line of titleLines) {
      context.fillText(line, width / 2, currentY, contentWidth);
      currentY += titleLineHeight;
    }

    if (subtitle?.trim()) {
      currentY += 10;
      context.fillStyle = "#4b5563";
      context.font = "400 30px sans-serif";
      const subtitleLines = wrapText(context, subtitle, contentWidth);
      for (const line of subtitleLines) {
        context.fillText(line, width / 2, currentY, contentWidth);
        currentY += subtitleLineHeight;
      }
    }

    if (token?.trim()) {
      currentY += 18;
      context.fillStyle = "#6b7280";
      context.font = "400 24px monospace";
      const tokenLines = wrapText(context, token, contentWidth);
      for (const line of tokenLines) {
        context.fillText(line, width / 2, currentY, contentWidth);
        currentY += tokenLineHeight;
      }
    }

    const trimmedHeight = Math.min(Math.ceil(currentY + padding), canvas.height);
    const output = document.createElement("canvas");
    output.width = canvas.width;
    output.height = trimmedHeight;
    const outputContext = output.getContext("2d");
    if (!outputContext) return;
    outputContext.fillStyle = "#ffffff";
    outputContext.fillRect(0, 0, output.width, output.height);
    outputContext.drawImage(canvas, 0, 0);

    const link = document.createElement("a");
    link.download = fileName;
    link.href = output.toDataURL("image/png");
    link.click();
  };

  image.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;
}
