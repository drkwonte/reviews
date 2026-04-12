import katex from 'katex'
import { supabase } from '@/lib/supabase'
import { normalizeStoredImagePathList, QUESTION_IMAGES_BUCKET } from '@/lib/noteMedia'

const SIGNED_URL_TTL_SECONDS = 3600

/** Matches KaTeX CSS used in package.json for print window (CDN fonts). */
const KATEX_CDN_VERSION = '0.16.21'
const KATEX_CSS_HREF = `https://cdn.jsdelivr.net/npm/katex@${KATEX_CDN_VERSION}/dist/katex.min.css`

/** Print layout: body text uses CSS columns; images span full width. */
const PRINT_COLUMN_COUNT = 2
const PRINT_PAGE_MARGIN_MM = 11
const PRINT_COLUMN_GAP_PX = 20

export interface RawNoteForExport {
  id: string
  subject: string
  category?: string | null
  source?: string | null
  created_at: string
  problem_url?: string | null
  answer_url?: string | null
  /** JSONB array of storage paths or absolute URLs (ordered pages). */
  problem_urls?: unknown
  answer_urls?: unknown
  problem_text?: string | null
  answer_text?: string | null
  accuracy?: number | null
  review_count?: number | null
  is_favorite?: boolean
}

export interface PreparedExportNote extends RawNoteForExport {
  problemImageUrls: string[]
  answerImageUrls: string[]
}

export interface NotesPrintLayoutOptions {
  /**
   * Per-note: true (default) = 문제·정답 모두 이미지 우선.
   * false = 텍스트가 있으면 문제·정답은 텍스트(KaTeX) 우선, 없을 때만 이미지.
   */
  problemImageFirstByNoteId: Record<string, boolean>
}

function isProblemImageFirstByNote(options: NotesPrintLayoutOptions, noteId: string): boolean {
  return options.problemImageFirstByNoteId[noteId] !== false
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/\n/g, ' ')
}

/**
 * Escapes plain text, preserves newlines, and renders `$...$` / `$$...$$` with KaTeX (for print/PDF).
 */
export function renderTextWithKatexToHtml(raw: string): string {
  const segments = raw.split(/(\$\$[\s\S]*?\$\$)/g)
  let html = ''
  for (const segment of segments) {
    if (segment.startsWith('$$') && segment.endsWith('$$') && segment.length >= 4) {
      const formula = segment.slice(2, -2).trim()
      try {
        html += katex.renderToString(formula, { displayMode: true, throwOnError: false })
      } catch {
        html += escapeHtml(segment)
      }
      continue
    }
    const inlineParts = segment.split(/(\$[^$\n]+\$)/g)
    for (const part of inlineParts) {
      if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
        const formula = part.slice(1, -1).trim()
        try {
          html += katex.renderToString(formula, { displayMode: false, throwOnError: false })
        } catch {
          html += escapeHtml(part)
        }
      } else {
        html += escapeHtml(part).replace(/\n/g, '<br />\n')
      }
    }
  }
  return html
}

async function resolveStorageImageUrl(pathOrUrl: string | null | undefined): Promise<string | null> {
  if (!pathOrUrl?.trim()) return null
  const value = pathOrUrl.trim()
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value
  }
  const { data, error } = await supabase.storage
    .from(QUESTION_IMAGES_BUCKET)
    .createSignedUrl(value, SIGNED_URL_TTL_SECONDS)
  if (error || !data?.signedUrl) {
    console.warn('noteExportPrint: signed URL failed', error?.message)
    return null
  }
  return data.signedUrl
}

async function resolveImageUrlList(pathsOrUrls: string[]): Promise<string[]> {
  const resolved = await Promise.all(pathsOrUrls.map((p) => resolveStorageImageUrl(p)))
  return resolved.filter((url): url is string => Boolean(url))
}

export async function prepareNotesForPrintExport(rows: RawNoteForExport[]): Promise<PreparedExportNote[]> {
  return Promise.all(
    rows.map(async (row) => {
      const problemPaths = normalizeStoredImagePathList(row.problem_urls, row.problem_url)
      const answerPaths = normalizeStoredImagePathList(row.answer_urls, row.answer_url)
      return {
        ...row,
        problemImageUrls: await resolveImageUrlList(problemPaths),
        answerImageUrls: await resolveImageUrlList(answerPaths),
      }
    }),
  )
}

export interface NotesPrintMeta {
  titleLine: string
  filterLine: string
  exportedAt: string
}

export interface NotePrintLayout {
  note: PreparedExportNote
  problemImageUrlsForPrint: string[]
  showProblemText: boolean
  answerImageUrlsForPrint: string[]
  /** When true, render answer_text (KaTeX) in print HTML. */
  showAnswerTextBlock: boolean
}

/**
 * 문제: 노트별 이미지 우선(기본) 또는 텍스트 우선.
 * 정답: 이미지 우선 모드면 이미지 후 텍스트; 텍스트 우선이면 텍스트만(없으면 이미지).
 */
export function buildNotesPrintLayout(
  prepared: PreparedExportNote[],
  options: NotesPrintLayoutOptions,
): NotePrintLayout[] {
  return prepared.map((note) => {
    const imageFirst = isProblemImageFirstByNote(options, note.id)
    const problemTextTrimmed = note.problem_text?.trim() ?? ''
    const hasProblemText = problemTextTrimmed.length > 0
    const resolvedProblemImages = note.problemImageUrls

    let problemImageUrlsForPrint: string[] = []
    let showProblemText = false

    if (!imageFirst && hasProblemText) {
      showProblemText = true
    } else if (resolvedProblemImages.length > 0) {
      problemImageUrlsForPrint = resolvedProblemImages
    } else if (hasProblemText) {
      showProblemText = true
    }

    const answerTextTrimmed = note.answer_text?.trim() ?? ''
    const hasAnswerText = answerTextTrimmed.length > 0
    const answerImages = note.answerImageUrls

    let answerImageUrlsForPrint: string[] = []
    let showAnswerTextBlock = false

    if (imageFirst) {
      answerImageUrlsForPrint = [...answerImages]
      showAnswerTextBlock = hasAnswerText
    } else if (hasAnswerText) {
      showAnswerTextBlock = true
    } else if (answerImages.length > 0) {
      answerImageUrlsForPrint = [...answerImages]
    }

    return {
      note,
      problemImageUrlsForPrint,
      showProblemText,
      answerImageUrlsForPrint,
      showAnswerTextBlock,
    }
  })
}

export function buildNotesPrintHtml(layout: NotePrintLayout[], meta: NotesPrintMeta): string {
  const blocks = layout
    .map((row, index) => {
      const n = row.note
      const reviewed = (n.review_count ?? 0) > 0
      const accPct = reviewed ? Math.round((n.accuracy ?? 0) * 100) : null

      const problemTotal = row.problemImageUrlsForPrint.length
      const problemImgs =
        problemTotal > 0
          ? `<span class="img-section-label">문제${problemTotal > 1 ? ` (${problemTotal}장)` : ''}</span>${row.problemImageUrlsForPrint
              .map(
                (url, imgIndex) =>
                  `<figure class="img-fig"><img src="${escapeAttr(url)}" alt="문제 이미지 ${imgIndex + 1}/${problemTotal}" />${
                    problemTotal > 1
                      ? `<figcaption>${imgIndex + 1} / ${problemTotal}</figcaption>`
                      : ''
                  }</figure>`,
              )
              .join('')}`
          : ''

      const problemText =
        row.showProblemText && n.problem_text?.trim()
          ? `<div class="text-block"><span class="label">문제 (텍스트)</span><div class="katex-body">${renderTextWithKatexToHtml(
              n.problem_text,
            )}</div></div>`
          : ''

      const problemEmpty =
        row.problemImageUrlsForPrint.length === 0 && !row.showProblemText
          ? `<p class="empty-line">문제: 저장된 이미지·텍스트가 없습니다.</p>`
          : ''

      const answerTotal = row.answerImageUrlsForPrint.length
      const answerImgs =
        answerTotal > 0
          ? `<span class="img-section-label">정답·해설${answerTotal > 1 ? ` (${answerTotal}장)` : ''}</span>${row.answerImageUrlsForPrint
              .map(
                (url, imgIndex) =>
                  `<figure class="img-fig"><img src="${escapeAttr(url)}" alt="정답 이미지 ${imgIndex + 1}/${answerTotal}" />${
                    answerTotal > 1 ? `<figcaption>${imgIndex + 1} / ${answerTotal}</figcaption>` : ''
                  }</figure>`,
              )
              .join('')}`
          : ''

      const answerText =
        row.showAnswerTextBlock && n.answer_text?.trim()
          ? `<div class="text-block"><span class="label">정답·해설 (텍스트)</span><div class="katex-body">${renderTextWithKatexToHtml(
              n.answer_text,
            )}</div></div>`
          : ''

      const answerEmpty =
        answerTotal === 0 && !row.showAnswerTextBlock
          ? `<p class="empty-line">정답: 이미지·텍스트가 없습니다.</p>`
          : ''

      const stats = `<p class="stats">복습 ${n.review_count ?? 0}회 · ${
        reviewed && accPct !== null ? `최근 정답률 약 ${accPct}%` : '복습 전'
      }${n.is_favorite ? ' · ★ 중요' : ''}</p>`

      return `
        <article class="note" data-index="${index + 1}">
          <header class="note-head">
            <h2>${escapeHtml(n.subject || '과목 없음')}</h2>
            <p class="meta">${escapeHtml(n.category || '단원 미상')} · ${escapeHtml(n.source || '출처 없음')} · 등록 ${escapeHtml(
              n.created_at?.slice(0, 10) ?? '',
            )}</p>
          </header>
          <div class="note-print-columns">
            ${problemImgs}
            ${problemText}
            ${problemEmpty}
            ${answerImgs}
            ${answerText}
            ${answerEmpty}
          </div>
          ${stats}
        </article>
      `
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(meta.titleLine)}</title>
  <link rel="stylesheet" href="${KATEX_CSS_HREF}" crossorigin="anonymous" />
  <style>
    * { box-sizing: border-box; }
    @page {
      margin: ${PRINT_PAGE_MARGIN_MM}mm;
    }
    body {
      font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
      color: #111;
      line-height: 1.5;
      margin: 0;
      padding: 12px 14px 20px;
      max-width: none;
    }
    .doc-banner {
      page-break-after: avoid;
      break-after: avoid;
      margin-bottom: 12px;
    }
    .doc-title { font-size: 18px; font-weight: 800; margin: 0 0 6px; }
    .doc-meta { font-size: 11px; color: #444; margin: 0 0 2px; }
    .doc-filter { font-size: 11px; color: #666; margin: 0; }
    .note {
      page-break-after: always;
      break-after: page;
      border: 1px solid #ccc;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 16px;
    }
    .note:last-child {
      page-break-after: auto;
      break-after: auto;
      margin-bottom: 0;
    }
    article.note:first-of-type {
      page-break-before: auto;
      break-before: auto;
    }
    .note-head {
      page-break-after: avoid;
      break-after: avoid;
      margin-bottom: 10px;
    }
    .note-head h2 { font-size: 15px; margin: 0 0 4px; }
    .note-head .meta { font-size: 10px; color: #555; margin: 0; }
    .note-print-columns {
      column-count: ${PRINT_COLUMN_COUNT};
      column-gap: ${PRINT_COLUMN_GAP_PX}px;
      column-rule: 1px solid #ddd;
      column-fill: balance;
    }
    .img-section-label {
      display: block;
      column-span: all;
      -webkit-column-span: all;
      font-size: 10px;
      font-weight: 700;
      color: #333;
      margin: 10px 0 8px;
      text-align: left;
    }
    .note-print-columns > .img-section-label:first-child {
      margin-top: 0;
    }
    .img-fig {
      display: block;
      width: 100%;
      max-width: 100%;
      margin: 0 0 10px;
      padding: 6px;
      background: #f5f5f5;
      border-radius: 4px;
      text-align: center;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .img-fig img {
      display: block;
      width: 100%;
      max-width: 100%;
      height: auto;
      margin: 0 auto;
    }
    .img-fig figcaption {
      font-size: 9px;
      color: #666;
      margin-top: 4px;
      text-align: center;
    }
    .empty-line {
      font-size: 10px;
      color: #888;
      margin: 8px 0;
      font-style: italic;
    }
    .text-block {
      display: contents;
    }
    .text-block .label {
      display: block;
      font-size: 10px;
      font-weight: 700;
      color: #333;
      margin: 10px 0 4px;
    }
    .text-block .katex-body {
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 10px;
      line-height: 1.5;
      margin: 0 0 8px;
      padding: 8px;
      background: #fafafa;
      border: 1px solid #e5e5e5;
      border-radius: 4px;
    }
    .text-block .katex-body .katex { font-size: 1.05em; }
    .text-block .katex-body .katex-display {
      margin: 0.5em 0;
      overflow-x: auto;
      overflow-y: hidden;
    }
    .stats {
      font-size: 10px;
      color: #666;
      margin: 10px 0 0;
      padding-top: 8px;
      border-top: 1px solid #e5e5e5;
    }
    @media print {
      body { padding: 0; }
      .note { border-color: #999; }
      .text-block .katex-body { font-size: 9.5pt; }
    }
  </style>
</head>
<body>
  <header class="doc-banner">
    <h1 class="doc-title">${escapeHtml(meta.titleLine)}</h1>
    <p class="doc-meta">보낸 시각: ${escapeHtml(meta.exportedAt)} · 총 ${layout.length}건</p>
    <p class="doc-filter">${escapeHtml(meta.filterLine)}</p>
  </header>
  ${blocks}
</body>
</html>`
}

export function openNotesPrintWindow(html: string): void {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    throw new Error('팝업이 차단되었습니다. 브라우저에서 팝업을 허용한 뒤 다시 시도해 주세요.')
  }
  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
  const runPrint = () => {
    printWindow.focus()
    printWindow.print()
  }
  setTimeout(runPrint, 350)
}
