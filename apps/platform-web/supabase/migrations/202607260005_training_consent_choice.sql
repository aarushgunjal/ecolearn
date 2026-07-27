-- Controls whether eligible feedback photos are allowed automatically or
-- whether the contributor is asked for each eligible photo.
alter table public.user_settings
  add column if not exists training_consent_mode text not null default 'ask_every_time'
  check (training_consent_mode in ('always_allow', 'ask_every_time'));

-- Preserve the intent of people who already explicitly enabled contributions.
update public.user_settings
set training_consent_mode = 'always_allow'
where training_consent_enabled = true
  and training_consent_mode = 'ask_every_time';
