========================================================================
데이터베이스 설계: 틀리GO
========================================================================

문서 버전: 2.1
작성일: 2026-03-18
최종 수정일: 2026-03-29
상태: In Progress
관련 문서: prd.md

========================================================================

1. # ER 다이어그램

auth.users → 1:1 → profiles → 1:N → notes → 1:N → review_logs

======================================================================== 2. 테이블 정의
========================================================================

[2.1] profiles (사용자 프로필)

id UUID PK, FK→auth.users.id 사용자 고유 ID
email Text NOT NULL, UNIQUE 이메일 주소
name Text NOT NULL 사용자 이름
user_type Text NOT NULL, DEFAULT student student 또는 admin
user_level Text (nullable) 학습 단계
marketing_agreed Boolean NOT NULL, DEFAULT false [선택] 마케팅 정보 수신 동의 여부
created_at Timestamptz NOT NULL, DEFAULT now() 계정 생성일

[2.2] notes (오답 노트)

id UUID PK, DEFAULT gen_random_uuid() 노트 고유 ID
user_id UUID NOT NULL, FK→profiles.id 작성자
subject Text NOT NULL 과목
category Text (nullable) 분야/단원
source Text (nullable) 문제 출처
problem_url Text NOT NULL 문제 이미지 경로
problem_text Text NOT NULL 문제 OCR 텍스트
answer_url Text (nullable) 정답 이미지 경로
answer_text Text NOT NULL 정답 텍스트
review_count Integer NOT NULL, DEFAULT 0 총 복습 횟수
success_count Integer NOT NULL, DEFAULT 0 정답 횟수
accuracy Float NOT NULL, DEFAULT 0 정답률 자동계산
is_favorite Boolean NOT NULL, DEFAULT false 즐겨찾기
last_review_at Timestamptz (nullable) 마지막 복습일
created_at Timestamptz NOT NULL, DEFAULT now() 등록일

[2.3] review_logs (복습 기록)

id UUID PK, DEFAULT gen_random_uuid() 기록 ID
note_id UUID NOT NULL, FK→notes.id 대상 노트
user_id UUID NOT NULL, FK→profiles.id 사용자
result Text NOT NULL, CHECK(success/fail) 결과
memo Text (nullable) 복습 메모
attempted_at Timestamptz NOT NULL, DEFAULT now() 시도 일시

======================================================================== 3. 인덱스
========================================================================

notes idx_notes_user_created (user_id, created_at DESC) 목록 조회
notes idx_notes_user_subject (user_id, subject) 과목 필터
notes idx_notes_accuracy (user_id, accuracy) 성공률 정렬
notes idx_notes_text_search GIN(to_tsvector('korean', problem_text)) 전문 검색
review_logs idx_review_note (note_id, attempted_at DESC) 노트별 이력
review_logs idx_review_user_date (user_id, attempted_at DESC) 일별 통계

======================================================================== 4. RLS 정책
========================================================================

profiles: SELECT/UPDATE/DELETE WHERE auth.uid() = id
notes: SELECT/INSERT/UPDATE/DELETE WHERE auth.uid() = user_id
review_logs: SELECT/INSERT WHERE auth.uid() = user_id
Storage: auth.uid()::text = (storage.foldername(name))[1]

======================================================================== 5. 트리거
========================================================================

[5.1] handle_new_user()
auth.users INSERT → profiles 자동 생성

[5.2] update_review_stats()
review_logs INSERT → notes의 review_count, success_count, accuracy, last_review_at 갱신
accuracy = CASE WHEN review_count+1=0 THEN 0
ELSE (success_count + CASE WHEN result='success' THEN 1 ELSE 0 END)::float
/ (review_count + 1)
END

======================================================================== 6. SQL 마이그레이션
========================================================================

## [6.1] 테이블 생성

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  user_type TEXT NOT NULL DEFAULT 'student' CHECK (user_type IN ('student', 'admin')),
  user_level TEXT,
  marketing_agreed BOOLEAN NOT NULL DEFAULT false,  -- [선택] 마케팅 정보 수신 동의 여부
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE USING (auth.uid() = id);

-- notes
CREATE TABLE public.notes (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
subject TEXT NOT NULL,
category TEXT,
source TEXT,
problem_url TEXT NOT NULL,
problem_text TEXT NOT NULL,
answer_url TEXT,
answer_text TEXT NOT NULL,
review_count INTEGER NOT NULL DEFAULT 0,
success_count INTEGER NOT NULL DEFAULT 0,
accuracy FLOAT NOT NULL DEFAULT 0,
is_favorite BOOLEAN NOT NULL DEFAULT false,
last_review_at TIMESTAMPTZ,
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notes_select" ON public.notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notes_insert" ON public.notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notes_update" ON public.notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notes_delete" ON public.notes FOR DELETE USING (auth.uid() = user_id);

-- review_logs
CREATE TABLE public.review_logs (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
result TEXT NOT NULL CHECK (result IN ('success', 'fail')),
memo TEXT,
attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.review_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "review_logs_select" ON public.review_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "review_logs_insert" ON public.review_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

## [6.2] 인덱스 생성

CREATE INDEX idx_notes_user_created ON public.notes (user_id, created_at DESC);
CREATE INDEX idx_notes_user_subject ON public.notes (user_id, subject);
CREATE INDEX idx_notes_accuracy ON public.notes (user_id, accuracy);
CREATE INDEX idx_notes_text_search ON public.notes USING GIN (to_tsvector('korean', problem_text));
CREATE INDEX idx_review_note ON public.review_logs (note_id, attempted_at DESC);
CREATE INDEX idx_review_user_date ON public.review_logs (user_id, attempted_at DESC);

## [6.3] 트리거/함수

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, marketing_agreed)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '사용자'),
    COALESCE((NEW.raw_user_meta_data->>'marketing_agreed')::boolean, false)
  );
  RETURN NEW;
END;

$$
LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_review_stats()
RETURNS TRIGGER AS
$$

BEGIN
UPDATE public.notes
SET
review_count = review_count + 1,
success_count = success_count + CASE WHEN NEW.result = 'success' THEN 1 ELSE 0 END,
accuracy = CASE
WHEN review_count + 1 = 0 THEN 0
ELSE (success_count + CASE WHEN NEW.result = 'success' THEN 1 ELSE 0 END)::float / (review_count + 1)
END,
last_review_at = NEW.attempted_at
WHERE id = NEW.note_id;
RETURN NEW;
END;

$$
LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_review_log_inserted
  AFTER INSERT ON public.review_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_review_stats();

========================================================================
7. 이미지 저장 경로
========================================================================

버킷: question-images

  {user_id}/{note_id}/problem_{timestamp}.webp        문제 이미지
  {user_id}/{note_id}/problem_thumb_{timestamp}.webp   썸네일
  {user_id}/{note_id}/answer_{timestamp}.webp          정답 이미지

notes.problem_url, answer_url에 위 경로 저장. Signed URL로 표시.

========================================================================
8. 쿼리 예시
========================================================================

[8.1] 목록 (과목 필터 + 최신순)

SELECT id, subject, category, source, problem_url,
       review_count, accuracy, is_favorite, created_at
FROM notes
WHERE user_id = :user_id AND (:subject IS NULL OR subject = :subject)
ORDER BY created_at DESC LIMIT 20 OFFSET :offset;

[8.2] 상세 + 복습이력

SELECT * FROM notes WHERE id = :note_id AND user_id = :user_id;

SELECT result, memo, attempted_at FROM review_logs
WHERE note_id = :note_id ORDER BY attempted_at DESC;

[8.3] 과목별 통계

SELECT subject, COUNT(*) AS total, AVG(accuracy) AS avg_accuracy,
       SUM(review_count) AS reviews
FROM notes WHERE user_id = :user_id GROUP BY subject ORDER BY total DESC;

[8.4] 전문 검색

SELECT id, subject, problem_text, accuracy FROM notes
WHERE user_id = :user_id
  AND to_tsvector('korean', problem_text) @@ plainto_tsquery('korean', :term)
ORDER BY created_at DESC;

[8.5] 복습 추천

SELECT id, subject, category, accuracy, last_review_at FROM notes
WHERE user_id = :user_id AND accuracy < 0.6
ORDER BY last_review_at ASC NULLS FIRST, accuracy ASC LIMIT 10;

[8.6] 일별 학습량

SELECT DATE(attempted_at) AS d, COUNT(*) AS total,
       COUNT(*) FILTER (WHERE result = 'success') AS successes
FROM review_logs
WHERE user_id = :user_id AND attempted_at >= :start
GROUP BY d ORDER BY d;

========================================================================
9. 마이그레이션 체크리스트
========================================================================

[ ] 1. Supabase 프로젝트 생성
[ ] 2. 6.1 테이블 SQL 실행
[ ] 3. 6.2 인덱스 SQL 실행
[ ] 4. 6.3 트리거/함수 SQL 실행
[ ] 5. Storage 버킷 생성 + RLS
[ ] 6. RLS 차단 테스트
[ ] 7. CRUD 테스트
[ ] 8. 이미지 업로드/Signed URL 테스트
[ ] 9. review_logs → notes 통계 갱신 확인
[ ] 10. 전문 검색 동작 확인

========================================================================
변경 이력
========================================================================

1.0  2026-03-18  최초 작성
2.0  2026-03-28  전면 재설계. questions→notes. content_blocks/subjects/tags/folders
                 제거. notes에 통합(problem_url/text, answer_url/text). user_type,
                 user_level, is_favorite, accuracy 추가. review_logs 유지.
                 트리거 단순화.
2.1  2026-03-29  profiles에 marketing_agreed(Boolean, DEFAULT false) 추가.
                 handle_new_user 트리거에서 raw_user_meta_data의 marketing_agreed
                 값을 읽어 자동 저장. [선택] 마케팅 수신 동의 여부 관리 목적.

========================================================================
문서 끝
========================================================================
$$
