-- =============================================
-- Nextime SaaS Subscription System
-- =============================================

-- 0. 확장 설치 (필요시)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. ENUM 타입 정의
-- =============================================

DO $$ BEGIN
    CREATE TYPE plan_type AS ENUM ('basic', 'premium');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'expired', 'past_due');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE billing_interval AS ENUM ('monthly', 'yearly');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'canceled', 'refunded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE subscription_event AS ENUM (
        'subscribed', 'renewed', 'cancel_requested', 'expired', 
        'reactivated', 'payment_failed', 'refunded', 'interval_changed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================
-- 2. 자동 업데이트 트리거 함수
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 3. subscriptions (구독 현황)
-- =============================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan                 plan_type NOT NULL DEFAULT 'basic',
    status               subscription_status NOT NULL DEFAULT 'active',
    billing_interval     billing_interval NOT NULL DEFAULT 'monthly',
    
    started_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end   TIMESTAMPTZ NOT NULL,
    
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    canceled_at          TIMESTAMPTZ,
    ended_at             TIMESTAMPTZ,
    
    price_amount         INTEGER NOT NULL,
    currency             CHAR(3) NOT NULL DEFAULT 'KRW',
    
    pg_billing_key       VARCHAR(255),
    cancel_reason        TEXT,
    
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 유효한 구독은 한 명당 하나만
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_active_subscription
    ON public.subscriptions(user_id)
    WHERE status IN ('active', 'canceled', 'past_due');

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "구독: 본인만 조회" 
    ON public.subscriptions FOR SELECT 
    USING (auth.uid() = user_id);

-- 업데이트 시 시간 자동 갱신 트리거
DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- 4. payment_orders (결제 내역)
-- =============================================
CREATE TABLE IF NOT EXISTS public.payment_orders (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription_id  UUID REFERENCES public.subscriptions(id),
    status           payment_status NOT NULL DEFAULT 'pending',
    amount           INTEGER NOT NULL,
    order_name       VARCHAR(200) NOT NULL,
    merchant_uid     VARCHAR(100) NOT NULL UNIQUE,
    pg_tid           VARCHAR(100),
    paid_at          TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "결제: 본인만 조회" 
    ON public.payment_orders FOR SELECT 
    USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_payment_orders_updated_at ON public.payment_orders;
CREATE TRIGGER trg_payment_orders_updated_at
    BEFORE UPDATE ON public.payment_orders
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- 5. 노트 개수 제한 로직
-- =============================================

CREATE OR REPLACE FUNCTION public.get_note_limit(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_status subscription_status;
    v_period_end TIMESTAMPTZ;
BEGIN
    SELECT status, current_period_end
    INTO v_status, v_period_end
    FROM public.subscriptions
    WHERE user_id = p_user_id
      AND status IN ('active', 'canceled', 'past_due')
    LIMIT 1;

    -- 유효한 구독이 있으면 무제한 (999,999)
    IF v_status IS NOT NULL AND v_period_end > NOW() THEN
        RETURN 999999;
    END IF;

    -- 무료 사용자 기본 한도 (30개)
    -- 나중에 정책에 따라 변경 가능
    RETURN 30;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_note_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
    v_limit INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.notes
    WHERE user_id = NEW.user_id;

    v_limit := public.get_note_limit(NEW.user_id);

    IF v_count >= v_limit THEN
        RAISE EXCEPTION 'PLAN_LIMIT_EXCEEDED: %개 상한 도달. 프리미엄 업그레이드를 검토하세요.', v_limit;
    END IF;

    RETURN NEW;
END;
$$;

-- 기존 notes 테이블에 트리거 장착
DROP TRIGGER IF EXISTS trg_check_note_limit ON public.notes;
CREATE TRIGGER trg_check_note_limit
    BEFORE INSERT ON public.notes
    FOR EACH ROW EXECUTE FUNCTION public.check_note_limit();

-- =============================================
-- 6. 통합 구독 상태 조회 뷰 (프론트엔드용)
-- =============================================
CREATE OR REPLACE VIEW public.user_plan_status AS
SELECT 
    p.id AS user_id,
    p.email,
    p.name,
    CASE 
        WHEN s.status IN ('active', 'canceled', 'past_due') AND s.current_period_end > NOW() THEN 'premium'::plan_type
        ELSE 'basic'::plan_type
    END AS current_plan,
    s.status AS subscription_status,
    s.current_period_end,
    COALESCE(s.current_period_end > NOW(), FALSE) AS is_premium
FROM public.profiles p
LEFT JOIN public.subscriptions s ON s.user_id = p.id AND s.status IN ('active', 'canceled', 'past_due');

-- =============================================
-- 7. 기존 데이터 마이그레이션 (옵션)
-- =============================================
-- -- profiles에서 plan 컬럼 제거가 필요할 시 실행
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS plan;
