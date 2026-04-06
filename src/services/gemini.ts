import { GoogleGenerativeAI } from '@google/generative-ai'

/**
 * 이미지에서 텍스트를 추출합니다. (v1beta 엔드포인트 및 2.5 Flash 모델 사용)
 */
export async function extractTextFromImage(base64Image: string): Promise<string> {
  const API_KEY = (import.meta.env.VITE_GEMINI_API_KEY as string || '').trim()
  
  if (!API_KEY) {
    throw new Error('Gemini API 키가 설정되지 않았습니다. .env 파일을 확인해 주세요.')
  }

  const genAI = new GoogleGenerativeAI(API_KEY)

  try {
    // 구글 에러 메시지에 따라 '기존의 2.0-flash' 대신 더 최신 모델인 'gemini-2.5-flash' 사용 시도
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash', 
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT' as any, threshold: 'BLOCK_NONE' as any },
        { category: 'HARM_CATEGORY_HATE_SPEECH' as any, threshold: 'BLOCK_NONE' as any },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT' as any, threshold: 'BLOCK_NONE' as any },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as any, threshold: 'BLOCK_NONE' as any },
      ]
    })

    const base64Data = base64Image.split(',')[1] || base64Image
    const prompt = `
      이미지 속의 텍스트를 정확하게 추출해 주세요. 
      단, 다음의 필터링 규칙을 **반드시** 지켜주세요:
      
      1. **핵심 규칙**: 그래프(Graph), 기하 도형, 그림 내부에 표시된 문자나 수식(예: x축/y축 레이블, 함수 그래프 위의 식, 도형의 각도 표시 등)은 무시하세요. 이것은 그림의 일부이며 텍스트로 중복 추출할 필요가 없습니다.
      2. **본문 집중**: 문제의 질문 본문, 제시된 조건, 그리고 객관식 선택지(①, ②, ③, ④, ⑤) 텍스트에만 집중해서 추출하세요.
      3. **수식 문법**: 수학 수식은 반드시 KaTeX 호환 LaTeX ($...$ 또는 $$...$$)로 작성하세요.
      4. **설명 금지**: 결과물에는 분석 내용이나 인사이트를 넣지 말고, 순수하게 추출된 텍스트 원문만 출력하세요.
    `

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: 'image/jpeg',
        },
      },
    ])

    const response = await result.response
    const text = response.text().trim()
    console.log('[Gemini OCR Success]');
    return text
  } catch (error: any) {
    console.error('Gemini OCR Error:', error)
    
    if (error?.status === 429 || error?.message?.includes('429')) {
      throw new Error('사용량이 초과되었습니다. 잠시 후 다시 시도해 주세요.')
    }
    
    throw new Error('AI 분석 중 오류가 발생했습니다.')
  }
}

/**
 * 문제 텍스트를 기반으로 정답과 해설을 생성합니다.
 */
export async function generateAnswerFromText(problemText: string): Promise<{ answer: string; explanation: string }> {
  const API_KEY = (import.meta.env.VITE_GEMINI_API_KEY as string || '').trim()
  
  if (!API_KEY) {
    throw new Error('API 키가 설정되지 않았습니다.')
  }

  const genAI = new GoogleGenerativeAI(API_KEY)

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const prompt = `
      다음은 오답 노트에 등록할 문제입니다. 이 문제의 정답과 상세한 해설을 만들어 주세요.
      사용자가 한눈에 이해할 수 있도록 명확하게 설명해 주세요.
      수식이 있다면 KaTeX 형식($ 또는 $$)으로 작성해 주세요.

      [문제 내용]
      ${problemText}

      형식: 반드시 아래의 JSON 형식으로만 답변하세요. 마크다운 기호를 직접 사용하지 마세요.
      {
        "answer": "정답 기호나 내용",
        "explanation": [
          "해설 첫 번째 줄 또는 첫 번째 항목",
          "해설 두 번째 줄 또는 두 번째 항목",
          ...
        ]
      }

      주의: 모든 답변은 유효한 JSON이어야 하며, 텍스트 내부에 불필요한 마크다운 기호(*)를 넣지 마세요.
    `

    const result = await model.generateContent(prompt)
    const response = await result.response
    const fullText = response.text().trim()
    
    try {
      // JSON 추출 (AI가 마크다운 코드 블록으로 감쌀 경우 대비)
      const jsonStr = fullText.replace(/```json|```/g, '').trim()
      const data = JSON.parse(jsonStr)
      
      return {
        answer: data.answer || '',
        explanation: Array.isArray(data.explanation) 
          ? data.explanation.join('\n\n') 
          : data.explanation || ''
      }
    } catch (e) {
      console.warn('[Gemini Parse Error] Falling back to text parsing', e)
      
      // JSON 파싱 실패 시 기존의 텍스트 기반 폴백
      return {
        answer: fullText.match(/정답:?\s*(.*)/i)?.[1] || '',
        explanation: fullText.replace(/정답:?.*|해설:?/gi, '').trim()
      }
    }
  } catch (error: any) {
    console.error('Gemini Generation Error:', error)
    throw new Error('AI 정답 생성 중 오류가 발생했습니다.')
  }
}
