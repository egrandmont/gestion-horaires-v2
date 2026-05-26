CREATE TYPE "public"."age_convention" AS ENUM('year', 'tier');--> statement-breakpoint
CREATE TYPE "public"."constraint_scope" AS ENUM('tournament', 'category', 'team');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('M', 'F');--> statement-breakpoint
CREATE TYPE "public"."match_event_type" AS ENUM('goal', 'penalty', 'shutout', 'other');--> statement-breakpoint
CREATE TYPE "public"."match_phase" AS ENUM('preliminary', 'playoff');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('scheduled', 'in_progress', 'final', 'forfeit', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."prelim_type" AS ENUM('round_robin', 'pools');--> statement-breakpoint
CREATE TYPE "public"."rest_calculation_mode" AS ENUM('start_to_start', 'end_to_start');--> statement-breakpoint
CREATE TYPE "public"."time_slot_status" AS ENUM('open', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."tournament_status" AS ENUM('planning', 'active', 'completed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'organizer');--> statement-breakpoint
CREATE TABLE "arenas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bracket_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"template_id" uuid,
	"label" text NOT NULL,
	"resolution_rule" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bracket_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"structure" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"age_value" text NOT NULL,
	"age_convention" "age_convention" NOT NULL,
	"level" text,
	"gender" "gender",
	"display_label" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "constraints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"scope" "constraint_scope" DEFAULT 'tournament' NOT NULL,
	"scope_id" uuid,
	"type" text NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_hard" boolean DEFAULT true NOT NULL,
	"weight" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "formats" (
	"category_id" uuid PRIMARY KEY NOT NULL,
	"prelim_type" "prelim_type" DEFAULT 'round_robin' NOT NULL,
	"guaranteed_matches" integer DEFAULT 3 NOT NULL,
	"prelim_game_minutes" integer DEFAULT 60 NOT NULL,
	"prelim_resurface_minutes" integer DEFAULT 10 NOT NULL,
	"prelim_slot_minutes" integer DEFAULT 70 NOT NULL,
	"playoff_game_minutes" integer DEFAULT 60 NOT NULL,
	"playoff_resurface_minutes" integer DEFAULT 10 NOT NULL,
	"playoff_slot_minutes" integer DEFAULT 70 NOT NULL,
	"playoff_template_id" uuid,
	"settings" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "match_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"type" "match_event_type" DEFAULT 'other' NOT NULL,
	"team_id" uuid,
	"period" integer,
	"minute" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"pool_id" uuid,
	"phase" "match_phase" DEFAULT 'preliminary' NOT NULL,
	"surface_id" uuid,
	"slot_id" uuid,
	"game_minutes" integer DEFAULT 60 NOT NULL,
	"resurface_minutes" integer DEFAULT 10 NOT NULL,
	"slot_minutes" integer DEFAULT 70 NOT NULL,
	"home_team_id" uuid,
	"away_team_id" uuid,
	"home_position_id" uuid,
	"away_position_id" uuid,
	"bracket_node_label" text,
	"depends_on_match_ids" uuid[],
	"home_score" integer,
	"away_score" integer,
	"status" "match_status" DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "home_occupant_check" CHECK ((home_team_id IS NOT NULL AND home_position_id IS NULL) OR (home_team_id IS NULL AND home_position_id IS NOT NULL)),
	CONSTRAINT "away_occupant_check" CHECK ((away_team_id IS NOT NULL AND away_position_id IS NULL) OR (away_team_id IS NULL AND away_position_id IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "pool_memberships" (
	"pool_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	CONSTRAINT "pool_memberships_pool_id_team_id_pk" PRIMARY KEY("pool_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "pools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scorer_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"scope" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"token_hash" text NOT NULL,
	"label" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"last_used_at" timestamp,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "surfaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"arena_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"club" text,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tiebreak_rules" (
	"tournament_id" uuid PRIMARY KEY NOT NULL,
	"ordered_criteria" jsonb NOT NULL,
	"scoring" jsonb DEFAULT '{"win":2,"tie":1,"loss":0}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"surface_id" uuid NOT NULL,
	"date" date NOT NULL,
	"start_time" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"status" time_slot_status DEFAULT 'open' NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournament_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "user_role" DEFAULT 'organizer' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"timezone" text DEFAULT 'America/Montreal' NOT NULL,
	"status" "tournament_status" DEFAULT 'planning' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"rest_calculation_mode" "rest_calculation_mode" DEFAULT 'end_to_start' NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "arenas" ADD CONSTRAINT "arenas_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bracket_positions" ADD CONSTRAINT "bracket_positions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bracket_positions" ADD CONSTRAINT "bracket_positions_template_id_bracket_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."bracket_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "constraints" ADD CONSTRAINT "constraints_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formats" ADD CONSTRAINT "formats_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formats" ADD CONSTRAINT "formats_playoff_template_id_bracket_templates_id_fk" FOREIGN KEY ("playoff_template_id") REFERENCES "public"."bracket_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_pool_id_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_surface_id_surfaces_id_fk" FOREIGN KEY ("surface_id") REFERENCES "public"."surfaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_slot_id_time_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."time_slots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_home_team_id_teams_id_fk" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_away_team_id_teams_id_fk" FOREIGN KEY ("away_team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_home_position_id_bracket_positions_id_fk" FOREIGN KEY ("home_position_id") REFERENCES "public"."bracket_positions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_away_position_id_bracket_positions_id_fk" FOREIGN KEY ("away_position_id") REFERENCES "public"."bracket_positions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_memberships" ADD CONSTRAINT "pool_memberships_pool_id_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_memberships" ADD CONSTRAINT "pool_memberships_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pools" ADD CONSTRAINT "pools_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorer_tokens" ADD CONSTRAINT "scorer_tokens_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surfaces" ADD CONSTRAINT "surfaces_arena_id_arenas_id_fk" FOREIGN KEY ("arena_id") REFERENCES "public"."arenas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tiebreak_rules" ADD CONSTRAINT "tiebreak_rules_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_surface_id_surfaces_id_fk" FOREIGN KEY ("surface_id") REFERENCES "public"."surfaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_members" ADD CONSTRAINT "tournament_members_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "matches_surface_slot_unique" ON "matches" USING btree ("surface_id","slot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_member_user_unique" ON "tournament_members" USING btree ("tournament_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_single_owner_unique" ON "tournament_members" USING btree ("tournament_id") WHERE role = 'owner';