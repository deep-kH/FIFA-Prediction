-- Update RLS policies to allow reading all answers if a global prop is settled early
-- or if the close date has passed.
-- Also restrict inserting/updating to only when it is not settled and before close date.

DROP POLICY IF EXISTS "Users insert/update own answers before close" ON public.global_prop_answers;
DROP POLICY IF EXISTS "Read all answers after close" ON public.global_prop_answers;

CREATE POLICY "Users insert/update own answers before close" ON public.global_prop_answers
    FOR ALL
    USING (
        auth.uid() = user_id AND 
        EXISTS (
            SELECT 1 FROM public.global_props gp 
            WHERE gp.id = global_prop_answers.prop_id 
            AND now() < gp.closes_at 
            AND gp.is_settled = false
        )
    );

CREATE POLICY "Read all answers after close" ON public.global_prop_answers
    FOR SELECT
    USING (
        auth.uid() IS NOT NULL AND 
        EXISTS (
            SELECT 1 FROM public.global_props gp 
            WHERE gp.id = global_prop_answers.prop_id 
            AND (now() >= gp.closes_at OR gp.is_settled = true)
        )
    );
