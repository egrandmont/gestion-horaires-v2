-- 1. Configuration du schéma auth et helper user_id() pour extraire l'id Clerk du JWT
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.user_id() RETURNS text AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')
  )::text;
$$ LANGUAGE sql STABLE;

-- 2. Fonctions helpers de sécurité pour les politiques
CREATE OR REPLACE FUNCTION public.is_tournament_owner(tid uuid) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tournament_members
    WHERE tournament_id = tid
      AND user_id = auth.user_id()
      AND role = 'owner'
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_tournament_member(tid uuid) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tournament_members
    WHERE tournament_id = tid
      AND user_id = auth.user_id()
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 3. Activation de la RLS sur toutes les tables

ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arenas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surfaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.constraints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiebreak_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bracket_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bracket_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scorer_tokens ENABLE ROW LEVEL SECURITY;

-- 4. Définition des politiques RLS

-- Tournaments
CREATE POLICY select_tournaments ON public.tournaments FOR SELECT 
  USING (is_public = true OR public.is_tournament_member(id));

CREATE POLICY insert_tournaments ON public.tournaments FOR INSERT 
  WITH CHECK (auth.user_id() IS NOT NULL);

CREATE POLICY update_tournaments ON public.tournaments FOR UPDATE 
  USING (public.is_tournament_member(id));

CREATE POLICY delete_tournaments ON public.tournaments FOR DELETE 
  USING (public.is_tournament_owner(id));

-- Tournament Members
CREATE POLICY select_members ON public.tournament_members FOR SELECT 
  USING (public.is_tournament_member(tournament_id));

CREATE POLICY insert_members ON public.tournament_members FOR INSERT 
  WITH CHECK (
    public.is_tournament_owner(tournament_id) 
    OR auth.user_id() = user_id 
    OR NOT EXISTS (SELECT 1 FROM public.tournament_members WHERE tournament_id = tournament_id)
  );

CREATE POLICY update_members ON public.tournament_members FOR UPDATE 
  USING (public.is_tournament_owner(tournament_id));

CREATE POLICY delete_members ON public.tournament_members FOR DELETE 
  USING (public.is_tournament_owner(tournament_id) AND auth.user_id() <> user_id);

-- Arenas
CREATE POLICY select_arenas ON public.arenas FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.tournaments WHERE id = tournament_id AND (is_public = true OR public.is_tournament_member(id))));

CREATE POLICY modify_arenas ON public.arenas FOR ALL 
  USING (public.is_tournament_member(tournament_id));

-- Surfaces
CREATE POLICY select_surfaces ON public.surfaces FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.arenas a JOIN public.tournaments t ON t.id = a.tournament_id WHERE a.id = arena_id AND (t.is_public = true OR public.is_tournament_member(t.id))));

CREATE POLICY modify_surfaces ON public.surfaces FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.arenas WHERE id = arena_id AND public.is_tournament_member(tournament_id)));

-- Time Slots
CREATE POLICY select_time_slots ON public.time_slots FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.surfaces s JOIN public.arenas a ON a.id = s.arena_id JOIN public.tournaments t ON t.id = a.tournament_id WHERE s.id = surface_id AND (t.is_public = true OR public.is_tournament_member(t.id))));

CREATE POLICY modify_time_slots ON public.time_slots FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.surfaces s JOIN public.arenas a ON a.id = s.arena_id WHERE s.id = surface_id AND public.is_tournament_member(a.tournament_id)));

-- Categories
CREATE POLICY select_categories ON public.categories FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.tournaments WHERE id = tournament_id AND (is_public = true OR public.is_tournament_member(id))));

CREATE POLICY modify_categories ON public.categories FOR ALL 
  USING (public.is_tournament_member(tournament_id));

-- Teams
CREATE POLICY select_teams ON public.teams FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.categories c JOIN public.tournaments t ON t.id = c.tournament_id WHERE c.id = category_id AND (t.is_public = true OR public.is_tournament_member(t.id))));

CREATE POLICY modify_teams ON public.teams FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.categories WHERE id = category_id AND public.is_tournament_member(tournament_id)));

-- Pools
CREATE POLICY select_pools ON public.pools FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.categories c JOIN public.tournaments t ON t.id = c.tournament_id WHERE c.id = category_id AND (t.is_public = true OR public.is_tournament_member(t.id))));

CREATE POLICY modify_pools ON public.pools FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.categories WHERE id = category_id AND public.is_tournament_member(tournament_id)));

-- Pool Memberships
CREATE POLICY select_pool_memberships ON public.pool_memberships FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.pools p JOIN public.categories c ON c.id = p.category_id JOIN public.tournaments t ON t.id = c.tournament_id WHERE p.id = pool_id AND (t.is_public = true OR public.is_tournament_member(t.id))));

CREATE POLICY modify_pool_memberships ON public.pool_memberships FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.pools p JOIN public.categories c ON c.id = p.category_id WHERE p.id = pool_id AND public.is_tournament_member(c.tournament_id)));

-- Formats
CREATE POLICY select_formats ON public.formats FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.categories c JOIN public.tournaments t ON t.id = c.tournament_id WHERE c.id = category_id AND (t.is_public = true OR public.is_tournament_member(t.id))));

CREATE POLICY modify_formats ON public.formats FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.categories WHERE id = category_id AND public.is_tournament_member(tournament_id)));

-- Constraints
CREATE POLICY select_constraints ON public.constraints FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.tournaments WHERE id = tournament_id AND (is_public = true OR public.is_tournament_member(id))));

CREATE POLICY modify_constraints ON public.constraints FOR ALL 
  USING (public.is_tournament_member(tournament_id));

-- Tiebreak Rules
CREATE POLICY select_tiebreak_rules ON public.tiebreak_rules FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.tournaments WHERE id = tournament_id AND (is_public = true OR public.is_tournament_member(id))));

CREATE POLICY modify_tiebreak_rules ON public.tiebreak_rules FOR ALL 
  USING (public.is_tournament_member(tournament_id));

-- Bracket Templates
CREATE POLICY select_bracket_templates ON public.bracket_templates FOR SELECT 
  USING (true);

-- Bracket Positions
CREATE POLICY select_bracket_positions ON public.bracket_positions FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.categories c JOIN public.tournaments t ON t.id = c.tournament_id WHERE c.id = category_id AND (t.is_public = true OR public.is_tournament_member(t.id))));

CREATE POLICY modify_bracket_positions ON public.bracket_positions FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.categories WHERE id = category_id AND public.is_tournament_member(tournament_id)));

-- Matches
CREATE POLICY select_matches ON public.matches FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.categories c JOIN public.tournaments t ON t.id = c.tournament_id WHERE c.id = category_id AND (t.is_public = true OR public.is_tournament_member(t.id))));

CREATE POLICY modify_matches ON public.matches FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.categories WHERE id = category_id AND public.is_tournament_member(tournament_id)));

-- Match Events
CREATE POLICY select_match_events ON public.match_events FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.matches m JOIN public.categories c ON c.id = m.category_id JOIN public.tournaments t ON t.id = c.tournament_id WHERE m.id = match_id AND (t.is_public = true OR public.is_tournament_member(t.id))));

CREATE POLICY modify_match_events ON public.match_events FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.matches m JOIN public.categories c ON c.id = m.category_id WHERE m.id = match_id AND public.is_tournament_member(c.tournament_id)));

-- Scorer Tokens
CREATE POLICY select_scorer_tokens ON public.scorer_tokens FOR SELECT 
  USING (public.is_tournament_member(tournament_id));

CREATE POLICY modify_scorer_tokens ON public.scorer_tokens FOR ALL 
  USING (public.is_tournament_member(tournament_id));
