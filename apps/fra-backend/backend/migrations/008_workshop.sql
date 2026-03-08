-- 008_workshop.sql: Workshop tables (migrated from Supabase)
-- All tables use IF NOT EXISTS for idempotent re-runs.

-- Workshop profiles (extends user data with workshop-specific fields)
CREATE TABLE IF NOT EXISTS public.workshop_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  organization_name text NOT NULL DEFAULT '',
  sector text NOT NULL DEFAULT 'private' CHECK (sector IN ('public', 'charity', 'private')),
  job_title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workshop_profiles_user_id_idx
  ON public.workshop_profiles(user_id);

-- Workshop roles (admin, facilitator, participant — orthogonal to platform role)
CREATE TABLE IF NOT EXISTS public.workshop_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'facilitator', 'participant')),
  UNIQUE(user_id, role)
);

CREATE INDEX IF NOT EXISTS workshop_roles_user_id_idx
  ON public.workshop_roles(user_id);

-- Workshop sessions (facilitator-led live sessions)
CREATE TABLE IF NOT EXISTS public.workshop_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facilitator_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_code text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT 'Workshop Session',
  current_slide integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

CREATE INDEX IF NOT EXISTS workshop_sessions_facilitator_id_idx
  ON public.workshop_sessions(facilitator_id);
CREATE INDEX IF NOT EXISTS workshop_sessions_session_code_idx
  ON public.workshop_sessions(session_code);
CREATE INDEX IF NOT EXISTS workshop_sessions_is_active_idx
  ON public.workshop_sessions(is_active);

-- Session participants
CREATE TABLE IF NOT EXISTS public.session_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.workshop_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, user_id)
);

CREATE INDEX IF NOT EXISTS session_participants_session_id_idx
  ON public.session_participants(session_id);

-- Workshop progress
CREATE TABLE IF NOT EXISTS public.workshop_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.workshop_sessions(id) ON DELETE SET NULL,
  current_section integer NOT NULL DEFAULT 0,
  completed_sections integer[] NOT NULL DEFAULT '{}',
  quiz_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  scenario_choices jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS workshop_progress_user_session_idx
  ON public.workshop_progress(user_id, COALESCE(session_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS workshop_progress_user_id_idx
  ON public.workshop_progress(user_id);

-- Polls (live polling during sessions)
CREATE TABLE IF NOT EXISTS public.polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.workshop_sessions(id) ON DELETE CASCADE,
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS polls_session_id_idx ON public.polls(session_id);

-- Poll responses
CREATE TABLE IF NOT EXISTS public.poll_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  selected_option integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS poll_responses_poll_id_idx ON public.poll_responses(poll_id);

-- Questions (Q&A during sessions)
CREATE TABLE IF NOT EXISTS public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.workshop_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  upvotes integer NOT NULL DEFAULT 0,
  is_answered boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS questions_session_id_idx ON public.questions(session_id);

-- Question upvotes
CREATE TABLE IF NOT EXISTS public.question_upvotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(question_id, user_id)
);

CREATE INDEX IF NOT EXISTS question_upvotes_question_id_idx
  ON public.question_upvotes(question_id);

-- Action plans (post-workshop commitments)
CREATE TABLE IF NOT EXISTS public.action_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.workshop_sessions(id) ON DELETE SET NULL,
  action_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  commitments text[] DEFAULT '{}',
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS action_plans_user_id_idx ON public.action_plans(user_id);

-- Certificates (completion certificates)
CREATE TABLE IF NOT EXISTS public.certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.workshop_sessions(id) ON DELETE SET NULL,
  certificate_number text NOT NULL UNIQUE,
  issued_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS certificates_user_id_idx ON public.certificates(user_id);
CREATE INDEX IF NOT EXISTS certificates_number_idx ON public.certificates(certificate_number);

-- Workshop feedback
CREATE TABLE IF NOT EXISTS public.workshop_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.workshop_sessions(id) ON DELETE SET NULL,
  effectiveness_rating integer,
  feedback_text text,
  suggestions text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workshop_feedback_user_id_idx ON public.workshop_feedback(user_id);
