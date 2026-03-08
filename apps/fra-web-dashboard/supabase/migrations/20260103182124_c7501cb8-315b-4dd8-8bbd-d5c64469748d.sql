-- Create sector enum
CREATE TYPE public.org_sector AS ENUM ('public', 'charity', 'private');

-- Create role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'facilitator', 'participant');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  organization_name TEXT NOT NULL,
  sector public.org_sector NOT NULL DEFAULT 'private',
  job_title TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Create workshop_sessions table for live sessions
CREATE TABLE public.workshop_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'Fraud Risk Awareness Workshop',
  session_code TEXT NOT NULL UNIQUE,
  facilitator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  current_slide INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE
);

-- Create session_participants table
CREATE TABLE public.session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.workshop_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)
);

-- Create workshop_progress table
CREATE TABLE public.workshop_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES public.workshop_sessions(id) ON DELETE CASCADE,
  current_section INTEGER NOT NULL DEFAULT 0,
  completed_sections INTEGER[] NOT NULL DEFAULT '{}',
  quiz_scores JSONB NOT NULL DEFAULT '{}',
  scenario_choices JSONB NOT NULL DEFAULT '{}',
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_id)
);

-- Create polls table
CREATE TABLE public.polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.workshop_sessions(id) ON DELETE CASCADE NOT NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create poll_responses table
CREATE TABLE public.poll_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  selected_option INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (poll_id, user_id)
);

-- Create questions table for Q&A
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.workshop_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  is_answered BOOLEAN NOT NULL DEFAULT false,
  upvotes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create question_upvotes table
CREATE TABLE public.question_upvotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (question_id, user_id)
);

-- Create action_plans table
CREATE TABLE public.action_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES public.workshop_sessions(id) ON DELETE CASCADE,
  action_items JSONB NOT NULL DEFAULT '[]',
  commitments TEXT[],
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_id)
);

-- Create certificates table
CREATE TABLE public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES public.workshop_sessions(id) ON DELETE CASCADE,
  certificate_number TEXT NOT NULL UNIQUE,
  issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create feedback table
CREATE TABLE public.workshop_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES public.workshop_sessions(id) ON DELETE CASCADE,
  effectiveness_rating INTEGER CHECK (effectiveness_rating >= 1 AND effectiveness_rating <= 5),
  feedback_text TEXT,
  suggestions TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshop_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshop_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_upvotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshop_feedback ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, organization_name, sector, job_title)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'User'),
    COALESCE(NEW.raw_user_meta_data ->> 'organization_name', 'Organization'),
    COALESCE((NEW.raw_user_meta_data ->> 'sector')::public.org_sector, 'private'),
    NEW.raw_user_meta_data ->> 'job_title'
  );
  -- Assign default participant role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'participant');
  RETURN NEW;
END;
$$;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_workshop_progress_updated_at
  BEFORE UPDATE ON public.workshop_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Generate session code function
CREATE OR REPLACE FUNCTION public.generate_session_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- RLS Policies

-- Profiles: users can view all profiles but only update their own
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- User roles: only admins can manage, users can view their own
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Workshop sessions: facilitators can create, participants can view active
CREATE POLICY "Facilitators can create sessions"
  ON public.workshop_sessions FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'facilitator') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Facilitators can update their sessions"
  ON public.workshop_sessions FOR UPDATE
  TO authenticated
  USING (facilitator_id = auth.uid());

CREATE POLICY "Users can view sessions they participate in"
  ON public.workshop_sessions FOR SELECT
  TO authenticated
  USING (
    facilitator_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.session_participants
      WHERE session_id = workshop_sessions.id AND user_id = auth.uid()
    ) OR
    is_active = true
  );

-- Session participants
CREATE POLICY "Users can join sessions"
  ON public.session_participants FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view session participants"
  ON public.session_participants FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.workshop_sessions
      WHERE id = session_participants.session_id AND facilitator_id = auth.uid()
    )
  );

-- Workshop progress
CREATE POLICY "Users can manage their own progress"
  ON public.workshop_progress FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Polls: facilitators manage, participants view active
CREATE POLICY "Facilitators can manage polls"
  ON public.polls FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workshop_sessions
      WHERE id = polls.session_id AND facilitator_id = auth.uid()
    )
  );

CREATE POLICY "Participants can view polls"
  ON public.polls FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.session_participants
      WHERE session_id = polls.session_id AND user_id = auth.uid()
    )
  );

-- Poll responses
CREATE POLICY "Users can submit and view their responses"
  ON public.poll_responses FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Facilitators can view all responses"
  ON public.poll_responses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.polls p
      JOIN public.workshop_sessions s ON s.id = p.session_id
      WHERE p.id = poll_responses.poll_id AND s.facilitator_id = auth.uid()
    )
  );

-- Questions
CREATE POLICY "Users can create questions"
  ON public.questions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Session participants can view questions"
  ON public.questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.session_participants
      WHERE session_id = questions.session_id AND user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.workshop_sessions
      WHERE id = questions.session_id AND facilitator_id = auth.uid()
    )
  );

CREATE POLICY "Facilitators can update questions"
  ON public.questions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workshop_sessions
      WHERE id = questions.session_id AND facilitator_id = auth.uid()
    )
  );

-- Question upvotes
CREATE POLICY "Users can manage their upvotes"
  ON public.question_upvotes FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Action plans
CREATE POLICY "Users can manage their action plans"
  ON public.action_plans FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Certificates
CREATE POLICY "Users can view their certificates"
  ON public.certificates FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can create certificates"
  ON public.certificates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Workshop feedback
CREATE POLICY "Users can manage their feedback"
  ON public.workshop_feedback FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Enable realtime for live collaboration
ALTER PUBLICATION supabase_realtime ADD TABLE public.polls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_responses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.questions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.question_upvotes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workshop_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_participants;