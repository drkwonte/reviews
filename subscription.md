# Nextime SaaS 유료화 설계 및 이행 가이드

이 문서는 Nextime 플랫폼의 무료/유료 모델 전환을 위한 데이터베이스 설계 및 단계별 이행 로드맵을 담고 있습니다.

## 1. 최종 SQL 스키마 (Supabase 전용)

아래 스크립트는 Supabase SQL Editor에서 실행하여 인프라를 구축할 수 있습니다.

```sql
-- =============================================
-- Nextime SaaS Subscription System
-- =============================================

-- 0. 확장 설치
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUM 타입 정의
DO $$ BEGIN
    CREATE TYPE plan_type AS ENUM ('basic', 'premium');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'expired', 'past_due');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE billing_interval AS ENUM ('monthly', 'yearly');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'canceled', 'refunded');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. 공용 관리 함수
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. 구독 현황 테이블 (subscriptions)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan                 plan_type NOT NULL DEFAULT 'basic',
    status               subscription_status NOT NULL DEFAULT 'active',
    billing_interval     billing_interval NOT NULL DEFAULT 'monthly',
    started_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end   TIMESTAMPTZ NOT NULL,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    price_amount         INTEGER NOT NULL,
    currency             CHAR(3) NOT NULL DEFAULT 'KRW',
    pg_billing_key       VARCHAR(255),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_one_active_subscription
    ON public.subscriptions(user_id)
    WHERE status IN ('active', 'canceled', 'past_due');

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "구독: 본인만 조회" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

CREATE TRIGGER trg_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4. 결제 내역 테이블 (payment_orders)
CREATE TABLE IF NOT EXISTS public.payment_orders (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription_id  UUID REFERENCES public.subscriptions(id),
    status           payment_status NOT NULL DEFAULT 'pending',
    amount           INTEGER NOT NULL,
    merchant_uid     VARCHAR(100) NOT NULL UNIQUE,
    paid_at          TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "결제: 본인만 조회" ON public.payment_orders FOR SELECT USING (auth.uid() = user_id);

-- 5. 플랜별 제약 로직 (Trigger)
CREATE OR REPLACE FUNCTION public.get_note_limit(p_user_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_status subscription_status;
    v_period_end TIMESTAMPTZ;
BEGIN
    SELECT status, current_period_end INTO v_status, v_period_end
    FROM public.subscriptions WHERE user_id = p_user_id AND status IN ('active', 'canceled', 'past_due') LIMIT 1;
    IF v_status IS NOT NULL AND v_period_end > NOW() THEN RETURN 999999; END IF;
    RETURN 30; -- 무료 한도
END;
$$;

CREATE OR REPLACE FUNCTION public.check_note_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM public.notes WHERE user_id = NEW.user_id) >= public.get_note_limit(NEW.user_id) THEN
        RAISE EXCEPTION 'PLAN_LIMIT_EXCEEDED';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_note_limit ON public.notes;
CREATE TRIGGER trg_check_note_limit BEFORE INSERT ON public.notes FOR EACH ROW EXECUTE FUNCTION public.check_note_limit();

-- 6. 통합 상태 뷰 (user_plan_status)
CREATE OR REPLACE VIEW public.user_plan_status AS
SELECT 
    p.id AS user_id, p.email, p.name,
    CASE WHEN s.status IN ('active', 'canceled', 'past_due') AND s.current_period_end > NOW() THEN 'premium'::plan_type ELSE 'basic'::plan_type END AS current_plan,
    s.current_period_end,
    COALESCE(s.current_period_end > NOW(), FALSE) AS is_premium
FROM public.profiles p
LEFT JOIN public.subscriptions s ON s.user_id = p.id AND s.status IN ('active', 'canceled', 'past_due');
```

## 2. 유료화 전환을 위한 4단계 로드맵

### 1단계: 인프라 기반 구축 (현재 완료 예정)
- 위 SQL 스크립트를 Supabase에 적용합니다.
- 기존 유저들의 기본 플랜을 `basic`으로 설정합니다.

### 2단계: 결제 게이트웨이(PG) 연동
- **Stripe** 또는 **토스페이먼츠/이니시스**와 연동할 Supabase Edge Functions를 생성합니다.
- 결제 성공 시 `payment_orders`와 `subscriptions` 테이블을 업데이트하는 Webhook 로직을 구현합니다.

### 3단계: 프론트엔드 구독 관리 UI
- 요금제 선택 페이지(Pricing Page)를 제작합니다.
- 사용자의 `user_plan_status` 뷰를 조회하여, 프리미엄 기능을 활성화/비활성화합니다.
- 노트 저장 시 `PLAN_LIMIT_EXCEEDED` 에러가 발생하면 업그레이드 유도 모달을 띄웁니다.

### 4단계: 운영 자동화
- `pg_cron` 확장을 활성화하여 매일 새벽 만료된 구독을 자동으로 `expired` 처리합니다.
- 구독 만료 3일 전 자동 알림(이메일/푸시) 기능을 추가합니다.
