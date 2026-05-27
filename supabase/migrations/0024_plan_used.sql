-- Did the user's if-then plan help when this craving hit? Captured at log
-- time when the chosen trigger has an active plan. NULL means either no plan
-- existed for the trigger or the user wasn't asked (legacy rows).
alter table public.cravings
  add column plan_used text
    check (plan_used is null or plan_used in ('yes', 'no', 'unused'));
