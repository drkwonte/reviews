-- Multi-part problem / answer images (ordered). Legacy problem_url / answer_url remain for thumbnails and old rows.
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS problem_urls jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS answer_urls jsonb DEFAULT NULL;

COMMENT ON COLUMN public.notes.problem_urls IS 'Ordered array of storage paths or absolute URLs for each problem page';
COMMENT ON COLUMN public.notes.answer_urls IS 'Ordered array of storage paths or absolute URLs for each answer page';
