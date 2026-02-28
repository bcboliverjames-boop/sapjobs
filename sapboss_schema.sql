--
-- PostgreSQL database dump
--

-- Dumped from database version 10.23
-- Dumped by pg_dump version 10.23

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: plpgsql; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS plpgsql WITH SCHEMA pg_catalog;


--
-- Name: EXTENSION plpgsql; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION plpgsql IS 'PL/pgSQL procedural language';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: set_user_profiles_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_user_profiles_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_with_oids = false;

--
-- Name: app_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_accounts (
    uid text NOT NULL,
    identifier_type text NOT NULL,
    identifier_norm text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    phone_norm text,
    email_norm text,
    username_norm text
);


--
-- Name: sap_contact_unlock_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sap_contact_unlock_limits (
    uid text NOT NULL,
    day text NOT NULL,
    count integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sap_contact_unlock_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sap_contact_unlock_logs (
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    uid text NOT NULL,
    day text NOT NULL,
    demand_id text NOT NULL,
    target_provider_user_id text NOT NULL,
    target_raw_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sap_demands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sap_demands (
    id bigint NOT NULL,
    demand_key text NOT NULL,
    raw_text text NOT NULL,
    module_codes text[] DEFAULT '{}'::text[] NOT NULL,
    module_labels text[] DEFAULT '{}'::text[] NOT NULL,
    city text,
    duration_text text,
    years_text text,
    language text,
    daily_rate text,
    is_remote boolean,
    cooperation_mode text,
    work_mode text,
    consultant_level text,
    project_cycle text,
    time_requirement text,
    provider_name text,
    provider_user_id text,
    unique_demand_id text,
    unique_override_by text,
    unique_override_at timestamp with time zone,
    source text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sap_demands_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sap_demands_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sap_demands_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sap_demands_id_seq OWNED BY public.sap_demands.id;


--
-- Name: sap_unique_demands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sap_unique_demands (
    doc_id text NOT NULL,
    local_id bigint,
    raw_text text,
    tags_json text,
    attributes_json text,
    demand_type text,
    richness_score integer,
    created_time timestamp with time zone,
    message_time timestamp with time zone,
    updated_at timestamp with time zone,
    last_updated_time timestamp with time zone,
    created_time_ts bigint,
    message_time_ts bigint,
    updated_at_ts bigint,
    last_updated_time_ts bigint,
    synced_at timestamp with time zone,
    source text,
    canonical_raw_id text,
    canonical_set_by text,
    canonical_set_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at_db timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ugc_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ugc_comments (
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    demand_id text NOT NULL,
    uid text NOT NULL,
    nickname text,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ugc_rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ugc_rate_limits (
    uid text NOT NULL,
    action text NOT NULL,
    last_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ugc_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ugc_reactions (
    comment_id uuid NOT NULL,
    uid text NOT NULL,
    reaction smallint NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ugc_reactions_reaction_check CHECK ((reaction = ANY (ARRAY[1, '-1'::integer])))
);


--
-- Name: ugc_replies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ugc_replies (
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    comment_id uuid NOT NULL,
    uid text NOT NULL,
    nickname text,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profiles (
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    cloudbase_uid text NOT NULL,
    nickname text,
    expertise_modules text,
    years_of_exp integer,
    avatar_url text,
    wechat_id text,
    qq_id text,
    can_share_contact boolean DEFAULT false NOT NULL,
    points integer DEFAULT 0 NOT NULL,
    profile_completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    occupation text,
    CONSTRAINT user_profiles_points_check CHECK ((points >= 0)),
    CONSTRAINT user_profiles_years_of_exp_check CHECK (((years_of_exp IS NULL) OR (years_of_exp >= 0)))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    uid text NOT NULL,
    nickname text,
    points integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sap_demands id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sap_demands ALTER COLUMN id SET DEFAULT nextval('public.sap_demands_id_seq'::regclass);


--
-- Name: app_accounts app_accounts_identifier_norm_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_accounts
    ADD CONSTRAINT app_accounts_identifier_norm_key UNIQUE (identifier_norm);


--
-- Name: app_accounts app_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_accounts
    ADD CONSTRAINT app_accounts_pkey PRIMARY KEY (uid);


--
-- Name: sap_contact_unlock_limits sap_contact_unlock_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sap_contact_unlock_limits
    ADD CONSTRAINT sap_contact_unlock_limits_pkey PRIMARY KEY (uid, day);


--
-- Name: sap_contact_unlock_logs sap_contact_unlock_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sap_contact_unlock_logs
    ADD CONSTRAINT sap_contact_unlock_logs_pkey PRIMARY KEY (id);


--
-- Name: sap_contact_unlock_logs sap_contact_unlock_logs_uid_day_demand_id_target_provider_u_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sap_contact_unlock_logs
    ADD CONSTRAINT sap_contact_unlock_logs_uid_day_demand_id_target_provider_u_key UNIQUE (uid, day, demand_id, target_provider_user_id);


--
-- Name: sap_demands sap_demands_demand_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sap_demands
    ADD CONSTRAINT sap_demands_demand_key_key UNIQUE (demand_key);


--
-- Name: sap_demands sap_demands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sap_demands
    ADD CONSTRAINT sap_demands_pkey PRIMARY KEY (id);


--
-- Name: sap_unique_demands sap_unique_demands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sap_unique_demands
    ADD CONSTRAINT sap_unique_demands_pkey PRIMARY KEY (doc_id);


--
-- Name: ugc_comments ugc_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ugc_comments
    ADD CONSTRAINT ugc_comments_pkey PRIMARY KEY (id);


--
-- Name: ugc_rate_limits ugc_rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ugc_rate_limits
    ADD CONSTRAINT ugc_rate_limits_pkey PRIMARY KEY (uid, action);


--
-- Name: ugc_reactions ugc_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ugc_reactions
    ADD CONSTRAINT ugc_reactions_pkey PRIMARY KEY (comment_id, uid);


--
-- Name: ugc_replies ugc_replies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ugc_replies
    ADD CONSTRAINT ugc_replies_pkey PRIMARY KEY (id);


--
-- Name: user_profiles user_profiles_cloudbase_uid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_cloudbase_uid_key UNIQUE (cloudbase_uid);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (uid);


--
-- Name: app_accounts_email_norm_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX app_accounts_email_norm_uq ON public.app_accounts USING btree (email_norm) WHERE (email_norm IS NOT NULL);


--
-- Name: app_accounts_phone_norm_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX app_accounts_phone_norm_uq ON public.app_accounts USING btree (phone_norm) WHERE (phone_norm IS NOT NULL);


--
-- Name: app_accounts_username_norm_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX app_accounts_username_norm_uq ON public.app_accounts USING btree (username_norm) WHERE (username_norm IS NOT NULL);


--
-- Name: idx_sap_contact_unlock_logs_demand_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sap_contact_unlock_logs_demand_id ON public.sap_contact_unlock_logs USING btree (demand_id);


--
-- Name: idx_sap_contact_unlock_logs_uid_day; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sap_contact_unlock_logs_uid_day ON public.sap_contact_unlock_logs USING btree (uid, day);


--
-- Name: idx_ugc_comments_demand_id_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ugc_comments_demand_id_created_at ON public.ugc_comments USING btree (demand_id, created_at DESC);


--
-- Name: idx_ugc_replies_comment_id_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ugc_replies_comment_id_created_at ON public.ugc_replies USING btree (comment_id, created_at DESC);


--
-- Name: idx_user_profiles_points; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profiles_points ON public.user_profiles USING btree (points DESC);


--
-- Name: sap_demands_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sap_demands_created_at_idx ON public.sap_demands USING btree (created_at DESC);


--
-- Name: sap_demands_provider_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sap_demands_provider_user_idx ON public.sap_demands USING btree (provider_user_id);


--
-- Name: sap_demands_unique_demand_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sap_demands_unique_demand_idx ON public.sap_demands USING btree (unique_demand_id);


--
-- Name: sap_unique_demands_created_ts_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sap_unique_demands_created_ts_idx ON public.sap_unique_demands USING btree (created_time_ts DESC);


--
-- Name: sap_unique_demands_last_updated_ts_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sap_unique_demands_last_updated_ts_idx ON public.sap_unique_demands USING btree (last_updated_time_ts DESC);


--
-- Name: sap_unique_demands_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sap_unique_demands_type_idx ON public.sap_unique_demands USING btree (demand_type);


--
-- Name: user_profiles trg_user_profiles_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_profiles_set_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE PROCEDURE public.set_user_profiles_updated_at();


--
-- Name: sap_contact_unlock_limits sap_contact_unlock_limits_uid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sap_contact_unlock_limits
    ADD CONSTRAINT sap_contact_unlock_limits_uid_fkey FOREIGN KEY (uid) REFERENCES public.users(uid) ON DELETE CASCADE;


--
-- Name: sap_contact_unlock_logs sap_contact_unlock_logs_uid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sap_contact_unlock_logs
    ADD CONSTRAINT sap_contact_unlock_logs_uid_fkey FOREIGN KEY (uid) REFERENCES public.users(uid) ON DELETE CASCADE;


--
-- Name: ugc_comments ugc_comments_uid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ugc_comments
    ADD CONSTRAINT ugc_comments_uid_fkey FOREIGN KEY (uid) REFERENCES public.users(uid) ON DELETE CASCADE;


--
-- Name: ugc_rate_limits ugc_rate_limits_uid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ugc_rate_limits
    ADD CONSTRAINT ugc_rate_limits_uid_fkey FOREIGN KEY (uid) REFERENCES public.users(uid) ON DELETE CASCADE;


--
-- Name: ugc_reactions ugc_reactions_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ugc_reactions
    ADD CONSTRAINT ugc_reactions_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.ugc_comments(id) ON DELETE CASCADE;


--
-- Name: ugc_reactions ugc_reactions_uid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ugc_reactions
    ADD CONSTRAINT ugc_reactions_uid_fkey FOREIGN KEY (uid) REFERENCES public.users(uid) ON DELETE CASCADE;


--
-- Name: ugc_replies ugc_replies_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ugc_replies
    ADD CONSTRAINT ugc_replies_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.ugc_comments(id) ON DELETE CASCADE;


--
-- Name: ugc_replies ugc_replies_uid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ugc_replies
    ADD CONSTRAINT ugc_replies_uid_fkey FOREIGN KEY (uid) REFERENCES public.users(uid) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--
