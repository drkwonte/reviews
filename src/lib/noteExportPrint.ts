import { supabase } from '@/lib/supabase'
import { normalizeStoredImagePathList, QUESTION_IMAGES_BUCKET } from '@/lib/noteMedia'

const SIGNED_URL_TTL_SECONDS = 3600

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
  /** When true, problem section uses OCR text instead of images (e.g. low resolution or multi-page preference). */
  useProblemTextInsteadOfImages: boolean
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
  /** Render `answer_text` when non-empty (below images if any). */
  showAnswerTextBlock: boolean
}

/**
 * Problem: images by default; OCR text only if the user opted in or there are no usable images.
 * Answer: all answer images when present; otherwise AI/OCR text. When both exist, images first then text.
 */
export function buildNotesPrintLayout(
  prepared: PreparedExportNote[],
  options: NotesPrintLayoutOptions,
): NotePrintLayout[] {
  return prepared.map((note) => {
    const problemTextTrimmed = note.problem_text?.trim() ?? ''
    const hasProblemText = problemTextTrimmed.length > 0
    const resolvedProblemImages = note.problemImageUrls

    let problemImageUrlsForPrint: string[] = []
    let showProblemText = false

    if (options.useProblemTextInsteadOfImages && hasProblemText) {
      showProblemText = true
    } else if (resolvedProblemImages.length > 0) {
      problemImageUrlsForPrint = resolvedProblemImages
    } else if (hasProblemText) {
      showProblemText = true
    }

    const answerTextTrimmed = note.answer_text?.trim() ?? ''
    const showAnswerTextBlock = answerTextTrimmed.length > 0

    return {
      note,
      problemImageUrlsForPrint,
      showProblemText,
      answerImageUrlsForPrint: [...note.answerImageUrls],
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
          ? `<div class="img-block"><span class="label">문제${problemTotal > 1 ? ` (${problemTotal}장)` : ''}</span>${row.problemImageUrlsForPrint
              .map(
                (url, imgIndex) =>
                  `<figure class="img-fig"><img src="${escapeAttr(url)}" alt="문제 이미지 ${imgIndex + 1}/${problemTotal}" />${
                    problemTotal > 1
                      ? `<figcaption>${imgIndex + 1} / ${problemTotal}</figcaption>`
                      : ''
                  }</figure>`,
              )
              .join('')}</div>`
          : ''

      const problemText =
        row.showProblemText && n.problem_text?.trim()
          ? `<div class="text-block"><span class="label">문제 (텍스트)</span><pre>${escapeHtml(n.problem_text)}</pre></div>`
          : ''

      const problemEmpty =
        row.problemImageUrlsForPrint.length === 0 && !row.showProblemText
          ? `<p class="empty-line">문제: 저장된 이미지·텍스트가 없습니다.</p>`
          : ''

      const answerTotal = row.answerImageUrlsForPrint.length
      const answerImgs =
        answerTotal > 0
          ? `<div class="img-block"><span class="label">정답·해설${answerTotal > 1 ? ` (${answerTotal}장)` : ''}</span>${row.answerImageUrlsForPrint
              .map(
                (url, imgIndex) =>
                  `<figure class="img-fig"><img src="${escapeAttr(url)}" alt="정답 이미지 ${imgIndex + 1}/${answerTotal}" />${
                    answerTotal > 1 ? `<figcaption>${imgIndex + 1} / ${answerTotal}</figcaption>` : ''
                  }</figure>`,
              )
              .join('')}</div>`
          : ''

      const answerText =
        row.showAnswerTextBlock && n.answer_text?.trim()
          ? `<div class="text-block"><span class="label">정답·해설 (텍스트)</span><pre>${escapeHtml(n.answer_text)}</pre></div>`
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
          ${problemImgs}
          ${problemText}
          ${problemEmpty}
          ${answerImgs}
          ${answerText}
          ${answerEmpty}
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
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
      color: #111;
      line-height: 1.5;
      padding: 16px 20px 32px;
      max-width: 800px;
      margin: 0 auto;
    }
    .doc-title { font-size: 20px; font-weight: 800; margin: 0 0 8px; }
    .doc-meta { font-size: 12px; color: #444; margin: 0 0 4px; }
    .doc-filter { font-size: 12px; color: #666; margin: 0 0 24px; }
    .note {
      page-break-after: always;
      border: 1px solid #ccc;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
    }
    .note:last-child { page-break-after: auto; }
    .note-head h2 { font-size: 16px; margin: 0 0 6px; }
    .note-head .meta { font-size: 11px; color: #555; margin: 0; }
    .img-block {
      margin: 12px 0;
      text-align: center;
      background: #f5f5f5;
      padding: 8px;
      border-radius: 6px;
    }
    .img-block .label {
      display: block;
      font-size: 11px;
      font-weight: 700;
      color: #333;
      margin-bottom: 6px;
      text-align: left;
    }
    .img-fig { margin: 0 0 12px; }
    .img-fig:last-child { margin-bottom: 0; }
    .img-fig img { max-width: 100%; height: auto; vertical-align: middle; }
    .img-fig figcaption {
      font-size: 10px;
      color: #666;
      margin-top: 4px;
      text-align: center;
    }
    .empty-line { font-size: 11px; color: #888; margin: 10px 0; font-style: italic; }
    .text-block { margin: 12px 0; }
    .text-block .label {
      display: block;
      font-size: 11px;
      font-weight: 700;
      color: #333;
      margin-bottom: 4px;
    }
    .text-block pre {
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 11px;
      margin: 0;
      padding: 10px;
      background: #fafafa;
      border: 1px solid #e5e5e5;
      border-radius: 6px;
    }
    .stats { font-size: 11px; color: #666; margin: 12px 0 0; }
    @media print {
      body { padding: 0; max-width: none; }
      .note { border-color: #999; }
    }
  </style>
</head>
<body>
  <h1 class="doc-title">${escapeHtml(meta.titleLine)}</h1>
  <p class="doc-meta">보낸 시각: ${escapeHtml(meta.exportedAt)} · 총 ${layout.length}건</p>
  <p class="doc-filter">${escapeHtml(meta.filterLine)}</p>
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
