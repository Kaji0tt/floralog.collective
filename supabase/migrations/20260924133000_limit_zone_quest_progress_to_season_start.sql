-- Zone quest progress starts with the autumn 2026 season on September 21.
DELETE FROM public."RobotPlantZoneCompletion"
WHERE completed_at < timestamptz '2026-09-21 00:00:00+00';

WITH quest_progress AS (
	SELECT
		user_quest.id AS user_quest_id,
		quest.required_discoveries,
		count(completion.id)::integer AS progress
	FROM public."UserQuest" user_quest
	JOIN public."Quest" quest ON quest.id = user_quest.quest_id
	LEFT JOIN public."RobotPlantZoneCompletion" completion
		ON completion.auth_id = user_quest.auth_id
		AND completion.completed_at >= timestamptz '2026-09-21 00:00:00+00'
	WHERE quest.requires_zone_completion = true
		AND user_quest.status <> 'redeemed'
	GROUP BY user_quest.id, quest.required_discoveries
)
UPDATE public."UserQuest" user_quest
SET
	progress = quest_progress.progress::text,
	completed = quest_progress.progress >= quest_progress.required_discoveries,
	status = CASE
		WHEN quest_progress.progress >= quest_progress.required_discoveries THEN 'completed'
		ELSE 'active'
	END,
	completed_date = CASE
		WHEN quest_progress.progress >= quest_progress.required_discoveries THEN user_quest.completed_date
		ELSE NULL
	END,
	completed_at = CASE
		WHEN quest_progress.progress >= quest_progress.required_discoveries THEN user_quest.completed_at
		ELSE NULL
	END,
	updated_at = now()
FROM quest_progress
WHERE user_quest.id = quest_progress.user_quest_id;

NOTIFY pgrst, 'reload schema';