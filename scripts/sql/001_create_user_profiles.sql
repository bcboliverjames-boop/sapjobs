CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cloudbase_uid text NOT NULL UNIQUE,

  nickname text,
  expertise_modules text,
  years_of_exp int CHECK (years_of_exp IS NULL OR years_of_exp >= 0),
  avatar_url text,

  wechat_id text,
  qq_id text,
  occupation text,
  can_share_contact boolean NOT NULL DEFAULT false,

  points int NOT NULL DEFAULT 0 CHECK (points >= 0),

  profile_completed_at timestamptz NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_points ON user_profiles(points DESC);

CREATE OR REPLACE FUNCTION set_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_profiles_set_updated_at ON user_profiles;
CREATE TRIGGER trg_user_profiles_set_updated_at
BEFORE UPDATE ON user_profiles
FOR EACH ROW
EXECUTE PROCEDURE set_user_profiles_updated_at();
