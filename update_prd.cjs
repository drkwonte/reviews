const fs = require('fs')

try {
  let content = fs.readFileSync('prd.md', 'utf8')
  
  // 1. 구모델(2.0) 정보 2.5버전으로 교체
  content = content.replace(/Google Gemini 2\.0 Flash API/g, 'Google Gemini 2.5 Flash API')
  
  // 2. OCR 상세 설명 문구 업데이트
  const oldOcr = /AI OCR 분석\s+- 업로드된 이미지에서 문제 텍스트 및 수식을 자동 추출한다\./g
  const newOcr = `AI OCR 분석
  - 업로드된 이미지에서 문제 텍스트 및 수식을 자동 추출한다.
  - [중요] 신규 계정/프로젝트는 **Gemini 2.5 Flash API**를 사용해야 하며, 1.5/2.0 모델은 지원 중단(404/429)되었음을 확인했습니다.`
  
  content = content.replace(oldOcr, newOcr)
  
  // 3. 기록 버전 수정 (이스케이프 \*\* 추가)
  content = content.replace(/문서 버전\*\*: 1\.6/g, '문서 버전**: 1.7')
  content = content.replace(/최종 수정일\*\*: 2026-03-29/g, '최종 수정일**: 2026-03-30')

  fs.writeFileSync('prd.md', content, 'utf8')
  console.log('✅ PRD definitively updated to v1.7 (Gemini 2.5 Flash).')
} catch (err) {
  console.error('❌ PRD Update Failed:', err)
}
