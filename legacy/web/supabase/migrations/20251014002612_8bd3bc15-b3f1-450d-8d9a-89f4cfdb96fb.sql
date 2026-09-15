-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create user_progress table
CREATE TABLE public.user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  streak_days INTEGER DEFAULT 0,
  last_activity_date DATE DEFAULT CURRENT_DATE,
  total_lessons_completed INTEGER DEFAULT 0,
  total_scans INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own progress"
  ON public.user_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON public.user_progress FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
  ON public.user_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create lessons table
CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  xp_reward INTEGER DEFAULT 10,
  content JSONB,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view lessons"
  ON public.lessons FOR SELECT
  USING (true);

-- Create user_lesson_progress table
CREATE TABLE public.user_lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  score INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

ALTER TABLE public.user_lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own lesson progress"
  ON public.user_lesson_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lesson progress"
  ON public.user_lesson_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lesson progress"
  ON public.user_lesson_progress FOR UPDATE
  USING (auth.uid() = user_id);

-- Create achievements table
CREATE TABLE public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  requirement_type TEXT NOT NULL,
  requirement_value INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view achievements"
  ON public.achievements FOR SELECT
  USING (true);

-- Create user_achievements table
CREATE TABLE public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own achievements"
  ON public.user_achievements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own achievements"
  ON public.user_achievements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create scan_history table
CREATE TABLE public.scan_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  is_recyclable BOOLEAN NOT NULL,
  confidence_score FLOAT,
  category TEXT,
  instructions TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.scan_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scan history"
  ON public.scan_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scan history"
  ON public.scan_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create recycling_centers table
CREATE TABLE public.recycling_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  accepted_materials TEXT[] NOT NULL,
  phone TEXT,
  website TEXT,
  hours TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.recycling_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view recycling centers"
  ON public.recycling_centers FOR SELECT
  USING (true);

-- Create daily_quests table
CREATE TABLE public.daily_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  quest_type TEXT NOT NULL,
  target_value INTEGER NOT NULL,
  xp_reward INTEGER DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.daily_quests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view daily quests"
  ON public.daily_quests FOR SELECT
  USING (true);

-- Create user_daily_quests table
CREATE TABLE public.user_daily_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quest_id UUID NOT NULL REFERENCES public.daily_quests(id) ON DELETE CASCADE,
  current_progress INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  quest_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, quest_id, quest_date)
);

ALTER TABLE public.user_daily_quests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own daily quests"
  ON public.user_daily_quests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily quests"
  ON public.user_daily_quests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily quests"
  ON public.user_daily_quests FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  );
  
  INSERT INTO public.user_progress (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_progress_updated_at
  BEFORE UPDATE ON public.user_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample lessons
INSERT INTO public.lessons (title, description, category, difficulty, xp_reward, order_index) VALUES
('Turn Off Lights', 'Learn why turning off lights saves energy and reduces carbon emissions', 'Energy Saving', 'beginner', 10, 1),
('Unplug Devices', 'Discover phantom power and how unplugging saves electricity', 'Energy Saving', 'beginner', 10, 2),
('LED Bulbs', 'Switch to LED bulbs and cut energy use by 75%', 'Energy Saving', 'intermediate', 15, 3),
('Recycle Basics', 'Master the fundamentals of recycling', 'Waste Reduction', 'beginner', 10, 1),
('Composting 101', 'Start composting organic waste at home', 'Waste Reduction', 'intermediate', 15, 2),
('Zero Waste Shopping', 'Shop without creating waste', 'Waste Reduction', 'advanced', 20, 3),
('Plant-Based Meals', 'Reduce carbon footprint with plant-based eating', 'Sustainable Food', 'beginner', 10, 1),
('Local Food', 'Support local farmers and reduce food miles', 'Sustainable Food', 'intermediate', 15, 2),
('Public Transport', 'Use public transit to reduce emissions', 'Eco Travel', 'beginner', 10, 1),
('Bike Commuting', 'Start cycling for short trips', 'Eco Travel', 'intermediate', 15, 2);

-- Insert sample achievements
INSERT INTO public.achievements (title, description, icon, requirement_type, requirement_value) VALUES
('First Scan', 'Complete your first item scan', '🔍', 'scans', 1),
('Scan Master', 'Scan 10 items', '🎯', 'scans', 10),
('Scan Legend', 'Scan 50 items', '👑', 'scans', 50),
('First Lesson', 'Complete your first lesson', '📚', 'lessons', 1),
('Eco Student', 'Complete 5 lessons', '🎓', 'lessons', 5),
('Eco Expert', 'Complete 20 lessons', '🏆', 'lessons', 20),
('3 Day Streak', 'Maintain a 3-day streak', '🔥', 'streak', 3),
('Week Warrior', 'Maintain a 7-day streak', '⚡', 'streak', 7),
('Month Master', 'Maintain a 30-day streak', '💪', 'streak', 30),
('Level Up', 'Reach level 5', '⭐', 'level', 5);

-- Insert sample daily quests
INSERT INTO public.daily_quests (title, description, quest_type, target_value, xp_reward) VALUES
('Scan 3 Items', 'Use the scanner to identify 3 items today', 'scan', 3, 15),
('Complete a Lesson', 'Finish one eco-friendly lesson', 'lesson', 1, 20),
('Check Recycling Centers', 'Find a nearby recycling center', 'explore', 1, 10);

-- Insert sample recycling centers (you'll need to update with real data)
INSERT INTO public.recycling_centers (name, address, latitude, longitude, accepted_materials, phone, hours) VALUES
('Green Recycling Center', '123 Eco Street, Green City', 40.7128, -74.0060, ARRAY['plastic', 'glass', 'aluminum', 'paper', 'cardboard'], '555-0123', 'Mon-Sat 8AM-6PM'),
('EcoHub Facility', '456 Sustainability Ave', 40.7580, -73.9855, ARRAY['electronics', 'batteries', 'metal', 'plastic'], '555-0456', 'Mon-Fri 9AM-5PM'),
('Community Recycling', '789 Planet Road', 40.7489, -73.9680, ARRAY['paper', 'cardboard', 'glass', 'aluminum'], '555-0789', 'Daily 7AM-7PM');