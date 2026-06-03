import { createElement, type ReactElement } from "react";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildReport } from "@/lib/report";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { ReportDocument } from "@/lib/report-pdf";

// @react-pdf/renderer needs the Node runtime — it uses Buffer + native deps
// that won't run on the Edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const data = await buildReport(user.id);
  if (!data) {
    return NextResponse.json(
      { error: "profile_incomplete" },
      { status: 400 },
    );
  }

  // renderToBuffer types the argument as ReactElement<DocumentProps>; our
  // wrapper component returns a Document but TS can't follow that through a
  // function component, so we assert. Same shape at runtime.
  const element = createElement(ReportDocument, { data }) as ReactElement<
    DocumentProps
  >;
  const pdfBuffer = await renderToBuffer(element);
  // Buffer extends Uint8Array at runtime; BodyInit's DOM types reject both
  // here, so hand it through as an ArrayBuffer slice. Cast away the
  // SharedArrayBuffer half of the union — Node Buffers are never shared.
  const body = pdfBuffer.buffer.slice(
    pdfBuffer.byteOffset,
    pdfBuffer.byteOffset + pdfBuffer.byteLength,
  ) as ArrayBuffer;

  // Date-stamped filename so a user can save multiple over time and tell
  // them apart without renaming.
  const stamp = data.generatedAt.toISOString().slice(0, 10);
  const slug = data.patient.displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30) || "patient";
  const filename = `lastember-report_${slug}_${stamp}.pdf`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
