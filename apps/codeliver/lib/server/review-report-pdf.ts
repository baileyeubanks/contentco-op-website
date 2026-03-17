import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

type ReviewReportInput = {
  project: {
    id: string;
    name: string;
  };
  asset: {
    id: string;
    title: string;
    file_type: string;
    status: string;
    current_version_number: number | null;
    latest_version_number: number | null;
    share_views: number;
  };
  versions: Array<{
    version_number: number;
    created_at: string;
    is_current?: boolean | null;
    notes?: string | null;
  }>;
  comments: Array<{
    author_name: string;
    body: string;
    status: string;
    timecode_seconds: number | null;
    created_at: string;
  }>;
  approvals: Array<{
    role_label: string;
    assignee_email: string | null;
    status: string;
    decision_note: string | null;
    decided_at: string | null;
  }>;
  shareLinks: Array<{
    permissions: string;
    view_count: number | null;
    expires_at: string | null;
    created_at: string;
  }>;
  exportedAt: string;
};

export async function buildReviewReportPdf(input: ReviewReportInput) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 48;
  const lineHeight = 16;

  let page = pdf.addPage([pageWidth, pageHeight]);
  let cursorY = pageHeight - margin;

  const ensureRoom = (requiredHeight = lineHeight * 2) => {
    if (cursorY - requiredHeight < margin) {
      page = pdf.addPage([pageWidth, pageHeight]);
      cursorY = pageHeight - margin;
    }
  };

  const drawLine = (
    text: string,
    options?: {
      font?: PDFFont;
      size?: number;
      color?: ReturnType<typeof rgb>;
      indent?: number;
    },
  ) => {
    ensureRoom();
    page.drawText(text, {
      x: margin + (options?.indent ?? 0),
      y: cursorY,
      size: options?.size ?? 10,
      font: options?.font ?? regular,
      color: options?.color ?? rgb(0.9, 0.94, 0.98),
      maxWidth: pageWidth - margin * 2 - (options?.indent ?? 0),
      lineHeight,
    });
    cursorY -= lineHeight;
  };

  const drawParagraph = (text: string, indent = 0) => {
    const words = text.split(/\s+/);
    let current = "";

    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      const width = regular.widthOfTextAtSize(next, 10);
      const maxWidth = pageWidth - margin * 2 - indent;
      if (width > maxWidth && current) {
        drawLine(current, { indent });
        current = word;
      } else {
        current = next;
      }
    }

    if (current) {
      drawLine(current, { indent });
    }
  };

  const section = (title: string) => {
    cursorY -= 8;
    ensureRoom(lineHeight * 2);
    page.drawRectangle({
      x: margin,
      y: cursorY - 8,
      width: pageWidth - margin * 2,
      height: 1,
      color: rgb(0.2, 0.83, 0.6),
      opacity: 0.4,
    });
    cursorY -= 18;
    drawLine(title, { font: bold, size: 13, color: rgb(0.2, 0.83, 0.6) });
    cursorY -= 4;
  };

  drawLine("Co-Deliver Review Report", { font: bold, size: 19, color: rgb(0.2, 0.83, 0.6) });
  drawLine(`Project: ${input.project.name}`, { font: bold, size: 12 });
  drawLine(`Asset: ${input.asset.title}`, { font: bold, size: 12 });
  drawLine(`Exported: ${new Date(input.exportedAt).toLocaleString("en-US")}`, {
    size: 9,
    color: rgb(0.58, 0.67, 0.77),
  });

  section("Summary");
  drawLine(`Type: ${input.asset.file_type}`);
  drawLine(`Status: ${formatStatus(input.asset.status)}`);
  drawLine(
    `Current version: ${input.asset.current_version_number ? `v${input.asset.current_version_number}` : "n/a"}`,
  );
  drawLine(
    `Latest version: ${input.asset.latest_version_number ? `v${input.asset.latest_version_number}` : "n/a"}`,
  );
  drawLine(`Total share views: ${input.asset.share_views}`);

  section("Versions");
  if (input.versions.length === 0) {
    drawLine("No versions available.", { color: rgb(0.58, 0.67, 0.77) });
  } else {
    for (const version of input.versions) {
      drawLine(
        `${version.is_current ? "*" : "-"} v${version.version_number} · ${new Date(version.created_at).toLocaleDateString("en-US")}`,
      );
      if (version.notes) {
        drawParagraph(`Notes: ${version.notes}`, 14);
      }
    }
  }

  section("Comments");
  const openComments = input.comments.filter((comment) => comment.status !== "resolved");
  const resolvedComments = input.comments.filter((comment) => comment.status === "resolved");
  drawLine(`Open: ${openComments.length}`);
  drawLine(`Resolved: ${resolvedComments.length}`);
  cursorY -= 4;

  if (input.comments.length === 0) {
    drawLine("No comments recorded.", { color: rgb(0.58, 0.67, 0.77) });
  } else {
    for (const comment of input.comments) {
      drawLine(
        `${formatTimecode(comment.timecode_seconds)} · ${comment.author_name} · ${formatStatus(comment.status)}`,
        { font: bold, size: 10 },
      );
      drawParagraph(comment.body, 14);
      cursorY -= 4;
    }
  }

  section("Approvals");
  if (input.approvals.length === 0) {
    drawLine("No approval steps configured.", { color: rgb(0.58, 0.67, 0.77) });
  } else {
    for (const approval of input.approvals) {
      drawLine(
        `${approval.role_label} · ${approval.assignee_email ?? "unassigned"} · ${formatStatus(approval.status)}`,
      );
      if (approval.decision_note) {
        drawParagraph(`Note: ${approval.decision_note}`, 14);
      }
    }
  }

  section("Share Links");
  if (input.shareLinks.length === 0) {
    drawLine("No share links created.", { color: rgb(0.58, 0.67, 0.77) });
  } else {
    for (const shareLink of input.shareLinks) {
      drawLine(
        `${formatStatus(shareLink.permissions)} · ${shareLink.view_count ?? 0} views · created ${new Date(shareLink.created_at).toLocaleDateString("en-US")}`,
      );
      if (shareLink.expires_at) {
        drawLine(`Expires: ${new Date(shareLink.expires_at).toLocaleString("en-US")}`, {
          indent: 14,
          size: 9,
          color: rgb(0.58, 0.67, 0.77),
        });
      }
    }
  }

  return pdf.save();
}

function formatTimecode(seconds: number | null) {
  if (seconds == null || Number.isNaN(seconds)) return "No timecode";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function formatStatus(value: string) {
  return value.replaceAll(/_/g, " ");
}
