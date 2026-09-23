// Export a LibreChat conversation (or any Markdown) to a real Word / PDF / PPT file via the
// `madesai-docgen` Worker. No LibreChat server change is required: the client builds Markdown
// and POSTs it; the Worker renders it with the Mades.ai branded document engine and returns the
// binary. See https://docgen.mades.ai (Worker deployed from angmnon/mades.ai-v2 infra/docgen-worker).
//
// Wiring (this repo):
//   - TYPE_OPTIONS in ExportModal.tsx gains 'docx' / 'pdf' / 'pptx'.
//   - useExportConversation.ts builds the conversation Markdown and calls exportDocument() below.
//   - VITE_DOCGEN_URL is read from env (default https://docgen.mades.ai/generate).

export type DocFormat = 'docx' | 'pdf' | 'pptx';

export interface ExportDocumentOptions {
  /** Deployed madesai-docgen Worker URL. Falls back to the Mades.ai edge endpoint. */
  docgenUrl?: string;
  /** Document title + filename base. */
  title?: string;
  /** Locale for brand/footer text (currently 'en' | 'zh'). */
  locale?: string;
}

/**
 * POST Markdown to the docgen Worker and trigger a browser download of the resulting file.
 * The Worker performs Markdown -> DocumentModel -> docx/pdf/pptx and returns the binary.
 */
export async function exportDocument(
  markdown: string,
  filename: string,
  format: DocFormat,
  options: ExportDocumentOptions = {},
): Promise<void> {
  const docgenUrl =
    options.docgenUrl ||
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_DOCGEN_URL) ||
    'https://docgen.mades.ai/generate';

  const res = await fetch(docgenUrl as string, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      format,
      markdown,
      meta: { title: options.title || filename, docType: 'Conversation Export' },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`docgen Worker error ${res.status}: ${detail}`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
