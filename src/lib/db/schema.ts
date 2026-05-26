import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  date,
  pgEnum,
  uniqueIndex,
  primaryKey,
  foreignKey,
  check,
  jsonb,
} from "drizzle-orm/pg-core";

// --- ENUMS ---

export const tournamentStatusEnum = pgEnum("tournament_status", ["planning", "active", "completed"]);
export const restCalculationModeEnum = pgEnum("rest_calculation_mode", ["start_to_start", "end_to_start"]);
export const userRoleEnum = pgEnum("user_role", ["owner", "organizer"]);
export const timeSlotStatusEnum = pgEnum("time_slot_status", ["open", "blocked"]);
export const ageConventionEnum = pgEnum("age_convention", ["year", "tier"]);
export const genderEnum = pgEnum("gender", ["M", "F"]);
export const prelimTypeEnum = pgEnum("prelim_type", ["round_robin", "pools"]);
export const matchPhaseEnum = pgEnum("match_phase", ["preliminary", "playoff"]);
export const matchStatusEnum = pgEnum("match_status", [
  "scheduled",
  "in_progress",
  "final",
  "forfeit",
  "cancelled",
]);
export const constraintScopeEnum = pgEnum("constraint_scope", ["tournament", "category", "team"]);
export const matchEventTypeEnum = pgEnum("match_event_type", [
  "goal",
  "penalty",
  "shutout",
  "other",
]);

// --- TABLES ---

// 1. Tournaments
export const tournaments = pgTable("tournaments", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  timezone: text("timezone").notNull().default("America/Montreal"),
  status: tournamentStatusEnum("status").notNull().default("planning"),
  settings: jsonb("settings").default({}),
  restCalculationMode: restCalculationModeEnum("rest_calculation_mode")
    .notNull()
    .default("end_to_start"),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 2. Tournament Members (Auth Clerk users mapping)
export const tournamentMembers = pgTable(
  "tournament_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(), // Clerk User ID
    role: userRoleEnum("role").notNull().default("organizer"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // Unique member per tournament
    uniqueIndex("tournament_member_user_unique").on(table.tournamentId, table.userId),
    // Only one owner per tournament (partial index)
    uniqueIndex("tournament_single_owner_unique")
      .on(table.tournamentId)
      .where(sql`role = 'owner'`),
  ]
);

// 3. Arenas
export const arenas = pgTable("arenas", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentId: uuid("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 4. Surfaces (Rinks)
export const surfaces = pgTable("surfaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  arenaId: uuid("arena_id")
    .notNull()
    .references(() => arenas.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 5. Time Slots (Calendars of availability)
export const timeSlots = pgTable("time_slots", {
  id: uuid("id").primaryKey().defaultRandom(),
  surfaceId: uuid("surface_id")
    .notNull()
    .references(() => surfaces.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  startTime: text("start_time").notNull(), // format HH:MM
  durationMinutes: integer("duration_minutes").notNull(),
  status: timeSlotStatusEnum("status").notNull().default("open"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 6. Categories
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentId: uuid("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  ageValue: text("age_value").notNull(), // M13, 2012, etc.
  ageConvention: ageConventionEnum("age_convention").notNull(), // year or tier
  level: text("level"), // D1, AAA, AA, A, etc. (nullable for custom levels or raw age only)
  gender: genderEnum("gender"), // M, F, null (null = mixte)
  displayLabel: text("display_label").notNull(), // constructed label "M13 AA"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 7. Bracket Templates
export const bracketTemplates = pgTable("bracket_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  structure: jsonb("structure").notNull(), // layout structure JSON
});

// 8. Formats
export const formats = pgTable("formats", {
  categoryId: uuid("category_id")
    .primaryKey()
    .references(() => categories.id, { onDelete: "cascade" }),
  prelimType: prelimTypeEnum("prelim_type").notNull().default("round_robin"),
  guaranteedMatches: integer("guaranteed_matches").notNull().default(3),
  
  // Three distinct durations
  prelimGameMinutes: integer("prelim_game_minutes").notNull().default(60),
  prelimResurfaceMinutes: integer("prelim_resurface_minutes").notNull().default(10),
  prelimSlotMinutes: integer("prelim_slot_minutes").notNull().default(70), // game + resurface
  
  playoffGameMinutes: integer("playoff_game_minutes").notNull().default(60),
  playoffResurfaceMinutes: integer("playoff_resurface_minutes").notNull().default(10),
  playoffSlotMinutes: integer("playoff_slot_minutes").notNull().default(70),
  
  playoffTemplateId: uuid("playoff_template_id").references(() => bracketTemplates.id),
  settings: jsonb("settings").default({}),
});

// 9. Teams
export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  club: text("club"),
  settings: jsonb("settings").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 10. Pools
export const pools = pgTable("pools", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // Pool A, Pool B, etc.
});

// 11. Pool Memberships
export const poolMemberships = pgTable(
  "pool_memberships",
  {
    poolId: uuid("pool_id")
      .notNull()
      .references(() => pools.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.poolId, table.teamId] }),
  ]
);

// 12. Constraints
export const constraints = pgTable("constraints", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentId: uuid("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  scope: constraintScopeEnum("scope").notNull().default("tournament"),
  scopeId: uuid("scope_id"), // category_id or team_id depending on scope
  type: text("type").notNull(), // e.g. "max_gap", "curfew", "arena_preference"
  params: jsonb("params").notNull().default({}), // flexible json schema
  isHard: boolean("is_hard").notNull().default(true),
  weight: integer("weight"), // null if hard constraint
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 13. Tiebreak Rules
export const tiebreakRules = pgTable("tiebreak_rules", {
  tournamentId: uuid("tournament_id")
    .primaryKey()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  orderedCriteria: jsonb("ordered_criteria").notNull(), // ordered array of criteria names
  scoring: jsonb("scoring").notNull().default({
    win: 2,
    tie: 1,
    loss: 0,
  }),
});

// 14. Bracket Positions (eliminatoires à trous)
export const bracketPositions = pgTable("bracket_positions", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  templateId: uuid("template_id")
    .references(() => bracketTemplates.id, { onDelete: "set null" }),
  label: text("label").notNull(), // e.g. "1st Pool A", "2nd Pool B"
  resolutionRule: jsonb("resolution_rule").notNull(), // rules on how to find the team from results
});

// 15. Matches
export const matches = pgTable(
  "matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    poolId: uuid("pool_id")
      .references(() => pools.id, { onDelete: "set null" }),
    phase: matchPhaseEnum("phase").notNull().default("preliminary"),
    
    // Physical placement (filled by solver)
    surfaceId: uuid("surface_id")
      .references(() => surfaces.id, { onDelete: "set null" }),
    slotId: uuid("slot_id")
      .references(() => timeSlots.id, { onDelete: "set null" }),
    
    // Time information copies for easy access/redundancy
    gameMinutes: integer("game_minutes").notNull().default(60),
    resurfaceMinutes: integer("resurface_minutes").notNull().default(10),
    slotMinutes: integer("slot_minutes").notNull().default(70),

    // Teams or placeholders
    homeTeamId: uuid("home_team_id")
      .references(() => teams.id, { onDelete: "cascade" }),
    awayTeamId: uuid("away_team_id")
      .references(() => teams.id, { onDelete: "cascade" }),
    
    homePositionId: uuid("home_position_id")
      .references(() => bracketPositions.id, { onDelete: "set null" }),
    awayPositionId: uuid("away_position_id")
      .references(() => bracketPositions.id, { onDelete: "set null" }),

    // Playoffs
    bracketNodeLabel: text("bracket_node_label"), // e.g. "QF1", "SF2"
    dependsOnMatchIds: uuid("depends_on_match_ids").array(), // match ids that must finish before this plays

    // Scores
    homeScore: integer("home_score"),
    awayScore: integer("away_score"),
    status: matchStatusEnum("status").notNull().default("scheduled"),
    
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // Unique slot assignment: a slot on a surface cannot have two matches
    uniqueIndex("matches_surface_slot_unique").on(table.surfaceId, table.slotId),
    
    // Check constraint: either homeTeamId OR homePositionId is set
    check(
      "home_occupant_check",
      sql`(home_team_id IS NOT NULL AND home_position_id IS NULL) OR (home_team_id IS NULL AND home_position_id IS NOT NULL)`
    ),
    
    // Check constraint: either awayTeamId OR awayPositionId is set
    check(
      "away_occupant_check",
      sql`(away_team_id IS NOT NULL AND away_position_id IS NULL) OR (away_team_id IS NULL AND away_position_id IS NOT NULL)`
    ),
  ]
);

// 16. Match Events
export const matchEvents = pgTable("match_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  type: matchEventTypeEnum("type").notNull().default("other"),
  teamId: uuid("team_id")
    .references(() => teams.id, { onDelete: "cascade" }),
  period: integer("period"),
  minute: integer("minute"),
  metadata: jsonb("metadata").notNull().default({}), // additional data (player, penalty type, etc.)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 17. Scorer Tokens (disposable write-only access tokens)
export const scorerTokens = pgTable("scorer_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentId: uuid("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  scope: jsonb("scope").notNull().default({}), // { surface_ids?: string[], category_ids?: string[] }
  tokenHash: text("token_hash").notNull(),
  label: text("label").notNull(), // label describing token usage, ex "Marqueur aréna Rosemère"
  expiresAt: timestamp("expires_at").notNull(),
  lastUsedAt: timestamp("last_used_at"),
  createdBy: text("created_by").notNull(), // Clerk user id who created this token
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
