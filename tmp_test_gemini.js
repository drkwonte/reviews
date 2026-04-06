import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs'

async function runTest() {
  try {
    const envContent = fs.readFileSync('.env', 'utf8')
    const keyMatch = envContent.match(/VITE_GEMINI_API_KEY=([^\s]+)/)
    const API_KEY = keyMatch ? keyMatch[1].trim() : ''

    if (!API_KEY) {
      console.error('❌ 키 없음')
      return
    }

    console.log(`[Diagnostic] 사용 중인 키: ${API_KEY.substring(0, 10)}...`)
    
    // 이 키로 사용 가능한 "모든 모델 리스트" 구글에게 공수받기
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`)
    const data = await res.json()
    
    if (data.error) {
      console.error('❌ 구글 응답 에러:', data.error.message)
      if (data.error.message.includes('API key not valid')) {
        console.log('📌 해결책: .env의 API 키가 잘못 복사되었거나 유효하지 않습니다.')
      }
      return
    }

    console.log('✅ 가용 모델 리스트:', data.models.map(m => m.name).slice(0, 5))
    console.log('--------------------------------------------------')
    console.log('👉 위 목록에 gemini-1.5-flash 혹은 2.0-flash가 있는지 확인해 주세요.')
  } catch (err) {
    console.error('❌ 정밀 진단 실패:', err.message)
  }
}

runTest()
