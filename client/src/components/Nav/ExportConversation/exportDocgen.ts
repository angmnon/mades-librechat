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

// =============================================================================
// Artifact export helpers (MADES Agent OS)
// The artifact backend in this fork is UI-only scaffolding — there is no server
// route that renders an artifact to docx/pdf. Instead we convert the artifact's
// HTML preview (the same content shown in the preview iframe) to Markdown and
// hand it to the docgen Worker, mirroring the conversation-export flow. No
// backend endpoint is required.
// =============================================================================

/**
 * Minimal, dependency-free HTML → Markdown converter for artifact previews.
 * Handles the common block/inline elements a generated doc uses; anything else
 * degrades to its inner text. Runs in the browser (uses DOMParser).
 */
export function htmlToMarkdown(html: string): string {
  if (!html || typeof document === 'undefined') return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const root = doc.body || doc.documentElement;
  if (!root) return '';

  const inline = (el: HTMLElement): string => {
    let out = '';
    el.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        out += child.textContent || '';
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      const node = child as HTMLElement;
      const tag = node.tagName;
      const inner = inline(node);
      switch (tag) {
        case 'STRONG':
        case 'B': out += `**${inner}**`; break;
        case 'EM':
        case 'I': out += `*${inner}*`; break;
        case 'CODE': out += `\`${inner}\``; break;
        case 'A': {
          const href = node.getAttribute('href') || '';
          out += href && href !== inner ? `[${inner}](${href})` : inner;
          break;
        }
        case 'IMG': {
          const alt = node.getAttribute('alt') || '';
          const src = node.getAttribute('src') || '';
          if (src) out += `![${alt}](${src})`;
          break;
        }
        case 'BR': out += '\n'; break;
        case 'SUB': out += `<sub>${inner}</sub>`; break;
        case 'SUP': out += `<sup>${inner}</sup>`; break;
        default: out += inner;
      }
    });
    return out;
  };

  const blocks: string[] = [];
  let listDepth = 0;

  const walk = (node: Node): void => {
    node.childNodes.forEach((child) => {
      if (child.nodeType !== Node.ELEMENT_NODE) return; // skip loose text nodes
      const el = child as HTMLElement;
      const tag = el.tagName;
      switch (tag) {
        case 'H1': case 'H2': case 'H3': case 'H4': case 'H5': case 'H6': {
          const level = Number(tag[1]);
          blocks.push(`${'#'.repeat(level)} ${inline(el).trim()}`);
          break;
        }
        case 'P': blocks.push(inline(el).trim()); break;
        case 'DIV': case 'SECTION': case 'ARTICLE': case 'HEADER': case 'FOOTER':
        case 'MAIN': case 'ASIDE':
          walk(el); break;
        case 'BLOCKQUOTE': blocks.push(`> ${inline(el).trim().replace(/\n/g, '\n> ')}`); break;
        case 'PRE': blocks.push('```\n' + (el.textContent || '').replace(/\n$/, '') + '\n```'); break;
        case 'UL': {
          listDepth++;
          el.querySelectorAll(':scope > li').forEach((li) => {
            blocks.push(`${'  '.repeat(listDepth - 1)}- ${inline(li as HTMLElement).trim()}`);
          });
          listDepth--;
          break;
        }
        case 'OL': {
          listDepth++;
          let i = 1;
          el.querySelectorAll(':scope > li').forEach((li) => {
            blocks.push(`${'  '.repeat(listDepth - 1)}${i}. ${inline(li as HTMLElement).trim()}`);
            i++;
          });
          listDepth--;
          break;
        }
        case 'TABLE': {
          const rows = Array.from(el.querySelectorAll('tr'));
          rows.forEach((tr, ri) => {
            const cells = Array.from(tr.querySelectorAll('th,td')).map((c) =>
              inline(c as HTMLElement).trim().replace(/\|/g, '\\|'),
            );
            blocks.push(`| ${cells.join(' | ')} |`);
            if (ri === 0) blocks.push(`| ${cells.map(() => '---').join(' | ')} |`);
          });
          break;
        }
        case 'HR': blocks.push('---'); break;
        case 'BR': blocks.push(''); break;
        case 'IMG': {
          const alt = el.getAttribute('alt') || '';
          const src = el.getAttribute('src') || '';
          if (src) blocks.push(`![${alt}](${src})`);
          break;
        }
        case 'LI': break; // handled by UL/OL parents
        default: {
          const txt = inline(el).trim();
          if (txt) blocks.push(txt);
        }
      }
    });
  };

  walk(root);
  return blocks.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

export interface ArtifactMeta {
  title?: string;
  type?: string;
  version?: number;
  status?: string;
  summary?: string;
}

/** Build a branded Markdown document from an artifact's metadata + HTML preview. */
export function artifactToMarkdown(artifact: ArtifactMeta | null, html: string): string {
  const lines: string[] = [];
  lines.push(`# ${artifact?.title || 'Artifact'}`);
  lines.push('');

  const meta: string[] = [];
  if (artifact?.type) meta.push(`- **Type:** ${artifact.type}`);
  if (artifact?.version != null) meta.push(`- **Version:** v${artifact.version}`);
  if (artifact?.status) meta.push(`- **Status:** ${artifact.status}`);
  if (meta.length) {
    lines.push(...meta);
    lines.push('');
  }
  if (artifact?.summary) {
    lines.push(`> ${artifact.summary}`);
    lines.push('');
  }

  const body = htmlToMarkdown(html);
  if (body.trim()) {
    lines.push('---');
    lines.push('');
    lines.push(body);
  }
  return lines.join('\n');
}

/** Turn a free-form title into a safe download filename base. */
export function safeFilename(input: string): string {
  const base = (input || 'artifact').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return base || 'artifact';
}
