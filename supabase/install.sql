-- ============================================================================
--
--   WHRD HUB - COMPLETE DATABASE INSTALL
--
--   One script. Run it once in the Supabase SQL editor and the database is
--   ready: every type, table, index, function, trigger, row-level security
--   policy, storage bucket and the content that makes the product look alive.
--
--   Safe to run again. It is fully idempotent, so this same file is also how
--   you bring an existing project up to date - there is nothing else to run
--   and no order to remember.
--
--   Sections
--     1. Extensions
--     2. Types
--     3. Tables, constraints and indexes
--     4. Functions
--     5. Triggers
--     6. Row level security
--     7. Storage buckets and their policies
--     8. Grants
--     9. Seed content
--
--   After running, make yourself an administrator:
--
--     update public.profiles set is_hub_admin = true
--     where id = (select id from auth.users where email = 'you@example.com');
--
-- ============================================================================


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  1. Extensions                                                          ║
-- ╚════════════════════════════════════════════════════════════════════════╝

create extension if not exists pgcrypto with schema public;


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  2. Types                                                               ║
-- ╚════════════════════════════════════════════════════════════════════════╝

do $$ begin create type public.user_type_enum           as enum ('reporter','defender','admin'); exception when duplicate_object then null; end $$;
do $$ begin create type public.reporting_for_enum       as enum ('self','someone_else','community_leader'); exception when duplicate_object then null; end $$;
do $$ begin create type public.perpetrator_type_enum    as enum ('government','security_forces','intimate_partner','family_member','community_member','employer','online_troll','unknown','other'); exception when duplicate_object then null; end $$;
do $$ begin create type public.attack_nature_enum       as enum ('coordinated','bot_assisted','organic','unknown'); exception when duplicate_object then null; end $$;
do $$ begin create type public.urgency_enum             as enum ('immediate','within_week','no_rush'); exception when duplicate_object then null; end $$;
do $$ begin create type public.reporter_type_enum       as enum ('anonymous','authenticated'); exception when duplicate_object then null; end $$;
do $$ begin create type public.channel_enum             as enum ('web','ussd','api','mobile'); exception when duplicate_object then null; end $$;
do $$ begin create type public.report_status_enum       as enum ('submitted','under_review','referred','closed','flagged'); exception when duplicate_object then null; end $$;
do $$ begin create type public.verification_status_enum as enum ('pending','verified','unverified','needs_more_info'); exception when duplicate_object then null; end $$;
do $$ begin create type public.service_category_enum    as enum ('legal','medical','psychosocial','shelter','digital_security','financial','referral','other'); exception when duplicate_object then null; end $$;
do $$ begin create type public.verification_state       as enum ('pending','verified','rejected','needs_more_info'); exception when duplicate_object then null; end $$;
do $$ begin create type public.content_state            as enum ('draft','pending','approved','rejected'); exception when duplicate_object then null; end $$;
do $$ begin create type public.membership_role          as enum ('member','org_admin'); exception when duplicate_object then null; end $$;
do $$ begin create type public.membership_state         as enum ('pending','approved','rejected'); exception when duplicate_object then null; end $$;
-- 'suspended' was added after the first release, so it is appended rather than
-- redefined: an enum value cannot be added inside a transaction that uses it,
-- hence its own statement.
do $$ begin alter type public.membership_state add value if not exists 'suspended'; exception when others then null; end $$;


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  3. Tables, constraints and indexes                                     ║
-- ╚════════════════════════════════════════════════════════════════════════╝
--
-- Each table is created if missing, then every column is added defensively so
-- that a database built by an earlier version of this schema is brought up to
-- date by the same statements.

create table if not exists public.profiles (
  id uuid NOT NULL,
  username text,
  display_name text,
  email text,
  phone text,
  avatar_url text,
  is_anonymous boolean DEFAULT true,
  user_type public.user_type_enum DEFAULT 'reporter'::public.user_type_enum,
  created_at timestamp with time zone DEFAULT now(),
  onboarding_completed boolean DEFAULT false,
  accepted_terms_at timestamp with time zone,
  preferred_language text DEFAULT 'en'::text,
  full_name text,
  county_network_id uuid,
  is_hub_admin boolean DEFAULT false,
  hub_onboarded boolean DEFAULT false,
  hub_terms_accepted_at timestamp with time zone,
  bio text,
  title text,
  account_deleted_at timestamp with time zone,
  account_deleted_reason text,
  claimed_at timestamp with time zone,
  primary key (id),
  unique (username)
);

alter table public.profiles
  add column if not exists id uuid,
  add column if not exists username text,
  add column if not exists display_name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists avatar_url text,
  add column if not exists is_anonymous boolean DEFAULT true,
  add column if not exists user_type public.user_type_enum DEFAULT 'reporter'::public.user_type_enum,
  add column if not exists created_at timestamp with time zone DEFAULT now(),
  add column if not exists onboarding_completed boolean DEFAULT false,
  add column if not exists accepted_terms_at timestamp with time zone,
  add column if not exists preferred_language text DEFAULT 'en'::text,
  add column if not exists full_name text,
  add column if not exists county_network_id uuid,
  add column if not exists is_hub_admin boolean DEFAULT false,
  add column if not exists hub_onboarded boolean DEFAULT false,
  add column if not exists hub_terms_accepted_at timestamp with time zone,
  add column if not exists bio text,
  add column if not exists title text,
  add column if not exists account_deleted_at timestamp with time zone,
  add column if not exists account_deleted_reason text,
  add column if not exists claimed_at timestamp with time zone;

do $$ begin
  alter table public.profiles add constraint profiles_county_network_fk
    foreign key (county_network_id) references public.county_networks(id) ON DELETE SET NULL;
exception when duplicate_object then null; when others then null; end $$;

do $$ begin
  alter table public.profiles add constraint profiles_id_fkey
    foreign key (id) references auth.users(id) ON DELETE CASCADE;
exception when duplicate_object then null; when others then null; end $$;

create index if not exists profiles_deleted_idx on public.profiles (account_deleted_at) WHERE (account_deleted_at IS NOT NULL);


create table if not exists public.county_networks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  is_active boolean DEFAULT false,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  primary key (id),
  unique (name),
  unique (slug)
);

alter table public.county_networks
  add column if not exists id uuid DEFAULT gen_random_uuid(),
  add column if not exists name text,
  add column if not exists slug text,
  add column if not exists is_active boolean DEFAULT false,
  add column if not exists description text,
  add column if not exists created_at timestamp with time zone DEFAULT now();


create table if not exists public.organizations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  slug text,
  county_network_id uuid,
  description text,
  contact_email text,
  contact_phone text,
  website text,
  verification_status public.verification_state DEFAULT 'pending'::public.verification_state,
  verification_notes text,
  created_by uuid,
  verified_by uuid,
  verified_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  primary key (id),
  unique (slug)
);

alter table public.organizations
  add column if not exists id uuid DEFAULT gen_random_uuid(),
  add column if not exists name text,
  add column if not exists slug text,
  add column if not exists county_network_id uuid,
  add column if not exists description text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists website text,
  add column if not exists verification_status public.verification_state DEFAULT 'pending'::public.verification_state,
  add column if not exists verification_notes text,
  add column if not exists created_by uuid,
  add column if not exists verified_by uuid,
  add column if not exists verified_at timestamp with time zone,
  add column if not exists created_at timestamp with time zone DEFAULT now();

do $$ begin
  alter table public.organizations add constraint organizations_county_network_id_fkey
    foreign key (county_network_id) references public.county_networks(id) ON DELETE SET NULL;
exception when duplicate_object then null; when others then null; end $$;

do $$ begin
  alter table public.organizations add constraint organizations_created_by_fkey
    foreign key (created_by) references auth.users(id) ON DELETE SET NULL;
exception when duplicate_object then null; when others then null; end $$;

do $$ begin
  alter table public.organizations add constraint organizations_verified_by_fkey
    foreign key (verified_by) references auth.users(id) ON DELETE SET NULL;
exception when duplicate_object then null; when others then null; end $$;

create index if not exists organizations_county_idx on public.organizations (county_network_id);

create index if not exists organizations_status_idx on public.organizations (verification_status);


create table if not exists public.org_memberships (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role public.membership_role DEFAULT 'member'::public.membership_role,
  created_at timestamp with time zone DEFAULT now(),
  status public.membership_state DEFAULT 'approved'::public.membership_state,
  requested_at timestamp with time zone DEFAULT now(),
  decided_at timestamp with time zone,
  decided_by uuid,
  decision_notes text,
  request_note text,
  primary key (id),
  unique (organization_id, user_id)
);

alter table public.org_memberships
  add column if not exists id uuid DEFAULT gen_random_uuid(),
  add column if not exists organization_id uuid,
  add column if not exists user_id uuid,
  add column if not exists role public.membership_role DEFAULT 'member'::public.membership_role,
  add column if not exists created_at timestamp with time zone DEFAULT now(),
  add column if not exists status public.membership_state DEFAULT 'approved'::public.membership_state,
  add column if not exists requested_at timestamp with time zone DEFAULT now(),
  add column if not exists decided_at timestamp with time zone,
  add column if not exists decided_by uuid,
  add column if not exists decision_notes text,
  add column if not exists request_note text;

do $$ begin
  alter table public.org_memberships add constraint org_memberships_decided_by_fkey
    foreign key (decided_by) references auth.users(id) ON DELETE SET NULL;
exception when duplicate_object then null; when others then null; end $$;

do $$ begin
  alter table public.org_memberships add constraint org_memberships_organization_id_fkey
    foreign key (organization_id) references public.organizations(id) ON DELETE CASCADE;
exception when duplicate_object then null; when others then null; end $$;

do $$ begin
  alter table public.org_memberships add constraint org_memberships_user_id_fkey
    foreign key (user_id) references auth.users(id) ON DELETE CASCADE;
exception when duplicate_object then null; when others then null; end $$;

create index if not exists org_memberships_org_idx on public.org_memberships (organization_id);

create index if not exists org_memberships_status_idx on public.org_memberships (organization_id, status);

create index if not exists org_memberships_user_idx on public.org_memberships (user_id);


create table if not exists public.mentorship_profiles (
  user_id uuid NOT NULL,
  in_leadership_role boolean,
  leadership_detail text,
  has_guide boolean,
  relationship_nature text,
  barriers text,
  wants_mentor boolean,
  desired_qualities text[] DEFAULT '{}'::text[],
  guidance_areas text[] DEFAULT '{}'::text[],
  can_provide boolean,
  support_offered text[] DEFAULT '{}'::text[],
  support_detail text,
  is_mentee boolean GENERATED ALWAYS AS (COALESCE(wants_mentor, false)) STORED,
  is_mentor boolean GENERATED ALWAYS AS (COALESCE(can_provide, false)) STORED,
  updated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  primary key (user_id)
);

alter table public.mentorship_profiles
  add column if not exists user_id uuid,
  add column if not exists in_leadership_role boolean,
  add column if not exists leadership_detail text,
  add column if not exists has_guide boolean,
  add column if not exists relationship_nature text,
  add column if not exists barriers text,
  add column if not exists wants_mentor boolean,
  add column if not exists desired_qualities text[] DEFAULT '{}'::text[],
  add column if not exists guidance_areas text[] DEFAULT '{}'::text[],
  add column if not exists can_provide boolean,
  add column if not exists support_offered text[] DEFAULT '{}'::text[],
  add column if not exists support_detail text,
  add column if not exists is_mentee boolean GENERATED ALWAYS AS (COALESCE(wants_mentor, false)) STORED,
  add column if not exists is_mentor boolean GENERATED ALWAYS AS (COALESCE(can_provide, false)) STORED,
  add column if not exists updated_at timestamp with time zone DEFAULT now(),
  add column if not exists created_at timestamp with time zone DEFAULT now();

do $$ begin
  alter table public.mentorship_profiles add constraint mentorship_profiles_user_id_fkey
    foreign key (user_id) references auth.users(id) ON DELETE CASCADE;
exception when duplicate_object then null; when others then null; end $$;


create table if not exists public.mentorship_matches (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  mentor_id uuid NOT NULL,
  mentee_id uuid NOT NULL,
  score numeric DEFAULT 0,
  overlap text[] DEFAULT '{}'::text[],
  status text DEFAULT 'suggested'::text,
  created_at timestamp with time zone DEFAULT now(),
  primary key (id),
  unique (mentor_id, mentee_id)
);

alter table public.mentorship_matches
  add column if not exists id uuid DEFAULT gen_random_uuid(),
  add column if not exists mentor_id uuid,
  add column if not exists mentee_id uuid,
  add column if not exists score numeric DEFAULT 0,
  add column if not exists overlap text[] DEFAULT '{}'::text[],
  add column if not exists status text DEFAULT 'suggested'::text,
  add column if not exists created_at timestamp with time zone DEFAULT now();

do $$ begin
  alter table public.mentorship_matches add constraint mentorship_matches_mentee_id_fkey
    foreign key (mentee_id) references auth.users(id) ON DELETE CASCADE;
exception when duplicate_object then null; when others then null; end $$;

do $$ begin
  alter table public.mentorship_matches add constraint mentorship_matches_mentor_id_fkey
    foreign key (mentor_id) references auth.users(id) ON DELETE CASCADE;
exception when duplicate_object then null; when others then null; end $$;

create index if not exists matches_mentee_idx on public.mentorship_matches (mentee_id);

create index if not exists matches_mentor_idx on public.mentorship_matches (mentor_id);


create table if not exists public.posts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  author_id uuid,
  organization_id uuid,
  county_network_id uuid,
  body text NOT NULL,
  image_urls text[] DEFAULT '{}'::text[],
  is_hub boolean DEFAULT false,
  pinned boolean DEFAULT false,
  status public.content_state DEFAULT 'pending'::public.content_state,
  review_notes text,
  reviewed_by uuid,
  published_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  media jsonb DEFAULT '[]'::jsonb NOT NULL,
  deleted_at timestamp with time zone,
  deleted_by uuid,
  deleted_reason text,
  guest_name text,
  guest_title text,
  primary key (id)
);

alter table public.posts
  add column if not exists id uuid DEFAULT gen_random_uuid(),
  add column if not exists author_id uuid,
  add column if not exists organization_id uuid,
  add column if not exists county_network_id uuid,
  add column if not exists body text,
  add column if not exists image_urls text[] DEFAULT '{}'::text[],
  add column if not exists is_hub boolean DEFAULT false,
  add column if not exists pinned boolean DEFAULT false,
  add column if not exists status public.content_state DEFAULT 'pending'::public.content_state,
  add column if not exists review_notes text,
  add column if not exists reviewed_by uuid,
  add column if not exists published_at timestamp with time zone,
  add column if not exists created_at timestamp with time zone DEFAULT now(),
  add column if not exists media jsonb DEFAULT '[]'::jsonb,
  add column if not exists deleted_at timestamp with time zone,
  add column if not exists deleted_by uuid,
  add column if not exists deleted_reason text,
  add column if not exists guest_name text,
  add column if not exists guest_title text;

do $$ begin
  alter table public.posts add constraint posts_author_id_fkey
    foreign key (author_id) references auth.users(id) ON DELETE SET NULL;
exception when duplicate_object then null; when others then null; end $$;

do $$ begin
  alter table public.posts add constraint posts_county_network_id_fkey
    foreign key (county_network_id) references public.county_networks(id) ON DELETE SET NULL;
exception when duplicate_object then null; when others then null; end $$;

do $$ begin
  alter table public.posts add constraint posts_deleted_by_fkey
    foreign key (deleted_by) references auth.users(id) ON DELETE SET NULL;
exception when duplicate_object then null; when others then null; end $$;

do $$ begin
  alter table public.posts add constraint posts_organization_id_fkey
    foreign key (organization_id) references public.organizations(id) ON DELETE SET NULL;
exception when duplicate_object then null; when others then null; end $$;

do $$ begin
  alter table public.posts add constraint posts_reviewed_by_fkey
    foreign key (reviewed_by) references auth.users(id) ON DELETE SET NULL;
exception when duplicate_object then null; when others then null; end $$;

create index if not exists posts_deleted_idx on public.posts (deleted_at) WHERE (deleted_at IS NOT NULL);

create index if not exists posts_published_idx on public.posts (published_at DESC);

create index if not exists posts_status_idx on public.posts (status);


create table if not exists public.blogs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  author_id uuid,
  organization_id uuid,
  county_network_id uuid,
  title text NOT NULL,
  slug text,
  excerpt text,
  body text NOT NULL,
  cover_image_url text,
  is_hub boolean DEFAULT false,
  pinned boolean DEFAULT false,
  status public.content_state DEFAULT 'pending'::public.content_state,
  review_notes text,
  reviewed_by uuid,
  published_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  body_format text DEFAULT 'html'::text,
  gallery jsonb DEFAULT '[]'::jsonb NOT NULL,
  deleted_at timestamp with time zone,
  deleted_by uuid,
  deleted_reason text,
  primary key (id),
  unique (slug)
);

alter table public.blogs
  add column if not exists id uuid DEFAULT gen_random_uuid(),
  add column if not exists author_id uuid,
  add column if not exists organization_id uuid,
  add column if not exists county_network_id uuid,
  add column if not exists title text,
  add column if not exists slug text,
  add column if not exists excerpt text,
  add column if not exists body text,
  add column if not exists cover_image_url text,
  add column if not exists is_hub boolean DEFAULT false,
  add column if not exists pinned boolean DEFAULT false,
  add column if not exists status public.content_state DEFAULT 'pending'::public.content_state,
  add column if not exists review_notes text,
  add column if not exists reviewed_by uuid,
  add column if not exists published_at timestamp with time zone,
  add column if not exists created_at timestamp with time zone DEFAULT now(),
  add column if not exists body_format text DEFAULT 'html'::text,
  add column if not exists gallery jsonb DEFAULT '[]'::jsonb,
  add column if not exists deleted_at timestamp with time zone,
  add column if not exists deleted_by uuid,
  add column if not exists deleted_reason text;

do $$ begin
  alter table public.blogs add constraint blogs_author_id_fkey
    foreign key (author_id) references auth.users(id) ON DELETE SET NULL;
exception when duplicate_object then null; when others then null; end $$;

do $$ begin
  alter table public.blogs add constraint blogs_county_network_id_fkey
    foreign key (county_network_id) references public.county_networks(id) ON DELETE SET NULL;
exception when duplicate_object then null; when others then null; end $$;

do $$ begin
  alter table public.blogs add constraint blogs_deleted_by_fkey
    foreign key (deleted_by) references auth.users(id) ON DELETE SET NULL;
exception when duplicate_object then null; when others then null; end $$;

do $$ begin
  alter table public.blogs add constraint blogs_organization_id_fkey
    foreign key (organization_id) references public.organizations(id) ON DELETE SET NULL;
exception when duplicate_object then null; when others then null; end $$;

do $$ begin
  alter table public.blogs add constraint blogs_reviewed_by_fkey
    foreign key (reviewed_by) references auth.users(id) ON DELETE SET NULL;
exception when duplicate_object then null; when others then null; end $$;

create index if not exists blogs_deleted_idx on public.blogs (deleted_at) WHERE (deleted_at IS NOT NULL);

create index if not exists blogs_published_idx on public.blogs (published_at DESC);

create index if not exists blogs_status_idx on public.blogs (status);


create table if not exists public.post_reactions (
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  kind text DEFAULT 'support'::text,
  created_at timestamp with time zone DEFAULT now(),
  primary key (post_id, user_id)
);

alter table public.post_reactions
  add column if not exists post_id uuid,
  add column if not exists user_id uuid,
  add column if not exists kind text DEFAULT 'support'::text,
  add column if not exists created_at timestamp with time zone DEFAULT now();

do $$ begin
  alter table public.post_reactions add constraint post_reactions_post_id_fkey
    foreign key (post_id) references public.posts(id) ON DELETE CASCADE;
exception when duplicate_object then null; when others then null; end $$;

do $$ begin
  alter table public.post_reactions add constraint post_reactions_user_id_fkey
    foreign key (user_id) references auth.users(id) ON DELETE CASCADE;
exception when duplicate_object then null; when others then null; end $$;


create table if not exists public.post_comments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  post_id uuid NOT NULL,
  author_id uuid,
  parent_id uuid,
  body text NOT NULL,
  deleted_at timestamp with time zone,
  deleted_by uuid,
  deleted_reason text,
  created_at timestamp with time zone DEFAULT now(),
  guest_name text,
  guest_title text,
  primary key (id)
);

alter table public.post_comments
  add column if not exists id uuid DEFAULT gen_random_uuid(),
  add column if not exists post_id uuid,
  add column if not exists author_id uuid,
  add column if not exists parent_id uuid,
  add column if not exists body text,
  add column if not exists deleted_at timestamp with time zone,
  add column if not exists deleted_by uuid,
  add column if not exists deleted_reason text,
  add column if not exists created_at timestamp with time zone DEFAULT now(),
  add column if not exists guest_name text,
  add column if not exists guest_title text;

do $$ begin
  alter table public.post_comments add constraint post_comments_author_id_fkey
    foreign key (author_id) references auth.users(id) ON DELETE SET NULL;
exception when duplicate_object then null; when others then null; end $$;

do $$ begin
  alter table public.post_comments add constraint post_comments_deleted_by_fkey
    foreign key (deleted_by) references auth.users(id) ON DELETE SET NULL;
exception when duplicate_object then null; when others then null; end $$;

do $$ begin
  alter table public.post_comments add constraint post_comments_parent_id_fkey
    foreign key (parent_id) references public.post_comments(id) ON DELETE CASCADE;
exception when duplicate_object then null; when others then null; end $$;

do $$ begin
  alter table public.post_comments add constraint post_comments_post_id_fkey
    foreign key (post_id) references public.posts(id) ON DELETE CASCADE;
exception when duplicate_object then null; when others then null; end $$;

create index if not exists post_comments_author_idx on public.post_comments (author_id);

create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);


create table if not exists public.content_audit_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  content_type text NOT NULL,
  content_id uuid NOT NULL,
  action text NOT NULL,
  actor_id uuid,
  detail text,
  created_at timestamp with time zone DEFAULT now(),
  primary key (id)
);

alter table public.content_audit_log
  add column if not exists id uuid DEFAULT gen_random_uuid(),
  add column if not exists content_type text,
  add column if not exists content_id uuid,
  add column if not exists action text,
  add column if not exists actor_id uuid,
  add column if not exists detail text,
  add column if not exists created_at timestamp with time zone DEFAULT now();

do $$ begin
  alter table public.content_audit_log add constraint content_audit_log_actor_id_fkey
    foreign key (actor_id) references auth.users(id) ON DELETE SET NULL;
exception when duplicate_object then null; when others then null; end $$;

create index if not exists audit_content_idx on public.content_audit_log (content_type, content_id);


create table if not exists public.notifications (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  report_id uuid,
  type text DEFAULT 'service_assigned'::text NOT NULL,
  service_name text,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  title text,
  body text,
  link text,
  content_type text,
  content_id uuid,
  read boolean DEFAULT false,
  primary key (id)
);

alter table public.notifications
  add column if not exists id uuid DEFAULT gen_random_uuid(),
  add column if not exists user_id uuid,
  add column if not exists report_id uuid,
  add column if not exists type text DEFAULT 'service_assigned'::text,
  add column if not exists service_name text,
  add column if not exists is_read boolean DEFAULT false,
  add column if not exists created_at timestamp with time zone DEFAULT now(),
  add column if not exists title text,
  add column if not exists body text,
  add column if not exists link text,
  add column if not exists content_type text,
  add column if not exists content_id uuid,
  add column if not exists read boolean DEFAULT false;

do $$ begin
  alter table public.notifications add constraint notifications_report_id_fkey
    foreign key (report_id) references public.reports(id) ON DELETE CASCADE;
exception when duplicate_object then null; when others then null; end $$;

do $$ begin
  alter table public.notifications add constraint notifications_user_id_fkey
    foreign key (user_id) references auth.users(id) ON DELETE CASCADE;
exception when duplicate_object then null; when others then null; end $$;

create index if not exists notifications_user_id_idx on public.notifications (user_id, created_at DESC);

create index if not exists notifications_user_idx on public.notifications (user_id, read);

create index if not exists notifications_user_read_idx on public.notifications (user_id, read, created_at DESC);


create table if not exists public.resources (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  slug text,
  description text,
  kind text DEFAULT 'Report'::text NOT NULL,
  is_newsletter boolean DEFAULT false NOT NULL,
  cover_image_url text,
  file_url text NOT NULL,
  edition_label text,
  published_on date,
  featured boolean DEFAULT false NOT NULL,
  published boolean DEFAULT true NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  source_url text,
  deleted_at timestamp with time zone,
  deleted_by uuid,
  deleted_reason text,
  primary key (id),
  unique (slug)
);

alter table public.resources
  add column if not exists id uuid DEFAULT gen_random_uuid(),
  add column if not exists title text,
  add column if not exists slug text,
  add column if not exists description text,
  add column if not exists kind text DEFAULT 'Report'::text,
  add column if not exists is_newsletter boolean DEFAULT false,
  add column if not exists cover_image_url text,
  add column if not exists file_url text,
  add column if not exists edition_label text,
  add column if not exists published_on date,
  add column if not exists featured boolean DEFAULT false,
  add column if not exists published boolean DEFAULT true,
  add column if not exists sort_order integer DEFAULT 0,
  add column if not exists created_by uuid,
  add column if not exists created_at timestamp with time zone DEFAULT now(),
  add column if not exists updated_at timestamp with time zone DEFAULT now(),
  add column if not exists source_url text,
  add column if not exists deleted_at timestamp with time zone,
  add column if not exists deleted_by uuid,
  add column if not exists deleted_reason text;

do $$ begin
  alter table public.resources add constraint resources_created_by_fkey
    foreign key (created_by) references auth.users(id) ON DELETE SET NULL;
exception when duplicate_object then null; when others then null; end $$;

do $$ begin
  alter table public.resources add constraint resources_deleted_by_fkey
    foreign key (deleted_by) references auth.users(id) ON DELETE SET NULL;
exception when duplicate_object then null; when others then null; end $$;

create index if not exists resources_deleted_idx on public.resources (deleted_at) WHERE (deleted_at IS NOT NULL);

create index if not exists resources_newsletter_idx on public.resources (is_newsletter, published);

create index if not exists resources_order_idx on public.resources (sort_order, published_on DESC);


create table if not exists public.reports (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  incident_types text[] DEFAULT '{}'::text[] NOT NULL,
  description text,
  what_description text,
  tfgbv_platform text,
  tfgbv_link text,
  tfgbv_screenshot_urls text[],
  tfgbv_content_text text,
  reporting_for public.reporting_for_enum DEFAULT 'self'::public.reporting_for_enum,
  perpetrator_type public.perpetrator_type_enum,
  perpetrator_detail text,
  county text,
  location_description text,
  latitude double precision,
  longitude double precision,
  occurred_at date,
  occurred_time text,
  is_ongoing boolean DEFAULT false,
  how_description text,
  evidence_types text[],
  derogatory_words text[],
  attack_nature public.attack_nature_enum,
  activism_context text,
  support_needed text[] DEFAULT '{}'::text[],
  urgency public.urgency_enum DEFAULT 'within_week'::public.urgency_enum,
  consent_to_followup boolean DEFAULT false,
  contact_method text,
  contact_value text,
  reporter_type public.reporter_type_enum DEFAULT 'anonymous'::public.reporter_type_enum,
  channel public.channel_enum DEFAULT 'web'::public.channel_enum,
  status public.report_status_enum DEFAULT 'submitted'::public.report_status_enum,
  assigned_to uuid,
  defender_notes text,
  verification_status public.verification_status_enum DEFAULT 'pending'::public.verification_status_enum,
  verification_notes text,
  verified_by uuid,
  verified_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  deleted_by uuid,
  deleted_reason text,
  primary key (id)
);

alter table public.reports
  add column if not exists id uuid DEFAULT gen_random_uuid(),
  add column if not exists user_id uuid,
  add column if not exists incident_types text[] DEFAULT '{}'::text[],
  add column if not exists description text,
  add column if not exists what_description text,
  add column if not exists tfgbv_platform text,
  add column if not exists tfgbv_link text,
  add column if not exists tfgbv_screenshot_urls text[],
  add column if not exists tfgbv_content_text text,
  add column if not exists reporting_for public.reporting_for_enum DEFAULT 'self'::public.reporting_for_enum,
  add column if not exists perpetrator_type public.perpetrator_type_enum,
  add column if not exists perpetrator_detail text,
  add column if not exists county text,
  add column if not exists location_description text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists occurred_at date,
  add column if not exists occurred_time text,
  add column if not exists is_ongoing boolean DEFAULT false,
  add column if not exists how_description text,
  add column if not exists evidence_types text[],
  add column if not exists derogatory_words text[],
  add column if not exists attack_nature public.attack_nature_enum,
  add column if not exists activism_context text,
  add column if not exists support_needed text[] DEFAULT '{}'::text[],
  add column if not exists urgency public.urgency_enum DEFAULT 'within_week'::public.urgency_enum,
  add column if not exists consent_to_followup boolean DEFAULT false,
  add column if not exists contact_method text,
  add column if not exists contact_value text,
  add column if not exists reporter_type public.reporter_type_enum DEFAULT 'anonymous'::public.reporter_type_enum,
  add column if not exists channel public.channel_enum DEFAULT 'web'::public.channel_enum,
  add column if not exists status public.report_status_enum DEFAULT 'submitted'::public.report_status_enum,
  add column if not exists assigned_to uuid,
  add column if not exists defender_notes text,
  add column if not exists verification_status public.verification_status_enum DEFAULT 'pending'::public.verification_status_enum,
  add column if not exists verification_notes text,
  add column if not exists verified_by uuid,
  add column if not exists verified_at timestamp with time zone,
  add column if not exists created_at timestamp with time zone DEFAULT now(),
  add column if not exists updated_at timestamp with time zone DEFAULT now(),
  add column if not exists deleted_at timestamp with time zone,
  add column if not exists deleted_by uuid,
  add column if not exists deleted_reason text;

do $$ begin
  alter table public.reports add constraint reports_assigned_to_fkey
    foreign key (assigned_to) references auth.users(id) ON DELETE SET NULL;
exception when duplicate_object then null; when others then null; end $$;

do $$ begin
  alter table public.reports add constraint reports_deleted_by_fkey
    foreign key (deleted_by) references auth.users(id) ON DELETE SET NULL;
exception when duplicate_object then null; when others then null; end $$;

do $$ begin
  alter table public.reports add constraint reports_user_id_fkey
    foreign key (user_id) references auth.users(id) ON DELETE SET NULL;
exception when duplicate_object then null; when others then null; end $$;

do $$ begin
  alter table public.reports add constraint reports_verified_by_fkey
    foreign key (verified_by) references auth.users(id) ON DELETE SET NULL;
exception when duplicate_object then null; when others then null; end $$;

create index if not exists reports_deleted_idx on public.reports (deleted_at) WHERE (deleted_at IS NOT NULL);


create table if not exists public.services (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  description text,
  category public.service_category_enum NOT NULL,
  organization text,
  contact_phone text,
  contact_email text,
  contact_url text,
  county text,
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  primary key (id)
);

alter table public.services
  add column if not exists id uuid DEFAULT gen_random_uuid(),
  add column if not exists name text,
  add column if not exists description text,
  add column if not exists category public.service_category_enum,
  add column if not exists organization text,
  add column if not exists contact_phone text,
  add column if not exists contact_email text,
  add column if not exists contact_url text,
  add column if not exists county text,
  add column if not exists is_active boolean DEFAULT true,
  add column if not exists created_by uuid,
  add column if not exists created_at timestamp with time zone DEFAULT now();

do $$ begin
  alter table public.services add constraint services_created_by_fkey
    foreign key (created_by) references auth.users(id) ON DELETE SET NULL;
exception when duplicate_object then null; when others then null; end $$;


create table if not exists public.report_services (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  report_id uuid NOT NULL,
  service_id uuid NOT NULL,
  assigned_by uuid,
  assigned_at timestamp with time zone DEFAULT now(),
  note text,
  primary key (id),
  unique (report_id, service_id)
);

alter table public.report_services
  add column if not exists id uuid DEFAULT gen_random_uuid(),
  add column if not exists report_id uuid,
  add column if not exists service_id uuid,
  add column if not exists assigned_by uuid,
  add column if not exists assigned_at timestamp with time zone DEFAULT now(),
  add column if not exists note text;

do $$ begin
  alter table public.report_services add constraint report_services_assigned_by_fkey
    foreign key (assigned_by) references auth.users(id) ON DELETE SET NULL;
exception when duplicate_object then null; when others then null; end $$;

do $$ begin
  alter table public.report_services add constraint report_services_report_id_fkey
    foreign key (report_id) references public.reports(id) ON DELETE CASCADE;
exception when duplicate_object then null; when others then null; end $$;

do $$ begin
  alter table public.report_services add constraint report_services_service_id_fkey
    foreign key (service_id) references public.services(id) ON DELETE CASCADE;
exception when duplicate_object then null; when others then null; end $$;


create table if not exists public.report_audit_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  report_id uuid,
  viewed_by uuid,
  action text NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  primary key (id)
);

alter table public.report_audit_log
  add column if not exists id uuid DEFAULT gen_random_uuid(),
  add column if not exists report_id uuid,
  add column if not exists viewed_by uuid,
  add column if not exists action text,
  add column if not exists notes text,
  add column if not exists created_at timestamp with time zone DEFAULT now();

do $$ begin
  alter table public.report_audit_log add constraint report_audit_log_report_id_fkey
    foreign key (report_id) references public.reports(id) ON DELETE CASCADE;
exception when duplicate_object then null; when others then null; end $$;

do $$ begin
  alter table public.report_audit_log add constraint report_audit_log_viewed_by_fkey
    foreign key (viewed_by) references auth.users(id) ON DELETE SET NULL;
exception when duplicate_object then null; when others then null; end $$;


create table if not exists public.ussd_sessions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  session_id text NOT NULL,
  phone_number text,
  text_input text,
  current_step text DEFAULT 'start'::text,
  session_data jsonb DEFAULT '{}'::jsonb,
  report_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  primary key (id),
  unique (session_id)
);

alter table public.ussd_sessions
  add column if not exists id uuid DEFAULT gen_random_uuid(),
  add column if not exists session_id text,
  add column if not exists phone_number text,
  add column if not exists text_input text,
  add column if not exists current_step text DEFAULT 'start'::text,
  add column if not exists session_data jsonb DEFAULT '{}'::jsonb,
  add column if not exists report_id uuid,
  add column if not exists created_at timestamp with time zone DEFAULT now(),
  add column if not exists updated_at timestamp with time zone DEFAULT now();

do $$ begin
  alter table public.ussd_sessions add constraint ussd_sessions_report_id_fkey
    foreign key (report_id) references public.reports(id) ON DELETE SET NULL;
exception when duplicate_object then null; when others then null; end $$;


create table if not exists public.listening_keywords (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  word text NOT NULL,
  severity text DEFAULT 'medium'::text NOT NULL,
  active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  primary key (id)
);

alter table public.listening_keywords
  add column if not exists id uuid DEFAULT gen_random_uuid(),
  add column if not exists word text,
  add column if not exists severity text DEFAULT 'medium'::text,
  add column if not exists active boolean DEFAULT true,
  add column if not exists created_at timestamp with time zone DEFAULT now();

create unique index if not exists listening_keywords_word_uidx on public.listening_keywords (lower(word));


create table if not exists public.listening_results (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  source text DEFAULT 'facebook'::text NOT NULL,
  source_id text,
  permalink text,
  author text,
  content text NOT NULL,
  matched_keywords text[] DEFAULT '{}'::text[] NOT NULL,
  severity text DEFAULT 'medium'::text NOT NULL,
  status text DEFAULT 'new'::text NOT NULL,
  captured_at timestamp with time zone DEFAULT now() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  primary key (id)
);

alter table public.listening_results
  add column if not exists id uuid DEFAULT gen_random_uuid(),
  add column if not exists source text DEFAULT 'facebook'::text,
  add column if not exists source_id text,
  add column if not exists permalink text,
  add column if not exists author text,
  add column if not exists content text,
  add column if not exists matched_keywords text[] DEFAULT '{}'::text[],
  add column if not exists severity text DEFAULT 'medium'::text,
  add column if not exists status text DEFAULT 'new'::text,
  add column if not exists captured_at timestamp with time zone DEFAULT now(),
  add column if not exists created_at timestamp with time zone DEFAULT now();

create index if not exists listening_results_captured_idx on public.listening_results (captured_at DESC);

create unique index if not exists listening_results_source_uidx on public.listening_results (source, source_id) WHERE (source_id IS NOT NULL);

create index if not exists listening_results_status_idx on public.listening_results (status);


-- ── Columns added after the tables above were first generated ───────────────
-- Kept in one place so the generated section stays a faithful dump.

-- A post belongs to a network. The organisation's own mark is what the feed
-- shows, so it needs somewhere to live.
alter table public.organizations
  add column if not exists logo_url text;

-- Suspension is a property of a membership: it is local to one network.
alter table public.org_memberships
  add column if not exists suspended_at      timestamptz,
  add column if not exists suspended_by      uuid references auth.users(id) on delete set null,
  add column if not exists suspension_reason text;

create index if not exists org_memberships_suspended_idx
  on public.org_memberships (organization_id, suspended_at)
  where suspended_at is not null;

-- A ban is a property of the account.
alter table public.profiles
  add column if not exists banned_at  timestamptz,
  add column if not exists banned_by  uuid references auth.users(id) on delete set null,
  add column if not exists ban_reason text;

create index if not exists profiles_banned_idx
  on public.profiles (banned_at) where banned_at is not null;

-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  4. Functions                                                           ║
-- ╚════════════════════════════════════════════════════════════════════════╝

-- ── Roles ────────────────────────────────────────────────────────────────
--
-- Two role systems met when the reporting platform and the Hub became one app:
-- profiles.user_type ('reporter' | 'defender' | 'admin') and the Hub's
-- profiles.is_hub_admin. These functions are the single answer to "who may do
-- what", and every policy calls them rather than reading the columns directly.
-- SECURITY DEFINER so a policy on profiles can call them without recursing.

create or replace function public.is_hub_admin(uid uuid default auth.uid())
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce((select coalesce(is_hub_admin, false) or user_type::text = 'admin'
                     from public.profiles where id = uid), false);
$$;

-- Full reporting administrator: verify, assign services, manage the directory.
create or replace function public.can_administer_reports(uid uuid default auth.uid())
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce((select coalesce(is_hub_admin, false) or user_type::text = 'admin'
                     from public.profiles where id = uid), false);
$$;

-- Anyone who may open a case: administrators plus reporting defenders.
create or replace function public.can_triage_reports(uid uuid default auth.uid())
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce((select coalesce(is_hub_admin, false) or user_type::text in ('admin','defender')
                     from public.profiles where id = uid), false);
$$;

create or replace function public.get_my_user_type()
returns text language sql security definer set search_path = public stable as $$
  select user_type::text from public.profiles where id = auth.uid();
$$;

-- An organisation can have as many administrators as it likes; these answer
-- "is this person one of them" without recursing on org_memberships.
create or replace function public.is_org_admin(org uuid, uid uuid default auth.uid())
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.org_memberships m
                  where m.organization_id = org and m.user_id = uid
                    and m.role = 'org_admin' and m.status = 'approved');
$$;

-- Suspended memberships are excluded everywhere: a suspended member is not a
-- member for any purpose except being able to see that they are suspended.
create or replace function public.my_org_ids()
returns setof uuid language sql security definer set search_path = public stable as $$
  select organization_id from public.org_memberships
   where user_id = auth.uid() and status = 'approved';
$$;

create or replace function public.my_admin_org_ids()
returns setof uuid language sql security definer set search_path = public stable as $$
  select organization_id from public.org_memberships
   where user_id = auth.uid() and role = 'org_admin' and status = 'approved';
$$;

/**
 * Is this person a member who may post to the feed?
 *
 * Posting is for the movement, not for passers-by: an approved membership of a
 * county network's organisation, or Hub staff. Anyone can read the feed and
 * support a post; writing to it is a member's act.
 *
 * A banned account is refused outright, and a suspended membership does not
 * count — which is the whole point of a network admin being able to suspend.
 */
create or replace function public.can_post_to_feed(uid uuid default auth.uid())
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce((
    select p.is_hub_admin
        or p.user_type::text in ('admin','defender')
        or exists (select 1 from public.org_memberships m
                    where m.user_id = p.id and m.status = 'approved')
      from public.profiles p
     where p.id = uid
       and p.account_deleted_at is null
       and p.banned_at is null
  ), false);
$$;

/** A banned account can still read, but may not act. */
create or replace function public.is_banned(uid uuid default auth.uid())
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce((select banned_at is not null from public.profiles where id = uid), false);
$$;

grant execute on function public.is_banned(uuid) to anon, authenticated;

grant execute on function public.is_hub_admin(uuid)           to anon, authenticated;
grant execute on function public.can_administer_reports(uuid) to anon, authenticated;
grant execute on function public.can_triage_reports(uuid)     to anon, authenticated;
grant execute on function public.get_my_user_type()           to anon, authenticated;
grant execute on function public.is_org_admin(uuid, uuid)     to anon, authenticated;
grant execute on function public.my_org_ids()                 to anon, authenticated;
grant execute on function public.my_admin_org_ids()           to anon, authenticated;
grant execute on function public.can_post_to_feed(uuid)       to anon, authenticated;


-- ── Small helpers ────────────────────────────────────────────────────────

create or replace function public.slugify(txt text)
returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(coalesce(txt,'')), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

-- New auth users get a profile row immediately, so every later write can
-- assume one exists.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, username, is_anonymous, user_type)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'username', split_part(coalesce(new.email,''), '@', 1)),
    coalesce((new.raw_user_meta_data->>'is_anonymous')::boolean, false),
    coalesce((new.raw_user_meta_data->>'user_type')::public.user_type_enum, 'reporter')
  )
  on conflict (id) do nothing;
  return new;
end $$;

create or replace function public.blogs_before_write()
returns trigger language plpgsql as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := public.slugify(new.title) || '-' || substr(new.id::text, 1, 6);
  end if;
  if new.status = 'approved' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end $$;

create or replace function public.posts_before_write()
returns trigger language plpgsql as $$
begin
  if new.status = 'approved' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end $$;

create or replace function public.resources_before_write()
returns trigger language plpgsql as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := public.slugify(new.title) || '-' || substr(new.id::text, 1, 6);
  end if;
  new.updated_at := now();
  return new;
end $$;


-- ── Referral matching ────────────────────────────────────────────────────
/**
 * Match a report to support services.
 *
 * This runs the moment a report is filed, not when someone gets round to
 * verifying it. A defender describing an immediate threat should not wait on
 * fact-checking before the response team can see which shelter and which legal
 * desk are the right ones, and before she can see them herself.
 *
 * For each kind of support the reporter asked for:
 *
 *   * every service in her own county, and every service that operates
 *     nationally. Both are useful - the local desk is reachable, the national
 *     body has reach - so neither is withheld.
 *   * services belonging to OTHER counties are excluded, unless that category
 *     has no local and no national service at all, in which case the nearest
 *     available one is assigned rather than answering with nothing.
 *
 * Each referral carries a note saying which of the three it was, so the
 * response team can see at a glance why a service was suggested. Re-running is
 * harmless: the unique key on (report_id, service_id) absorbs it.
 */
create or replace function public.match_report_services(target uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  r public.reports%rowtype;
  n integer := 0;
begin
  select * into r from public.reports where id = target;
  if not found or r.deleted_at is not null then return 0; end if;
  if coalesce(array_length(r.support_needed, 1), 0) = 0 then return 0; end if;

  with matched as (
    select s.id,
           case
             when r.county is not null and s.county = r.county
               then 'Matched: ' || s.category::text || ' support in ' || r.county
             when s.county is null
               then 'Matched: national ' || s.category::text || ' support'
             else 'Matched: nearest available ' || s.category::text || ' support'
           end as note
    from public.services s
    where s.is_active
      and s.category::text = any(r.support_needed)
      and (
        (r.county is not null and s.county = r.county)
        or s.county is null
        or not exists (
          select 1 from public.services s2
           where s2.is_active and s2.category = s.category
             and (s2.county = r.county or s2.county is null)
        )
      )
  )
  insert into public.report_services (report_id, service_id, assigned_by, note)
  select r.id, m.id, r.verified_by, m.note from matched m
  on conflict (report_id, service_id) do nothing;

  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.handle_report_matching()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- On filing, and again if what was asked for or where it happened changes.
  if TG_OP = 'INSERT'
     or NEW.support_needed is distinct from OLD.support_needed
     or NEW.county is distinct from OLD.county
     or (NEW.verification_status = 'verified'
         and OLD.verification_status is distinct from 'verified') then
    perform public.match_report_services(NEW.id);
  end if;
  return NEW;
end $$;

-- The old name, kept so an existing project's trigger keeps resolving.
create or replace function public.handle_report_verified()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.match_report_services(NEW.id);
  return NEW;
end $$;

/**
 * Tell the reporter when support has been attached to their case. Fires on
 * assignment regardless of verification state, because matching now happens at
 * filing time and the referral is only useful if she knows about it.
 */
create or replace function public.handle_service_assigned_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
  v_service_name text;
begin
  select user_id into v_user_id from public.reports where id = NEW.report_id;
  if v_user_id is null then return NEW; end if;

  select name into v_service_name from public.services where id = NEW.service_id;

  insert into public.notifications (user_id, report_id, type, service_name)
  values (v_user_id, NEW.report_id, 'service_assigned', v_service_name);
  return NEW;
end $$;


-- ── Notifications ────────────────────────────────────────────────────────
--
-- Both halves of the product write here and each expected its own column
-- names: the Hub writes `read`, `title`, `body`, `link`; the reporting triggers
-- write `is_read`, `report_id`, `service_name`. Rather than force one side to
-- change, the table carries both and these keep them consistent.

create or replace function public.sync_notification_read_flags()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'INSERT' then
    new.read    := coalesce(new.read, new.is_read, false);
    new.is_read := coalesce(new.is_read, new.read, false);
    if new.read <> new.is_read then new.is_read := new.read; end if;
  else
    if new.read is distinct from old.read then
      new.is_read := new.read;
    elsif new.is_read is distinct from old.is_read then
      new.read := new.is_read;
    end if;
  end if;
  return new;
end $$;

-- Give report notifications a title and a link so they render in the same
-- notifications list as community ones.
create or replace function public.fill_report_notification_copy()
returns trigger language plpgsql as $$
begin
  if new.report_id is not null then
    if new.title is null then
      new.title := case when new.type = 'service_assigned'
                        then 'Support assigned to your report'
                        else 'Update on your report' end;
    end if;
    if new.body is null and new.service_name is not null then
      new.body := new.service_name || ' has been assigned to support you.';
    end if;
    if new.link is null then
      new.link := '/dashboard/reports/' || new.report_id::text;
    end if;
    if new.content_type is null then new.content_type := 'report'; end if;
  end if;
  return new;
end $$;


-- ── Deleting things ──────────────────────────────────────────────────────
/**
 * Deleting your own content.
 *
 * From where the person stands this is simply "delete": the post, story,
 * comment or report leaves the feed and leaves their account. Underneath it is
 * a soft delete, so the Hub keeps the record for safeguarding.
 *
 * It has to be a SECURITY DEFINER function rather than a plain UPDATE, because
 * PostgreSQL applies SELECT policies to the updated row: once the row is
 * invisible to its author, an author-run UPDATE that made it so would be
 * rejected. Running as the definer sidesteps that; the ownership check below is
 * what actually authorises it.
 */
create or replace function public.delete_own_content(kind text, target uuid, reason text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  caller uuid := auth.uid();
  owner  uuid;
  admin  boolean := public.is_hub_admin(caller);
begin
  if caller is null then raise exception 'Not signed in'; end if;

  case kind
    when 'post'    then select author_id into owner from public.posts         where id = target;
    when 'blog'    then select author_id into owner from public.blogs         where id = target;
    when 'comment' then select author_id into owner from public.post_comments where id = target;
    when 'report'  then select user_id   into owner from public.reports       where id = target;
    else raise exception 'Unknown content kind: %', kind;
  end case;

  if owner is null and not admin then return false; end if;
  if owner is distinct from caller and not admin then
    raise exception 'You can only delete your own content';
  end if;

  case kind
    when 'post' then
      update public.posts set deleted_at = now(), deleted_by = caller,
             deleted_reason = reason where id = target and deleted_at is null;
    when 'blog' then
      update public.blogs set deleted_at = now(), deleted_by = caller,
             deleted_reason = reason where id = target and deleted_at is null;
    when 'comment' then
      update public.post_comments set deleted_at = now(), deleted_by = caller,
             deleted_reason = reason where id = target and deleted_at is null;
    when 'report' then
      update public.reports set deleted_at = now(), deleted_by = caller,
             deleted_reason = reason where id = target and deleted_at is null;
  end case;

  return true;
end $$;

/** Bringing something back. The Hub's call: the author can no longer see it. */
create or replace function public.restore_content(kind text, target uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_hub_admin(auth.uid()) then
    raise exception 'Only the Hub can restore content';
  end if;

  case kind
    when 'post'    then update public.posts         set deleted_at = null, deleted_by = null, deleted_reason = null where id = target;
    when 'blog'    then update public.blogs         set deleted_at = null, deleted_by = null, deleted_reason = null where id = target;
    when 'comment' then update public.post_comments set deleted_at = null, deleted_by = null, deleted_reason = null where id = target;
    when 'report'  then update public.reports       set deleted_at = null, deleted_by = null, deleted_reason = null where id = target;
    else raise exception 'Unknown content kind: %', kind;
  end case;
  return true;
end $$;

/**
 * Delete an account.
 *
 * Everything the person wrote is soft-deleted so it leaves every surface at
 * once, and their memberships are closed. The auth user and the content are
 * kept: an account closing must not erase the Hub's ability to answer a
 * safeguarding question later. Reports are included, because from the person's
 * side deleting the account should take their reports with it.
 */
create or replace function public.delete_account(target uuid, reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare caller uuid := auth.uid();
begin
  if caller is null then raise exception 'Not signed in'; end if;
  if caller <> target and not public.is_hub_admin(caller) then
    raise exception 'You can only delete your own account';
  end if;

  update public.profiles
     set account_deleted_at = coalesce(account_deleted_at, now()),
         account_deleted_reason = coalesce(reason, account_deleted_reason)
   where id = target;

  update public.posts         set deleted_at = now(), deleted_by = caller,
         deleted_reason = coalesce(deleted_reason, 'Account deleted')
   where author_id = target and deleted_at is null;
  update public.blogs         set deleted_at = now(), deleted_by = caller,
         deleted_reason = coalesce(deleted_reason, 'Account deleted')
   where author_id = target and deleted_at is null;
  update public.post_comments set deleted_at = now(), deleted_by = caller,
         deleted_reason = coalesce(deleted_reason, 'Account deleted')
   where author_id = target and deleted_at is null;
  update public.reports       set deleted_at = now(), deleted_by = caller,
         deleted_reason = coalesce(deleted_reason, 'Account deleted')
   where user_id = target and deleted_at is null;

  update public.org_memberships
     set status = 'rejected', decided_at = now(), decided_by = caller,
         decision_notes = 'Account deleted'
   where user_id = target and status <> 'rejected';
end $$;

create or replace function public.restore_account(target uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_hub_admin(auth.uid()) then
    raise exception 'Only the Hub can restore an account';
  end if;
  update public.profiles
     set account_deleted_at = null, account_deleted_reason = null where id = target;
end $$;

grant execute on function public.delete_own_content(text, uuid, text) to authenticated;
grant execute on function public.restore_content(text, uuid)          to authenticated;
grant execute on function public.delete_account(uuid, text)           to authenticated;
grant execute on function public.restore_account(uuid)                to authenticated;
grant execute on function public.match_report_services(uuid)          to authenticated;

-- Stamp deleted_by when something is soft-deleted directly rather than through
-- the functions above.
create or replace function public.stamp_soft_delete()
returns trigger language plpgsql as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    new.deleted_by := coalesce(new.deleted_by, auth.uid());
  end if;
  if new.deleted_at is null then
    new.deleted_by := null;
    new.deleted_reason := null;
  end if;
  return new;
end $$;

create or replace function public.membership_before_write()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'UPDATE' and new.status is distinct from old.status
     and new.status in ('approved','rejected') then
    new.decided_at := coalesce(new.decided_at, now());
    new.decided_by := coalesce(new.decided_by, auth.uid());
  end if;
  return new;
end $$;


-- ── Dashboard counters ───────────────────────────────────────────────────

create or replace function public.hub_overview()
returns json language sql security definer set search_path = public as $$
  select json_build_object(
    'members',          (select count(distinct user_id) from public.org_memberships where status = 'approved'),
    'members_pending',  (select count(*) from public.org_memberships where status = 'pending'),
    'members_suspended',(select count(*) from public.org_memberships where status = 'suspended'),
    'accounts_banned',  (select count(*) from public.profiles where banned_at is not null),
    'onboarded',        (select count(*) from public.profiles where hub_onboarded and account_deleted_at is null),
    'accounts_deleted', (select count(*) from public.profiles where account_deleted_at is not null),
    'organizations',    (select count(*) from public.organizations),
    'orgs_pending',     (select count(*) from public.organizations where verification_status = 'pending'),
    'posts_pending',    (select count(*) from public.posts where status = 'pending' and deleted_at is null),
    'blogs_pending',    (select count(*) from public.blogs where status = 'pending' and deleted_at is null),
    'posts_live',       (select count(*) from public.posts where status = 'approved' and deleted_at is null),
    'blogs_live',       (select count(*) from public.blogs where status = 'approved' and deleted_at is null),
    'posts_declined',   (select count(*) from public.posts where status = 'rejected' and deleted_at is null),
    'blogs_declined',   (select count(*) from public.blogs where status = 'rejected' and deleted_at is null),
    'posts_deleted',    (select count(*) from public.posts where deleted_at is not null),
    'blogs_deleted',    (select count(*) from public.blogs where deleted_at is not null),
    'comments_deleted', (select count(*) from public.post_comments where deleted_at is not null),
    'counties_active',  (select count(*) from public.county_networks where is_active),
    'reports_total',    (select count(*) from public.reports where deleted_at is null),
    'reports_pending',  (select count(*) from public.reports where verification_status = 'pending' and deleted_at is null),
    'reports_urgent',   (select count(*) from public.reports
                          where urgency = 'immediate' and status in ('submitted','under_review') and deleted_at is null),
    'reports_verified', (select count(*) from public.reports where verification_status = 'verified' and deleted_at is null),
    'reports_deleted',  (select count(*) from public.reports where deleted_at is not null)
  );
$$;

create or replace function public.hub_submissions_timeseries(days int default 30)
returns table(day date, posts bigint, blogs bigint)
language sql security definer set search_path = public as $$
  with span as (
    select generate_series((current_date - (days - 1)), current_date, interval '1 day')::date as day
  )
  select s.day,
         (select count(*) from public.posts p where p.created_at::date = s.day and p.deleted_at is null),
         (select count(*) from public.blogs b where b.created_at::date = s.day and b.deleted_at is null)
  from span s order by s.day;
$$;

create or replace function public.hub_member_growth(days int default 30)
returns table(day date, joins bigint)
language sql security definer set search_path = public as $$
  with span as (
    select generate_series((current_date - (days - 1)), current_date, interval '1 day')::date as day
  )
  select s.day, (select count(*) from public.org_memberships m
                  where m.created_at::date = s.day and m.status = 'approved')
  from span s order by s.day;
$$;

create or replace function public.get_report_stats()
returns json language sql security definer set search_path = public as $$
  select json_build_object(
    'total',      (select count(*) from public.reports where deleted_at is null),
    'pending',    (select count(*) from public.reports where verification_status = 'pending' and deleted_at is null),
    'verified',   (select count(*) from public.reports where verification_status = 'verified' and deleted_at is null),
    'immediate',  (select count(*) from public.reports where urgency = 'immediate' and deleted_at is null),
    'anonymous',  (select count(*) from public.reports where reporter_type = 'anonymous' and deleted_at is null)
  );
$$;

create or replace function public.get_user_report_count(uid uuid default auth.uid())
returns bigint language sql security definer set search_path = public stable as $$
  select count(*) from public.reports where user_id = uid and deleted_at is null;
$$;

-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  4b. Suspension and banning                                             ║
-- ╚════════════════════════════════════════════════════════════════════════╝
--
-- Two levels, deliberately separate, because they belong to different people.
--
--   Suspend  An organisation's admin decides that one of their own members
--            should stop posting for now. It is local to that network, it is
--            reversible by the same admin, and it tells the Hub so somebody
--            senior knows it happened.
--
--   Ban      The Hub decides the person should not use the platform at all.
--            Only a Hub admin can do it, it is account-wide, and the person is
--            signed out and refused at every authenticated surface.
--
-- A network admin can suspend but never ban; escalation is the Hub's call.

/**
 * Suspend a member of an organisation you administer.
 *
 * SECURITY DEFINER because it also writes notifications to the Hub, which the
 * caller has no rights over.
 */
create or replace function public.suspend_member(membership uuid, reason text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  caller uuid := auth.uid();
  m      public.org_memberships%rowtype;
  org_name text;
  who      text;
  admin_id uuid;
begin
  if caller is null then raise exception 'Not signed in'; end if;

  select * into m from public.org_memberships where id = membership;
  if not found then raise exception 'That membership no longer exists'; end if;

  if not (public.is_hub_admin(caller) or public.is_org_admin(m.organization_id, caller)) then
    raise exception 'Only an admin of this network can suspend a member';
  end if;
  if m.user_id = caller then
    raise exception 'You cannot suspend yourself';
  end if;
  -- A network admin cannot suspend a Hub admin out of the way.
  if public.is_hub_admin(m.user_id) and not public.is_hub_admin(caller) then
    raise exception 'You cannot suspend a Hub administrator';
  end if;

  update public.org_memberships
     set status = 'suspended',
         suspended_at = now(),
         suspended_by = caller,
         suspension_reason = reason,
         decided_at = now(),
         decided_by = caller
   where id = membership;

  select name into org_name from public.organizations where id = m.organization_id;
  select coalesce(full_name, username, 'A member') into who from public.profiles where id = m.user_id;

  -- Tell the person plainly.
  insert into public.notifications (user_id, type, title, body, link, content_type)
  values (
    m.user_id, 'membership',
    'Your membership of ' || coalesce(org_name, 'your network') || ' is suspended',
    coalesce(reason, 'Your network''s administrators have paused your membership. Contact them or the Hub if you think this is a mistake.'),
    '/dashboard/account', 'organization'
  );

  -- And tell the Hub, which is the only party that can escalate to a ban.
  for admin_id in select id from public.profiles where coalesce(is_hub_admin, false) loop
    insert into public.notifications (user_id, type, title, body, link, content_type)
    values (
      admin_id, 'moderation',
      who || ' was suspended by ' || coalesce(org_name, 'their network'),
      coalesce(reason, 'No reason was given.') || ' Review the account if this needs to go further.',
      '/hub/accounts', 'organization'
    );
  end loop;

  return true;
end $$;

/** Lift a suspension. The same people who can impose one can lift it. */
create or replace function public.unsuspend_member(membership uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  caller uuid := auth.uid();
  m public.org_memberships%rowtype;
  org_name text;
begin
  if caller is null then raise exception 'Not signed in'; end if;
  select * into m from public.org_memberships where id = membership;
  if not found then raise exception 'That membership no longer exists'; end if;
  if not (public.is_hub_admin(caller) or public.is_org_admin(m.organization_id, caller)) then
    raise exception 'Only an admin of this network can lift a suspension';
  end if;

  update public.org_memberships
     set status = 'approved',
         suspended_at = null, suspended_by = null, suspension_reason = null,
         decided_at = now(), decided_by = caller
   where id = membership;

  select name into org_name from public.organizations where id = m.organization_id;
  insert into public.notifications (user_id, type, title, body, link, content_type)
  values (m.user_id, 'membership',
          'Your membership of ' || coalesce(org_name, 'your network') || ' is active again',
          'You can post and publish again.', '/dashboard', 'organization');
  return true;
end $$;

/**
 * Ban an account. The Hub's decision alone.
 *
 * The content stays where it is — banning is not deletion, and a moderation
 * record that erased the evidence would be worse than useless. Every
 * membership is suspended so the person cannot post through any network, and
 * the app refuses the session at every authenticated surface.
 */
create or replace function public.ban_account(target uuid, reason text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare caller uuid := auth.uid();
begin
  if not public.is_hub_admin(caller) then
    raise exception 'Only the Hub can ban an account';
  end if;
  if caller = target then raise exception 'You cannot ban yourself'; end if;

  update public.profiles
     set banned_at = coalesce(banned_at, now()),
         banned_by = caller,
         ban_reason = reason
   where id = target;

  update public.org_memberships
     set status = 'suspended',
         suspended_at = coalesce(suspended_at, now()),
         suspended_by = caller,
         suspension_reason = coalesce(suspension_reason, 'Account banned by the Hub')
   where user_id = target and status = 'approved';

  insert into public.notifications (user_id, type, title, body, link, content_type)
  values (target, 'moderation', 'Your account has been suspended by the Hub',
          coalesce(reason, 'Contact the Hub if you believe this is a mistake.'),
          '/account-suspended', 'account');
  return true;
end $$;

create or replace function public.unban_account(target uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_hub_admin(auth.uid()) then
    raise exception 'Only the Hub can lift a ban';
  end if;
  update public.profiles
     set banned_at = null, banned_by = null, ban_reason = null
   where id = target;
  insert into public.notifications (user_id, type, title, body, link, content_type)
  values (target, 'moderation', 'Your account has been reinstated',
          'You can sign in and take part again.', '/dashboard', 'account');
  return true;
end $$;

grant execute on function public.suspend_member(uuid, text)   to authenticated;
grant execute on function public.unsuspend_member(uuid)       to authenticated;
grant execute on function public.ban_account(uuid, text)      to authenticated;
grant execute on function public.unban_account(uuid)          to authenticated;

-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  5. Triggers                                                            ║
-- ╚════════════════════════════════════════════════════════════════════════╝

-- A profile row for every new auth user.
do $$ begin
  drop trigger if exists on_auth_user_created on auth.users;
  create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
exception when insufficient_privilege then
  raise notice 'cannot attach the auth.users trigger here; skipping';
end $$;

drop trigger if exists trg_blogs_before_write on public.blogs;
create trigger trg_blogs_before_write before insert or update on public.blogs
  for each row execute function public.blogs_before_write();

drop trigger if exists trg_posts_before_write on public.posts;
create trigger trg_posts_before_write before insert or update on public.posts
  for each row execute function public.posts_before_write();

drop trigger if exists trg_resources_before_write on public.resources;
create trigger trg_resources_before_write before insert or update on public.resources
  for each row execute function public.resources_before_write();

drop trigger if exists trg_reports_updated_at on public.reports;
create trigger trg_reports_updated_at before update on public.reports
  for each row execute function public.handle_updated_at();

-- Matching runs the moment a report is filed, and again if what was asked for
-- or where it happened changes. The old verify-only trigger is dropped.
drop trigger if exists trg_report_verified on public.reports;
drop trigger if exists trg_report_matching on public.reports;
create trigger trg_report_matching after insert or update on public.reports
  for each row execute function public.handle_report_matching();

drop trigger if exists trg_service_assigned_notify on public.report_services;
create trigger trg_service_assigned_notify after insert on public.report_services
  for each row execute function public.handle_service_assigned_notify();

drop trigger if exists trg_sync_notification_read on public.notifications;
create trigger trg_sync_notification_read before insert or update on public.notifications
  for each row execute function public.sync_notification_read_flags();

drop trigger if exists trg_fill_report_notification on public.notifications;
create trigger trg_fill_report_notification before insert on public.notifications
  for each row execute function public.fill_report_notification_copy();

drop trigger if exists trg_membership_before_write on public.org_memberships;
create trigger trg_membership_before_write before insert or update on public.org_memberships
  for each row execute function public.membership_before_write();

do $$
declare t text;
begin
  foreach t in array array['posts','blogs','reports','post_comments'] loop
    execute format('drop trigger if exists trg_stamp_soft_delete on public.%I', t);
    execute format('create trigger trg_stamp_soft_delete before update on public.%I
                      for each row execute function public.stamp_soft_delete()', t);
  end loop;
end $$;

-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  6. Row level security                                                  ║
-- ╚════════════════════════════════════════════════════════════════════════╝
--
-- Deleted content is invisible to everyone except Hub administrators. That
-- includes its own author: from where they stand, deleting means gone. The
-- soft delete itself therefore runs through delete_own_content(), which is
-- SECURITY DEFINER precisely because a policy that hides the row from its
-- author would otherwise make the author's own delete impossible.

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','county_networks','organizations','org_memberships',
    'mentorship_profiles','mentorship_matches','posts','blogs','post_reactions',
    'post_comments','content_audit_log','notifications','resources','reports',
    'services','report_services','report_audit_log','ussd_sessions',
    'listening_keywords','listening_results'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Clear every policy this file owns so it can be re-run.
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ── Profiles ─────────────────────────────────────────────────────────────
create policy profiles_own on public.profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);

create policy profiles_public_read on public.profiles for select
  using (account_deleted_at is null);

create policy profiles_responders_read on public.profiles for select
  using (public.is_hub_admin() or (public.can_triage_reports() and account_deleted_at is null));

create policy profiles_admin_update on public.profiles for update
  using (public.is_hub_admin()) with check (public.is_hub_admin());

-- ── County networks ──────────────────────────────────────────────────────
create policy cn_read  on public.county_networks for select using (true);
create policy cn_write on public.county_networks for all
  using (public.is_hub_admin()) with check (public.is_hub_admin());

-- ── Organizations ────────────────────────────────────────────────────────
create policy org_read on public.organizations for select using (true);
create policy org_insert on public.organizations for insert to authenticated
  with check (created_by = auth.uid());
create policy org_update on public.organizations for update
  using (created_by = auth.uid() or public.is_hub_admin() or public.is_org_admin(id))
  with check (created_by = auth.uid() or public.is_hub_admin() or public.is_org_admin(id));

-- ── Memberships ──────────────────────────────────────────────────────────
-- Requests are visible to the person who made them, to the administrators of
-- the organisation they are asking to join, and to the Hub.
create policy mem_read on public.org_memberships for select using (
  user_id = auth.uid()
  or public.is_hub_admin()
  or organization_id in (select public.my_admin_org_ids())
  or (status = 'approved' and organization_id in (select public.my_org_ids()))
);

-- You may only ever ask for yourself, and never let yourself in.
create policy mem_join on public.org_memberships for insert to authenticated
  with check (user_id = auth.uid() and (status = 'pending' or public.is_hub_admin()));

-- Approving, declining, and appointing administrators. An organisation may
-- have as many administrators as it wants; the Hub can appoint or remove one
-- in any organisation.
create policy mem_decide on public.org_memberships for update
  using (public.is_hub_admin() or organization_id in (select public.my_admin_org_ids()))
  with check (public.is_hub_admin() or organization_id in (select public.my_admin_org_ids()));

create policy mem_leave on public.org_memberships for delete using (
  user_id = auth.uid()
  or public.is_hub_admin()
  or organization_id in (select public.my_admin_org_ids())
);

-- ── Femtorship ───────────────────────────────────────────────────────────
create policy mp_rw on public.mentorship_profiles for all
  using (user_id = auth.uid() or public.is_hub_admin())
  with check (user_id = auth.uid() or public.is_hub_admin());

create policy match_read on public.mentorship_matches for select
  using (mentor_id = auth.uid() or mentee_id = auth.uid() or public.is_hub_admin());
create policy match_write on public.mentorship_matches for all
  using (public.is_hub_admin()) with check (public.is_hub_admin());

-- ── Posts ────────────────────────────────────────────────────────────────
create policy post_read on public.posts for select using (
  public.is_hub_admin()
  or (deleted_at is null and (status = 'approved' or author_id = auth.uid()))
);

-- Only members write to the feed, and only ever as themselves. Hub staff
-- publish directly; everyone else submits for review.
create policy post_insert on public.posts for insert to authenticated with check (
  author_id = auth.uid()
  and public.can_post_to_feed()
  and (public.is_hub_admin() or status = 'pending')
);

create policy post_update on public.posts for update
  using ((author_id = auth.uid() and deleted_at is null) or public.is_hub_admin())
  with check ((author_id = auth.uid() and deleted_at is null) or public.is_hub_admin());

create policy post_delete on public.posts for delete using (public.is_hub_admin());

-- ── Blogs ────────────────────────────────────────────────────────────────
create policy blog_read on public.blogs for select using (
  public.is_hub_admin()
  or (deleted_at is null and (status = 'approved' or author_id = auth.uid()))
);
create policy blog_insert on public.blogs for insert to authenticated with check (
  author_id = auth.uid()
  and public.can_post_to_feed()
  and (public.is_hub_admin() or status in ('draft','pending'))
);
create policy blog_update on public.blogs for update
  using ((author_id = auth.uid() and deleted_at is null) or public.is_hub_admin())
  with check ((author_id = auth.uid() and deleted_at is null) or public.is_hub_admin());
create policy blog_delete on public.blogs for delete using (public.is_hub_admin());

-- ── Reactions ────────────────────────────────────────────────────────────
-- Anyone may read the counts; supporting a post needs an account. A signed-out
-- visitor's support is held in their browser and saved here when they sign in.
create policy react_read on public.post_reactions for select using (true);
create policy react_write on public.post_reactions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and not public.is_banned());

-- ── Comments ─────────────────────────────────────────────────────────────
-- Commenting needs an account, unlike supporting. A banned account is refused.
create policy comment_read on public.post_comments for select using (
  public.is_hub_admin()
  or (deleted_at is null and exists (
        select 1 from public.posts p
         where p.id = post_id and p.deleted_at is null and p.status = 'approved'))
);
create policy comment_insert on public.post_comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and not public.is_banned()
    and exists (select 1 from public.posts p
                 where p.id = post_id and p.deleted_at is null and p.status = 'approved')
  );
create policy comment_update on public.post_comments for update
  using ((author_id = auth.uid() and deleted_at is null) or public.is_hub_admin())
  with check ((author_id = auth.uid() and deleted_at is null) or public.is_hub_admin());
create policy comment_delete on public.post_comments for delete using (public.is_hub_admin());

-- ── Content audit log ────────────────────────────────────────────────────
create policy audit_read on public.content_audit_log for select using (public.is_hub_admin());
create policy audit_write on public.content_audit_log for insert to authenticated
  with check (actor_id = auth.uid() or public.is_hub_admin());

-- ── Notifications ────────────────────────────────────────────────────────
create policy notif_read on public.notifications for select using (user_id = auth.uid());
create policy notif_update on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Resources ────────────────────────────────────────────────────────────
create policy resource_read on public.resources for select
  using (published or public.is_hub_admin());
create policy resource_write on public.resources for all
  using (public.is_hub_admin()) with check (public.is_hub_admin());

-- ── Reports ──────────────────────────────────────────────────────────────
create policy report_own_read on public.reports for select
  using (auth.uid() = user_id and deleted_at is null);
-- A banned account cannot file through the signed-in path. Anonymous reporting
-- is untouched: it goes through the service role and belongs to nobody yet, and
-- refusing a survivor a report because of a moderation decision would be the
-- wrong trade.
create policy report_own_insert on public.reports for insert to authenticated
  with check (auth.uid() = user_id and not public.is_banned());

create policy report_responders_read on public.reports for select using (
  public.can_administer_reports()
  or (public.can_triage_reports() and deleted_at is null)
);
create policy report_responders_update on public.reports for update
  using (public.can_triage_reports()) with check (public.can_triage_reports());
create policy report_delete on public.reports for delete
  using (public.can_administer_reports());

-- ── Services and referrals ───────────────────────────────────────────────
create policy service_public_read on public.services for select using (is_active = true);
create policy service_admin_all on public.services for all
  using (public.can_administer_reports()) with check (public.can_administer_reports());

create policy rs_own_read on public.report_services for select using (
  exists (select 1 from public.reports r
           where r.id = report_id and r.user_id = auth.uid() and r.deleted_at is null)
);
create policy rs_responders on public.report_services for all
  using (public.can_triage_reports()) with check (public.can_triage_reports());

create policy ral_responders on public.report_audit_log for all
  using (public.can_triage_reports()) with check (public.can_triage_reports());
create policy ral_own_read on public.report_audit_log for select using (
  exists (select 1 from public.reports r where r.id = report_id and r.user_id = auth.uid())
);

create policy ussd_admin on public.ussd_sessions for all
  using (public.can_administer_reports()) with check (public.can_administer_reports());

-- ── Online listening ─────────────────────────────────────────────────────
create policy listening_kw on public.listening_keywords for all
  using (public.can_administer_reports()) with check (public.can_administer_reports());
create policy listening_res on public.listening_results for all
  using (public.can_administer_reports()) with check (public.can_administer_reports());

-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  7. Storage buckets and their policies                                  ║
-- ╚════════════════════════════════════════════════════════════════════════╝
--
--   avatars            public   profile pictures, one folder per user
--   media              public   post and story attachments, one folder per user
--   publications       public   the Hub's reports, guides and newsletters
--   report-screenshots PRIVATE  evidence attached to a report

insert into storage.buckets (id, name, public, file_size_limit)
values ('avatars', 'avatars', true, 5242880)
on conflict (id) do update set public = true, file_size_limit = 5242880;

insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', true, 52428800)
on conflict (id) do update set public = true, file_size_limit = 52428800;

-- No MIME allow-list on purpose: browsers report an empty or generic content
-- type for some files (notably PDFs picked on Windows) and an allow-list
-- rejects those with an error nobody can act on. The upload form restricts what
-- can be chosen instead.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('publications', 'publications', true, 104857600, null)
on conflict (id) do update set public = true, file_size_limit = 104857600, allowed_mime_types = null;

-- Evidence is never public. Reading it requires being the reporter who
-- uploaded it, or being on the response team.
insert into storage.buckets (id, name, public, file_size_limit)
values ('report-screenshots', 'report-screenshots', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = 26214400;

do $$
declare r record;
begin
  for r in select policyname from pg_policies
            where schemaname = 'storage' and tablename = 'objects'
  loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end $$;

-- avatars
create policy avatars_public_read on storage.objects for select
  using (bucket_id = 'avatars');
create policy avatars_owner_write on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- media
create policy media_public_read on storage.objects for select
  using (bucket_id = 'media');
create policy media_owner_write on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy media_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy media_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

-- publications
create policy publications_public_read on storage.objects for select
  using (bucket_id = 'publications');
create policy publications_admin_write on storage.objects for insert to authenticated
  with check (bucket_id = 'publications' and public.is_hub_admin());
create policy publications_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'publications' and public.is_hub_admin());
create policy publications_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'publications' and public.is_hub_admin());

-- report evidence
create policy screenshots_owner_write on storage.objects for insert to authenticated
  with check (bucket_id = 'report-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);
create policy screenshots_owner_read on storage.objects for select to authenticated
  using (bucket_id = 'report-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);
create policy screenshots_responders_read on storage.objects for select to authenticated
  using (bucket_id = 'report-screenshots' and public.can_triage_reports());


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  8. Grants                                                              ║
-- ╚════════════════════════════════════════════════════════════════════════╝
--
-- A hosted Supabase project grants these automatically through default
-- privileges, so this is a no-op there. Stated explicitly so the schema also
-- stands up on a plain PostgreSQL for local development and CI.

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public
  to anon, authenticated, service_role;
grant usage, select on all sequences in schema public
  to anon, authenticated, service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;

-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  9. Seed content                                                        ║
-- ╚════════════════════════════════════════════════════════════════════════╝
--
-- What makes a fresh project look like a working product rather than an empty
-- shell: the eight county networks, their host organisations, the support
-- services the referral matcher draws on, stories and posts for the feed,
-- comments, publications, and a handful of illustrative reports.
--
-- No auth users are created. Seeded posts, comments and reports carry a display
-- name on the row instead, so the seed cannot manufacture an account that
-- somebody could sign into. Every insert is keyed, so re-running changes
-- nothing.

-- ── County networks ──────────────────────────────────────────────────────

insert into public.county_networks (name, slug, is_active) values
  ('Bomet','bomet',true),('Kisumu','kisumu',true),('Kitui','kitui',true),
  ('Marsabit','marsabit',true),('Meru','meru',true),('Mombasa','mombasa',true),
  ('Nairobi','nairobi',true),('Nakuru','nakuru',true)
on conflict (slug) do nothing;


-- ── Organisations ────────────────────────────────────────────────────────

insert into public.organizations (name, slug, description, county_network_id, verification_status, verified_at)
select v.name, v.slug, v.description, cn.id, 'verified', now()
from (values
  ('Kisumu Women Defenders Network', 'kisumu-wdn', 'Formed in 2019 to promote human rights and gender equality across five sub-counties of Kisumu.', 'kisumu'),
  ('Kitui Women Peace and Security', 'kitui-wps', 'A non-partisan network of grassroots women ending violence against women and girls and building their role in peace and security.', 'kitui'),
  ('Pastoralists Peoples Initiative', 'ppi-marsabit', 'A non-profit umbrella organisation empowering women and youth across Marsabit.', 'marsabit'),
  ('Kiengu Women Challenged to Challenge', 'kwcc-meru', 'Advancing women''s rights and mobilising communities for justice in Meru.', 'meru'),
  ('Muslim Women Advancement of Rights and Protection', 'mwarp-mombasa', 'Building safety and solidarity for women defenders across the coast.', 'mombasa'),
  ('Women Beyond Borders', 'wbb-nairobi', 'Connecting defenders across Nairobi and the wider national network.', 'nairobi'),
  ('Women''s Rights League', 'wrl-nakuru', 'A feminist movement of defenders, women in politics, and women journalists in Nakuru.', 'nakuru')
) as v(name, slug, description, county_slug)
join public.county_networks cn on cn.slug = v.county_slug
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  county_network_id = excluded.county_network_id,
  verification_status = 'verified',
  verified_at = now();


-- ── Stories ──────────────────────────────────────────────────────────────

delete from public.county_networks
where slug not in ('bomet','kisumu','kitui','marsabit','meru','mombasa','nairobi','nakuru')
  and id not in (select county_network_id from public.profiles       where county_network_id is not null)
  and id not in (select county_network_id from public.organizations  where county_network_id is not null);

insert into public.blogs
  (title, slug, excerpt, body, cover_image_url, is_hub, status, published_at)
values
  (
    'Rasna Warah',
    'rasna-warah',
    'Remembering Rasna Warah, a bold Kenyan journalist, author, and human rights champion driven by a deep sense of justice.',
    '<p>Rasna Warah, who passed away on January 11, 2025, at the age of 63, was a bold and brilliant Kenyan journalist, author, and human rights champion. Her life''s work was driven by a deep sense of justice, and she never shied away from speaking uncomfortable truths no matter how powerful the people or institutions involved.</p><p>Rasna''s voice resonated through countless columns and articles in publications like the Daily Nation, The Standard, The Elephant, The Guardian, and The East African. She wrote fearlessly about corruption, bad governance, marginalization, and the damaging legacies of colonialism and Western intervention. Her pen was her weapon and she used it with precision and purpose.</p><p>Beyond journalism, Rasna authored several powerful books including Triple Heritage, Mogadishu Then and Now, War Crimes, UNsilenced, and Lords of Impunity. Through her writing, she exposed injustices, challenged global institutions like the UN, and gave voice to those who are too often ignored or silenced.</p><p>What set Rasna apart was not just her sharp intellect or courageous writing, it was her heart. She stood firmly with the marginalized, the vulnerable, and the silenced. She believed that truth mattered, and she dedicated her life to uncovering it, no matter the cost.</p><p>Losing Rasna is a deep blow to journalism, activism, and the broader struggle for human rights. But her legacy, her words, her courage, her stand for justice lives on. She has inspired a generation to write, to question, and most importantly, to never stop defending what''s right.</p><p>Rest in power, Rasna Warah. You will not be forgotten.</p>',
    'https://whrdhub.org/wp-content/uploads/2025/04/Rasna-Warah.jpg',
    true, 'approved', timestamptz '2025-04-07 09:00+03'
  ),
  (
    'International Women''s Day 2025',
    'international-womens-day-2025',
    'More than a celebration, a call to action. We shared stories of courage and launched Rooted in Courage.',
    '<p>International Women''s Day 2025 was more than a celebration, it was a call to action. As we shared stories of courage and launched Rooted in Courage, we reaffirmed our commitment to ending GBV and advancing gender equality.</p><p>But the work does not stop here. We must:</p><ol><li>Advocate for policies that protect women''s rights</li><li>Hold leaders accountable for gender equality commitments</li><li>Support survivors and amplify their voices</li><li>Challenge harmful norms and promote inclusive communities</li></ol><blockquote>As our chief guest during the event, Hon. Rehema Jaldesa stated, "The time to act is now! Beyond rhetoric, we need real, tangible actions to empower all women and girls."</blockquote><p>Let us keep pushing for change!</p>',
    'https://whrdhub.org/wp-content/uploads/2025/03/IMG_0764-scaled.jpg',
    true, 'approved', timestamptz '2025-03-17 09:00+03'
  ),
  (
    'The Hub''s First Donor Roundtable',
    'first-donor-roundtable',
    'Our first Donor Roundtable, with support from the Open Society Foundations, marked a new chapter of partnership for women human rights defenders.',
    '<p>On September 10th, 2024, we hosted our first Donor Roundtable, marking a key moment in our journey. With support from the Open Society Foundations, this event was an important step towards building partnerships that align with our mission of supporting women human rights defenders (WHRDs) in Kenya and beyond, as part of our 2024 to 2029 Strategic Plan.</p><p>The roundtable allowed us to share our story, focusing on both our achievements and future plans. It showed how we have been supporting WHRDs by improving safety, building stronger connections among women defenders, and offering training programs that enhance their skills and knowledge.</p><p>We shared examples of our impact, such as creating networks that help WHRDs support each other and overcome challenges like violence and harassment. This event was not just a discussion, but a chance to build stronger relationships with donors. As we move forward with our 2024 to 2029 plan, these partnerships will be vital in ensuring that WHRDs have the resources and support they need to continue their important work.</p>',
    'https://whrdhub.org/wp-content/uploads/2024/09/0I2A7208-scaled.jpg',
    true, 'approved', timestamptz '2024-09-26 09:00+03'
  ),
  (
    'Safety and Security Training Program',
    'safety-and-security-training-program',
    'A one-week safety and security training with practical exercises, empowering participants to assess risks and respond to emergencies.',
    '<p>A comprehensive one week safety and security training program with engaging sessions and practical exercises, empowering participants with vital knowledge and skills to assess risks, implement preventative measures, and respond effectively to emergencies.</p><p>As an organization, our commitment to safety and security extends beyond mere education and training; it encompasses a holistic approach that emphasizes collaboration, empowerment, and continuous improvement.</p>',
    'https://whrdhub.org/wp-content/uploads/2024/05/WhatsApp-Image-2024-05-28-at-12.39.20.jpeg',
    true, 'approved', timestamptz '2024-05-28 09:00+03'
  ),
  (
    'WHRDHUB Strategic Plan 2024-2028 Validation',
    'strategic-plan-2024-2028-validation',
    'A momentous validation workshop for our Strategic Plan, showcasing our dedication to the livelihoods, safety, mentorship, and wellbeing of WHRDs.',
    '<p>What a momentous day at the validation workshop for the Women Human Rights Defenders Hub SP 2024 to 28! With partners and key stakeholders in attendance, we proudly showcased our dedication to enhancing the livelihoods, safety, mentorship, and wellbeing of WHRDs. The day provided a valuable opportunity to reflect on our achievements and stress the significance of the Strategic Plan in shaping the future of WHRDs in Kenya and beyond. It was a platform for key stakeholders to reaffirm their commitment to turning our objectives into reality.</p>',
    'https://whrdhub.org/wp-content/uploads/2024/05/DSC_8300-scaled.jpg',
    true, 'approved', timestamptz '2024-05-28 10:00+03'
  ),
  (
    'Convening Protection Networks for Uganda, Kenya and Tanzania',
    'protection-networks-consortium-convening',
    'Gathering with the East Africa Women Human Rights Network to strengthen protection networks across the region.',
    '<p>In Uganda, East Africa, we gathered with a group of incredible individuals as part of the East Africa Women Human Rights Network.</p><p>The one week meeting began on the 23rd of April, a significant date symbolizing unity and cooperation. The primary goal of our gathering was to create a roadmap and develop strategies for the year 2024, which holds immense promise for Women Human Rights Defenders in the region.</p>',
    'https://whrdhub.org/wp-content/uploads/2024/05/WhatsApp-Image-2024-05-28-at-12.27.40-1.jpeg',
    true, 'approved', timestamptz '2024-05-28 11:00+03'
  ),
  (
    'Meeting with Delegates from the French Embassy',
    'meeting-with-delegates-french-embassy',
    'The Hub met with delegates from the French Embassy and strategic partners for deliberations on technology and its careful application.',
    '<p>The Hub, in the company of delegates from the French Embassy and other strategic partners, held a constructive deliberation on gene drives and technological remedies that could be adopted. The gathering came in appreciation of the great strides realized in genetic science and the urgency to handle these discoveries with care.</p><p>As an organization, our proposed vision of continuous evaluations and implementation of a robust, updated regulatory framework to manage similar technologies is driven by our institutional dedication towards sound scientific achievements that are also environmentally friendly.</p>',
    'https://whrdhub.org/wp-content/uploads/2024/05/WhatsApp-Image-2024-05-28-at-12.26.32.jpeg',
    true, 'approved', timestamptz '2024-05-28 12:00+03'
  ),
  (
    'Joannah Stutchbury',
    'joannah-stutchbury',
    'Honouring the memory of Joannah Stutchbury, who defended human rights and the environment in Kiambu County.',
    '<h2>A Tribute to a Woman Human Rights Defender and Environmentalist</h2><p>We honor the memory of Joannah Stutchbury, a courageous woman who defended human rights and the environment. Tragically, she was allegedly murdered for her stance against environmental injustice in Kiambu Forest, Kiambu County.</p><p>Her courage remains a call to every defender protecting land, forests, and the communities that depend on them.</p>',
    'https://whrdhub.org/wp-content/uploads/2024/05/WhatsApp-Image-2021-08-02-at-02.03.06.jpeg',
    true, 'approved', timestamptz '2024-05-24 09:00+03'
  ),
  (
    'Elizabeth Ekaru',
    'elizabeth-ekaru',
    'Remembering Elizabeth Ibrahim Ekaru, a champion of women''s rights and an environmental and land rights advocate.',
    '<h2>A Tribute to a Woman Human Rights Defender and Environmentalist</h2><p>Elizabeth Ibrahim Ekaru was an ardent champion of women''s rights and an environmental and land rights advocate, in addition to being a peacemaker. Elizabeth was previously acknowledged for her efforts when she was awarded the Head of State Commendation Award for bravery and leading in the fight for human rights in Kenya.</p><p>The widespread nature of violence against defenders of women''s human rights in Kenya is highlighted by the alleged murder of Elizabeth Ibrahim Ekaru. Her killing, which allegedly took place while defending land rights, is a true testimony of the risks, challenges and attacks that women human rights defenders continue to face in the line of their work. Her death exemplifies the high cost that women human rights defenders bear in their efforts to protect and advance the social, economic, cultural, and political rights enshrined in Kenya''s 2010 Constitution.</p><p>We pay tribute to her lasting impact.</p>',
    'https://whrdhub.org/wp-content/uploads/2024/05/download-3.jpg',
    true, 'approved', timestamptz '2024-05-24 10:00+03'
  ),
  (
    'IWHRD Celebrations 2023',
    'iwhrd-celebrations-2023',
    'Celebrating International Women Human Rights Defenders Day 2023 with our networks and partners.',
    '<p>The Hub marked International Women Human Rights Defenders Day 2023 with our networks and partners, celebrating the courage of defenders and recommitting to their protection and wellbeing. The day brought together women defenders from across our county networks to share, connect, and honour the work of protecting rights in their communities.</p>',
    'https://whrdhub.org/wp-content/uploads/2024/05/Capture.png',
    true, 'approved', timestamptz '2024-05-24 11:00+03'
  )
on conflict (slug) do update set
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  cover_image_url = excluded.cover_image_url,
  status = 'approved',
  is_hub = true,
  published_at = excluded.published_at;


-- ── Blog gallery images ──────────────────────────────────────────────────

alter table public.blogs
  add column if not exists gallery jsonb not null default '[]'::jsonb;

-- Seed the extra in-article images captured from whrdhub.org.
-- Only International Women's Day 2025 has a photo beyond its cover.
update public.blogs
set gallery = '["https://whrdhub.org/wp-content/uploads/2025/03/IMG_0902-scaled.jpg"]'::jsonb
where slug = 'international-womens-day-2025';


-- ── Feed posts ───────────────────────────────────────────────────────────

alter table public.posts
  add column if not exists guest_name  text,
  add column if not exists guest_title text;

-- Clear previous demo seeds so re-running does not pile up duplicates.
delete from public.posts where guest_name is not null;

insert into public.posts
  (body, county_network_id, is_hub, status, published_at, guest_name, guest_title)
values
  (
    'Wrapped up a three-day safety and security training in Kitui with 20 defenders. Watching each other grow more confident about staying safe online and offline is why we do this work.',
    (select id from public.county_networks where slug = 'kitui'),
    false, 'approved', now() - interval '2 hours',
    'Faith Mwikali', 'Community organiser, Kitui'
  ),
  (
    'You are not alone. If you are a defender facing threats online, reach out. Our digital security volunteers can help you lock down your accounts and document what is happening.',
    (select id from public.county_networks where slug = 'nairobi'),
    false, 'approved', now() - interval '6 hours',
    'Achieng Odhiambo', 'Digital safety advocate'
  ),
  (
    'Coastal defenders came together this weekend for a wellbeing circle in Mombasa. Rest is resistance. Protecting others starts with protecting ourselves.',
    (select id from public.county_networks where slug = 'mombasa'),
    false, 'approved', now() - interval '1 day',
    'Amina Said', 'WHRD, Mombasa'
  ),
  (
    'Land rights are women''s rights. Proud to stand with the women of Meru as they push for a fair hearing on land injustices affecting their families.',
    (select id from public.county_networks where slug = 'meru'),
    false, 'approved', now() - interval '1 day 4 hours',
    'Gakii Mutembei', 'Legal advocate'
  ),
  (
    'Femtorship changed my path. A year ago I was afraid to speak in public. Today I chaired our county network meeting. Grateful to the femtor who believed in me.',
    (select id from public.county_networks where slug = 'nakuru'),
    false, 'approved', now() - interval '2 days',
    'Wanjiru Kamau', 'Young defender, Nakuru'
  ),
  (
    'Reached three more villages in Marsabit this month. The distances are long but the welcome is warm. Every defender we reach makes the network stronger.',
    (select id from public.county_networks where slug = 'marsabit'),
    false, 'approved', now() - interval '3 days',
    'Halima Boru', 'Field coordinator'
  ),
  (
    'Our familiarisation meeting in Bomet was full of energy. New faces, shared stories, and a real hunger to organise. This is how movements grow.',
    (select id from public.county_networks where slug = 'bomet'),
    false, 'approved', now() - interval '4 days',
    'Chepngeno Rotich', 'Organiser, Bomet'
  ),
  (
    'We testified before the county assembly today on funding for gender-based violence services. Uncomfortable rooms are exactly where defenders need to be.',
    (select id from public.county_networks where slug = 'nairobi'),
    false, 'approved', now() - interval '5 days',
    'Njeri Kariuki', 'Policy advocate'
  ),
  (
    'Sixteen days, one movement. Kisumu defenders are marking the 16 Days of Activism with school visits, radio spots, and survivor support clinics. Come join us.',
    (select id from public.county_networks where slug = 'kisumu'),
    false, 'approved', now() - interval '6 days',
    'Sarah Atieno', 'WHRD, Kisumu'
  ),
  (
    'To every woman defender reading this: your courage is contagious. Keep going. We have each other, and together we are safer and stronger.',
    (select id from public.county_networks where slug = 'nairobi'),
    false, 'approved', now() - interval '8 days',
    'Beatrice Wafula', 'Human rights defender'
  );


-- ── Publications ─────────────────────────────────────────────────────────

insert into public.resources (title, slug, kind, cover_image_url, file_url, sort_order, published_on) values
  ('Annual Report 2024', 'annual-report-2024', 'Report',
   'https://whrdhub.org/wp-content/uploads/2025/03/Annual-Report-2024_page-0001-212x300.jpg',
   'https://whrdhub.org/wp-content/uploads/dlm_uploads/2025/03/Annual-Report-2024.pdf', 10, '2025-03-01'),
  ('Rooted in Courage and Resilience', 'rooted-in-courage-and-resilience', 'Report',
   'https://whrdhub.org/wp-content/uploads/2025/03/Rooted-in-Courage-211x300.jpg',
   'https://whrdhub.org/wp-content/uploads/dlm_uploads/2025/03/Rooted-in-Courage-and-Resilience.pdf', 20, '2025-03-01'),
  ('Pillars of Transformation: The State of WHRDs in Kenya', 'pillars-of-transformation', 'Research',
   'https://whrdhub.org/wp-content/uploads/2025/12/Pillars-of-Transformation-The-State-of-Women-Human-Rights-Defenders-in-Kenya_page-0001-211x300.jpg',
   'https://whrdhub.org/wp-content/uploads/2026/01/Research-Report-of-the-Legal-2.pdf', 30, '2025-12-01'),
  ('Building Communities of Action Towards Ending GBV', 'building-communities-of-action', 'Report',
   'https://whrdhub.org/wp-content/uploads/2026/01/Building-Communities-of-Action-Towards-Ending-GBV-Cover-Page_page-0001-1-213x300.jpg',
   'https://whrdhub.org/wp-content/uploads/2026/01/Building-Communities-of-Action-Towards-Ending-GBV.pdf', 40, '2026-01-01'),
  ('Turning Barriers into Bridges: Access to Services for GBV Survivors', 'turning-barriers-into-bridges', 'Report',
   'https://whrdhub.org/wp-content/uploads/2026/01/Turning-Barriers-To-Bridges-Cover_page-0001-232x300.jpg',
   'https://whrdhub.org/wp-content/uploads/2026/02/Turning-Barriers-into-Bridges_-Enhancing-Access-to-Service-Delivery-for-GBV-Survivors-7.pdf', 50, '2026-02-01'),
  ('Safety and Security Training Guide', 'safety-and-security-training-guide', 'Guide',
   'https://whrdhub.org/wp-content/uploads/2026/01/Safeguarding-Holistic-Protection-Cover_page-0001-212x300.jpg',
   'https://whrdhub.org/wp-content/uploads/2026/01/we-lead-safety-and-security-tr-2.pdf', 60, '2026-01-01'),
  ('Policy Brief', 'policy-brief', 'Policy brief',
   'https://whrdhub.org/wp-content/uploads/2024/05/Policy-Pic-221x300.png',
   'https://whrdhub.org/wp-content/uploads/dlm_uploads/2024/05/POLICY-BRIEF.pdf', 70, '2024-05-01'),
  ('Photo Book 2024 to 2025', 'photo-book-2024-2025', 'Photo book',
   'https://whrdhub.org/wp-content/uploads/2026/01/2024-2025-PhotoBook-300x155.jpg',
   'https://whrdhub.org/wp-content/uploads/2026/02/Photo-Book-2.pdf', 80, '2026-01-01')
on conflict (slug) do nothing;

insert into public.resources (title, slug, kind, is_newsletter, featured, description, edition_label, cover_image_url, file_url, sort_order, published_on) values
  ('Pulse of Progress', 'pulse-of-progress', 'Newsletter', true, true,
   'The Hub''s bi-annual newsletter: stories, milestones, and updates from across the county networks.',
   'Latest edition',
   'https://whrdhub.org/wp-content/uploads/2026/02/1-212x300.png',
   'https://whrdhub.org/wp-content/uploads/2026/02/Pulse-of-Progress-Bi-annual-Newsletter.pdf', 10, '2026-02-01')
on conflict (slug) do nothing;


-- ── Listening keywords ───────────────────────────────────────────────────

insert into public.listening_keywords (word, severity) values
  ('rape','high'), ('defilement','high'), ('femicide','high'), ('assault','high'),
  ('gbv','high'), ('violence','high'), ('abuse','high'), ('harassment','medium'),
  ('threat','medium'), ('stalking','medium'), ('blackmail','medium'), ('doxxing','medium'),
  ('sextortion','high'), ('trafficking','high')
on conflict (lower(word)) do nothing;



insert into public.services (name, description, category, organization, contact_phone, contact_email, county, is_active)
select v.name, v.description, v.category::public.service_category_enum, v.org, v.phone, v.email, v.county, true
from (values
  ('FIDA Kenya legal aid',            'Free legal advice and representation for women, including protection orders and GBV cases.', 'legal',            'FIDA Kenya',                    '+254722509760', 'info@fidakenya.org',        null),
  ('Kitui paralegal desk',            'Community paralegals supporting defenders through reporting, statements and court follow-up.', 'legal',           'Kitui Women Peace and Security','+254700000101', 'legal@kitui-wps.org',        'Kitui'),
  ('GBV Recovery Centre - Nairobi',   'Post-rape care, injury treatment, forensic documentation and referral. Open 24 hours.',        'medical',          'Kenyatta National Hospital',    '+254703000000', null,                         'Nairobi'),
  ('Coast GBV medical response',      'Medical care and evidence collection for survivors across Mombasa and the coast.',              'medical',          'Coast General Hospital',        '+254700000102', null,                         'Mombasa'),
  ('Healthcare Assistance Kenya',     'National toll-free counselling and GBV response line, available around the clock.',             'psychosocial',     'HAK',                           '1195',          'info@hakenya.org',           null),
  ('Peer counselling circle',         'Trauma-informed peer support groups run by and for women human rights defenders.',              'psychosocial',     'WHRD Hub',                      null,            'support@whrdhub.org',        null),
  ('Safe house placement',            'Emergency accommodation for defenders at immediate risk, with relocation support.',             'shelter',          'WHRD Hub',                      '+254700000103', 'safety@whrdhub.org',         null),
  ('Nakuru emergency shelter',        'Short-stay shelter for women and children leaving a violent situation.',                        'shelter',          'Women''s Rights League',        '+254700000104', null,                         'Nakuru'),
  ('Digital security clinic',         'Account lockdown, device hygiene, takedown requests and evidence preservation for TFGBV.',      'digital_security', 'WHRD Hub',                      null,            'digital@whrdhub.org',        null),
  ('Emergency defender fund',         'Small rapid grants covering transport, medical costs and relocation for defenders at risk.',    'financial',        'WHRD Hub',                      null,            'fund@whrdhub.org',           null),
  ('National referral desk',          'Triage and warm referral into the right service when the need does not fit a single category.', 'referral',         'WHRD Hub',                      null,            'referrals@whrdhub.org',      null),
  ('Police Gender Desk liaison',      'Accompaniment and liaison when a defender chooses to report to the police.',                    'other',            'WHRD Hub',                      '999',           null,                         null)
) as v(name, description, category, org, phone, email, county)
where not exists (select 1 from public.services s where s.name = v.name);


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  2. Comments on the seeded feed posts                                   ║
-- ╚════════════════════════════════════════════════════════════════════════╝

delete from public.post_comments where guest_name is not null;

insert into public.post_comments (post_id, body, guest_name, guest_title, created_at)
select p.id, v.body, v.who, v.title, now() - v.age
from public.posts p
join (values
  ('Faith Mwikali', 'This is the work. Proud of every defender who showed up for those three days.', 'Naomi Wanjiru', 'Defender, Kitui',   interval '1 hour'),
  ('Faith Mwikali', 'Can we bring this training to Mwingi next quarter? There is real demand here.', 'Esther Kalondu', 'Paralegal, Kitui', interval '40 minutes'),
  ('Achieng Odhiambo', 'Shared this with our county group. The digital security clinic helped me last month.', 'Mercy Atieno', 'Defender, Kisumu', interval '3 hours')
) as v(author_match, body, who, title, age) on p.guest_name = v.author_match
where p.guest_name is not null;


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  3. Example reports, so the reporting console is not empty              ║
-- ╚════════════════════════════════════════════════════════════════════════╝
--
-- user_id is left null on purpose: these are illustrative cases, not real
-- people's reports, and no seeded account exists to attach them to. They are
-- visible to the response team and to nobody else.

delete from public.reports where description like '[DEMO]%';

insert into public.reports
  (user_id, incident_types, description, county, support_needed, urgency,
   status, verification_status, reporter_type, channel, is_ongoing, consent_to_followup, created_at)
values
  (null, array['online_harassment'],
   '[DEMO] Coordinated pile-on across two platforms after publishing a piece on land rights. Hundreds of accounts, many created the same week, using the same three insults.',
   'Nairobi', array['digital_security','psychosocial'], 'immediate',
   'submitted', 'pending', 'anonymous', 'web', true, true, now() - interval '4 hours'),
  (null, array['physical_violence','online_harassment'],
   '[DEMO] Threats at a community meeting followed by photographs of my home posted in a WhatsApp group.',
   'Kitui', array['legal','shelter'], 'immediate',
   'under_review', 'verified', 'authenticated', 'web', true, true, now() - interval '2 days'),
  (null, array['workplace_abuse'],
   '[DEMO] Ongoing intimidation from a supervisor after raising a safeguarding concern.',
   'Mombasa', array['legal','psychosocial'], 'within_week',
   'referred', 'verified', 'authenticated', 'web', false, true, now() - interval '9 days'),
  (null, array['online_harassment'],
   '[DEMO] Report filed over USSD from a feature phone. Impersonation account using my photograph.',
   'Marsabit', array['digital_security'], 'no_rush',
   'closed', 'verified', 'anonymous', 'ussd', false, false, now() - interval '21 days');


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  4. Publications for /resources and /newsletter                         ║
-- ╚════════════════════════════════════════════════════════════════════════╝

insert into public.resources (title, slug, description, kind, is_newsletter, file_url, edition_label, published_on, featured, published, sort_order)
select v.title, v.slug, v.description, v.kind, v.is_newsletter, v.file_url, v.edition, v.pub_on::date, v.featured, true, v.ord
from (values
  ('State of Women Human Rights Defenders in Kenya', 'state-of-whrds-kenya',
   'An annual review of the threats defenders face and the protection gaps that remain.',
   'Report', false, 'https://whrdhub.org/', null, '2026-03-08', false, 10),
  ('Digital Safety Toolkit for Defenders', 'digital-safety-toolkit',
   'Practical steps for locking down accounts, documenting abuse and preserving evidence.',
   'Toolkit', false, 'https://whrdhub.org/', null, '2026-01-20', false, 20),
  ('WHRD Hub Newsletter', 'newsletter-jan-jun-2026',
   'Six months of movement news, county network updates and defender stories.',
   'Newsletter', true, 'https://whrdhub.org/', 'January - June 2026', '2026-07-01', true, 1)
) as v(title, slug, description, kind, is_newsletter, file_url, edition, pub_on, featured, ord)
where not exists (select 1 from public.resources r where r.slug = v.slug);


-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  5. Online-listening sample signals                                     ║
-- ╚════════════════════════════════════════════════════════════════════════╝

insert into public.listening_results (source, source_id, permalink, author, content, matched_keywords, severity, status)
select v.source, v.source_id, v.permalink, v.author, v.content, v.kw, v.severity, 'new'
from (values
  ('facebook', 'demo-1', 'https://facebook.com/', 'Public page comment',
   'Threatening language directed at a named defender following a county assembly hearing.',
   array['threat'], 'medium'),
  ('facebook', 'demo-2', 'https://facebook.com/', 'Public page comment',
   'Coordinated harassment thread naming several women organisers.',
   array['harassment'], 'high')
) as v(source, source_id, permalink, author, content, kw, severity)
-- The unique index on (source, source_id) is partial, so ON CONFLICT cannot
-- target it without restating the predicate. A guard is clearer.
where not exists (
  select 1 from public.listening_results lr
   where lr.source = v.source and lr.source_id = v.source_id
);