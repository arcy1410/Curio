-- 005 — two new topics: Hollywood and Technology.
--
-- cards.topic_id is a foreign key to topics(id), so these rows must exist
-- before the pipeline can write a single card in either topic. Purely
-- additive: no existing topic, card, swipe or score is touched.
--
-- Note on the Bollywood "split": nothing moves. Every card currently filed
-- under bollywood is Indian cinema and stays there — the split is a NEW
-- bucket for non-Indian film, not a re-classification of what exists.
-- Re-tagging live cards would change what users see with no way to explain
-- why, and would break nothing that was actually wrong.
--
-- Apply in the Supabase SQL editor. Idempotent — safe to re-run.

insert into topics (id, name, parent_topic_id) values
  ('hollywood',  'Hollywood',  null),
  ('technology', 'Technology', null)
on conflict (id) do nothing;

insert into topics (id, name, parent_topic_id) values
  ('hollywood-blockbusters', 'Blockbusters', 'hollywood'),
  ('hollywood-oscars',       'Oscars',       'hollywood'),
  ('hollywood-craft',        'Craft',        'hollywood'),
  ('technology-ai',          'AI',           'technology'),
  ('technology-startups',    'Startups',     'technology'),
  ('technology-space',       'Space',        'technology')
on conflict (id) do nothing;
