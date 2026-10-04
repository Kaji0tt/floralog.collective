import os

from crewai import Agent, Crew, Process, Task

from floralog_ai.schemas import PartnerPlan, ReachPlan

DEFAULT_MODEL = "openai/gpt-5-mini"


def build_reach_manager() -> Agent:
    return Agent(
        role="Floralog Reach Manager",
        goal=(
            "Reach more nature-interested outdoor gamers by publishing a small number of authentic, "
            "data-backed social posts, learning from their measured performance, and finding "
            "fitting partners for the community."
        ),
        backstory=(
            "You run Floralog's presence on Instagram, Pinterest, Bluesky and Mastodon. Floralog is "
            "a game first: players explore, scan and collect real plants, conquer map zones in "
            "Season 2, complete quests and discover nature together; learning is a joyful "
            "consequence of play. You write warm, curious, playful German posts that invite people "
            "outside. You only use facts from the supplied game data, never ask for money, never "
            "contact people yourself, and prefer skipping a post over publishing something weak."
        ),
        llm=os.getenv("FLORALOG_AI_MODEL", DEFAULT_MODEL),
        allow_delegation=False,
        verbose=False,
    )


def build_reach_crew() -> Crew:
    reach_manager = build_reach_manager()
    plan = Task(
        description=(
            "1. Evaluate the account performance and recent posts below per platform. Compare "
            "content pillars, headlines, tone and formats by engagement (likes, comments, shares, "
            "saves, link clicks) and reach where available, plus follower development. Distinguish "
            "measured patterns from guesses; with few posts, say so.\n"
            "2. Decide whether posting is worthwhile today. Create at most one post per available "
            "platform, or none if the game data offers nothing fresh. Adapt each post to its "
            "platform instead of copying one text.\n"
            "3. Build each post from the game data snapshot. Pillars: plant_spotlight, "
            "scan_of_the_week, quest_invite, community_milestone, fun_fact.\n"
            "4. Name one small next experiment.\n\n"
            "Platform rules:\n"
            "- instagram: headline (max 60 chars) is printed on the first carousel slide; data "
            "slides are added automatically. Caption body max 900 chars, may use line breaks and "
            "a question to invite comments. Up to 5 hashtags.\n"
            "- pinterest: headline becomes the pin title and is printed on the image; body max "
            "380 chars, search-friendly wording (plant names, 'Pflanzen bestimmen', 'Natur "
            "entdecken'). Up to 5 hashtags.\n"
            "- bluesky: body max 200 chars, max 3 hashtags, no headline needed.\n"
            "- mastodon: body max 380 chars, max 3 hashtags, no headline needed.\n\n"
            "General rules (enforced automatically, violations are discarded):\n"
            "- German, friendly, game-first, invites people to explore outside.\n"
            "- No links, URLs, domains, @mentions, or e-mail addresses; links are added "
            "automatically.\n"
            "- Hashtags without '#', letters/digits/underscore only.\n"
            "- Every number must come from the snapshot. Never invent statistics.\n"
            "- No donations, purchases, currencies, urgency, or pressure.\n"
            "- Do not repeat recent posts.\n\n"
            "Available platforms: {platforms}\n"
            "Account performance (last 14 days): {performance}\n"
            "Recent posts: {recent_posts}\n"
            "Game data snapshot: {content_snapshot}"
        ),
        expected_output="A structured ReachPlan with evaluation, learnings, next experiment and posts.",
        agent=reach_manager,
        output_pydantic=ReachPlan,
    )

    return Crew(
        agents=[reach_manager],
        tasks=[plan],
        process=Process.sequential,
        memory=False,
        cache=True,
        verbose=False,
    )


def build_partner_crew() -> Crew:
    reach_manager = build_reach_manager()
    scouting = Task(
        description=(
            "Review the public profiles below, found via Instagram, Bluesky and Mastodon. Select "
            "at most 10 that fit Floralog as partners: nature conservation associations (e.g. "
            "local NABU or BUND groups), clubs, environmental education, botanical gardens, and "
            "small nature or plant creators in German-speaking regions.\n"
            "For each recommendation give a fit score (1-10), the partner type, why it fits, a "
            "concrete joint idea (e.g. a shared quest, a community event, a plant walk), and a "
            "short, personal, honest first message in German that a human will review and send. "
            "The message must say that Floralog is a small indie game and must not promise money. "
            "Ignore companies selling unrelated products, political accounts, and profiles that "
            "look like private individuals without a public nature focus.\n"
            "Also suggest up to 8 German search terms for next week's scouting.\n\n"
            "Candidates: {candidates}"
        ),
        expected_output="A structured PartnerPlan. Nobody is contacted automatically.",
        agent=reach_manager,
        output_pydantic=PartnerPlan,
    )
    return Crew(
        agents=[reach_manager],
        tasks=[scouting],
        process=Process.sequential,
        memory=False,
        cache=True,
        verbose=False,
    )
