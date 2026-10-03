-- Append the next six lessons without changing existing IDs or progress.
begin;

insert into public.lessons (
  id, slug, title, topic, description, duration_minutes, xp_reward, sort_order, is_published
) values
  ('10000000-0000-4000-8000-000000000007', 'use-less-reuse-more', 'Use less, reuse more', 'Reuse', 'Prevent waste before it reaches the bin.', 4, 25, 7, true),
  ('10000000-0000-4000-8000-000000000008', 'water-wise-habits', 'Water-wise habits', 'Water', 'Use the water you need without leaving it running.', 4, 25, 8, true),
  ('10000000-0000-4000-8000-000000000009', 'everyday-energy', 'Everyday energy', 'Energy', 'Spot simple ways to avoid wasting electricity.', 4, 25, 9, true),
  ('10000000-0000-4000-8000-000000000010', 'food-worth-saving', 'Food worth saving', 'Food waste', 'Plan portions and ask for help saving leftovers.', 4, 25, 10, true),
  ('10000000-0000-4000-8000-000000000011', 'paper-with-a-purpose', 'Paper with a purpose', 'Resources', 'Make the most of paper before recycling it.', 4, 25, 11, true),
  ('10000000-0000-4000-8000-000000000012', 'good-neighbors-to-nature', 'Good neighbors to nature', 'Nature', 'Explore outdoors while respecting plants and wildlife.', 4, 25, 12, true)
on conflict (id) do update set
  slug = excluded.slug,
  title = excluded.title,
  topic = excluded.topic,
  description = excluded.description,
  duration_minutes = excluded.duration_minutes,
  xp_reward = excluded.xp_reward,
  sort_order = excluded.sort_order,
  is_published = excluded.is_published;

insert into public.lesson_answer_keys (lesson_id, correct_answer) values
  ('10000000-0000-4000-8000-000000000007', 0),
  ('10000000-0000-4000-8000-000000000008', 2),
  ('10000000-0000-4000-8000-000000000009', 1),
  ('10000000-0000-4000-8000-000000000010', 2),
  ('10000000-0000-4000-8000-000000000011', 0),
  ('10000000-0000-4000-8000-000000000012', 1)
on conflict (lesson_id) do update set correct_answer = excluded.correct_answer;

commit;
