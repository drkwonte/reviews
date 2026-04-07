-- ============================================================
-- 온라인 오답노트 SaaS - Admin 전체 스키마 (최종 정밀 튜닝 버전)
-- Supabase / PostgreSQL
-- ============================================================

-- ============================================================
-- A. admin_users 테이블 (관리자 권한 격리)
-- ============================================================
CREATE TYPE public.admin_role AS ENUM ('superadmin', 'admin');

CREATE TABLE IF NOT EXISTS public.admin_users (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role        admin_role NOT NULL DEFAULT 'admin',
    memo        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

REVOKE ALL ON public.admin_users FROM authenticated, anon;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid());
END;
$$;

-- ============================================================
-- B. app_settings 테이블 (시스템 전역 동적 설정)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
    key          VARCHAR(100) PRIMARY KEY,
    value        TEXT NOT NULL,
    value_type   VARCHAR(20) NOT NULL DEFAULT 'text',
    description  TEXT,
    is_public    BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by   UUID REFERENCES auth.users(id),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 기본 설정값 (프리티어 한도 포함)
INSERT INTO public.app_settings (key, value, value_type, description, is_public) VALUES
    ('basic_note_limit',      '30',    'integer', '무료 플랜 노트 최대 저장 개수', false),
    ('premium_note_limit',    '99999', 'integer', '프리미엄 플랜 노트 최대 저장 개수', false),
    ('max_upload_size_mb',    '5',     'integer', '단일 이미지 최대 업로드 크기 (MB)', true),
    ('maintenance_mode',      'false', 'boolean', '시스템 점검 모드 활성화', true)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin All Access" ON public.app_settings FOR ALL USING (public.is_admin());

-- ============================================================
-- C. notifications 테이블 (통합 공지 시스템)
-- ============================================================
DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM ('info', 'warning', 'success', 'error');
    CREATE TYPE notification_category AS ENUM ('system', 'billing', 'limit', 'event', 'personal');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.notifications (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    target_user_id  UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL이면 전체 공지
    type            notification_type NOT NULL DEFAULT 'info',
    category        notification_category NOT NULL DEFAULT 'system',
    title           VARCHAR(200) NOT NULL,
    body            TEXT NOT NULL,
    link            VARCHAR(500),
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    read_at         TIMESTAMPTZ,
    is_dismissed    BOOLEAN NOT NULL DEFAULT FALSE,
    sent_by         UUID REFERENCES auth.users(id),
    expires_at      TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User Read Own or Global" ON public.notifications FOR SELECT USING (auth.uid() = target_user_id OR target_user_id IS NULL);
CREATE POLICY "Admin Full Access" ON public.notifications FOR ALL USING (public.is_admin());

-- ============================================================
-- D. admin_stats_daily 테이블 (지표 트래킹 - 수입/용량/유저)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_stats_daily (
    stat_date              DATE PRIMARY KEY,
    total_users            INTEGER NOT NULL DEFAULT 0,
    new_users_today        INTEGER NOT NULL DEFAULT 0,
    premium_users          INTEGER NOT NULL DEFAULT 0,
    total_notes            INTEGER NOT NULL DEFAULT 0,
    total_storage_bytes    BIGINT NOT NULL DEFAULT 0, -- 전체 이미지 사용량
    db_size_bytes          BIGINT NOT NULL DEFAULT 0, -- 전체 DB 크기
    revenue_today          INTEGER NOT NULL DEFAULT 0,
    revenue_month          INTEGER NOT NULL DEFAULT 0,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 집계 자동화 프로시저
CREATE OR REPLACE FUNCTION public.collect_daily_stats()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.admin_stats_daily (
        stat_date, total_users, new_users_today, premium_users, 
        total_notes, total_storage_bytes, db_size_bytes, revenue_today, revenue_month
    )
    SELECT
        CURRENT_DATE,
        (SELECT COUNT(*) FROM auth.users),
        (SELECT COUNT(*) FROM auth.users WHERE created_at >= CURRENT_DATE),
        (SELECT COUNT(*) FROM public.subscriptions WHERE status = 'active' AND current_period_end > NOW()),
        (SELECT COUNT(*) FROM public.notes),
        (SELECT COALESCE(SUM((metadata->>'size')::BIGINT), 0) FROM storage.objects),
        (SELECT pg_database_size(current_database())),
        (SELECT COALESCE(SUM(amount), 0) FROM public.payment_orders WHERE status = 'paid' AND paid_at >= CURRENT_DATE),
        (SELECT COALESCE(SUM(amount), 0) FROM public.payment_orders WHERE status = 'paid' AND paid_at >= DATE_TRUNC('month', CURRENT_DATE))
    ON CONFLICT (stat_date) DO UPDATE SET
        total_users = EXCLUDED.total_users,
        premium_users = EXCLUDED.premium_users,
        total_notes = EXCLUDED.total_notes,
        total_storage_bytes = EXCLUDED.total_storage_bytes,
        db_size_bytes = EXCLUDED.db_size_bytes,
        revenue_today = EXCLUDED.revenue_today,
        revenue_month = EXCLUDED.revenue_month;
END;
$$;

-- ============================================================
-- E. admin_user_overview (어드민 전용 유저 목록 뷰)
-- ============================================================
CREATE OR REPLACE VIEW public.admin_user_overview AS
SELECT
    p.id AS user_id,
    p.email,
    p.name,
    p.user_type,
    p.created_at AS joined_at,
    COALESCE(s.plan, 'basic') AS current_plan,
    s.current_period_end,
    (SELECT COUNT(*) FROM public.notes n WHERE n.user_id = p.id) AS note_count,
    (SELECT COALESCE(SUM(amount), 0) FROM public.payment_orders po WHERE po.user_id = p.id AND po.status = 'paid') AS total_paid
FROM public.profiles p
LEFT JOIN public.subscriptions s ON s.user_id = p.id AND s.status = 'active';

-- ============================================================
-- F. admin_audit_logs (관리자 행위 감사)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    admin_id      UUID NOT NULL REFERENCES auth.users(id),
    action        VARCHAR(100) NOT NULL,
    target_id     TEXT,
    old_data      JSONB,
    new_data      JSONB,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin Audit Access" ON public.admin_audit_logs FOR SELECT USING (public.is_admin());
