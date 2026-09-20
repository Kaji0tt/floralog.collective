import os

from crewai import Agent, Crew, Process, Task

from floralog_ai.schemas import RevenueReview

DEFAULT_MODEL = "openai/gpt-5-mini"


def build_revenue_crew() -> Crew:
    model = os.getenv("FLORALOG_AI_MODEL", DEFAULT_MODEL)

    kpi_analyst = Agent(
        role="Floralog KPI Analyst",
        goal="Find revenue and engagement bottlenecks using only the supplied aggregates.",
        backstory="You distinguish measured facts from assumptions and never request personal data.",
        llm=model,
        allow_delegation=False,
        verbose=False,
    )
    market_researcher = Agent(
        role="Ethical Market Researcher",
        goal="Identify evidence-backed demand among nature learners, communities, and partners.",
        backstory="You cite sources and reject manipulative monetization, especially toward minors.",
        llm=model,
        allow_delegation=False,
        verbose=False,
    )
    ux_designer = Agent(
        role="Floralog UX and UI Designer",
        goal="Translate target-group insight into accessible, cozy, conversion-aware product experiences.",
        backstory=(
            "You design calm, discoverable interfaces for nature learners. You improve voluntary support "
            "conversion without dark patterns, coercion, or paywalling core play."
        ),
        llm=model,
        allow_delegation=False,
        verbose=False,
    )
    game_designer = Agent(
        role="Floralog Game Designer",
        goal="Strengthen engagement, community, ecological learning, and discovery through ethical game mechanics.",
        backstory=(
            "You know proven game-design patterns and adapt them to Floralog's map zones, exploration, "
            "cozy adventure, social play, curiosity, and real-world ecological learning."
        ),
        llm=model,
        allow_delegation=False,
        verbose=False,
    )
    growth_analyst = Agent(
        role="Floralog Growth Analyst",
        goal="Turn product and game opportunities into measurable growth strategies and acquisition experiments.",
        backstory=(
            "You connect KPIs, target groups, product loops, referrals, retention, and ethical distribution. "
            "You distinguish growth hypotheses from proven results."
        ),
        llm=model,
        allow_delegation=False,
        verbose=False,
    )
    marketing_manager = Agent(
        role="Floralog Marketing Manager",
        goal="Create coordinated campaign concepts, content plans, partnership outreach, and channel experiments.",
        backstory=(
            "You turn approved product and growth strategy into drafts for social posts, ads, newsletters, "
            "and partner emails. You never publish, contact people, or spend money without explicit approval."
        ),
        llm=model,
        allow_delegation=False,
        verbose=False,
    )
    product_manager = Agent(
        role="Floralog Product Manager",
        goal="Unify UX, game design, growth, and marketing into an achievable product roadmap toward sustainability.",
        backstory=(
            "You resolve trade-offs between revenue, effort, retention, community health, and the cozy "
            "exploration identity. You prioritize small reversible experiments."
        ),
        llm=model,
        allow_delegation=False,
        verbose=False,
    )
    master_orchestrator = Agent(
        role="Floralog Master Orchestrator",
        goal="Challenge the team's reasoning and produce the final evidence-based human approval package.",
        backstory=(
            "You act as the founder's strategic interface. You reconcile conflicting specialist advice, "
            "surface missing evidence, preserve the product spirit, and never take external action yourself."
        ),
        llm=model,
        allow_delegation=False,
        verbose=False,
    )

    analyze = Task(
        description=(
            "Analyze the supplied KPIAdmin aggregate snapshot, which is the authoritative data contract "
            "for this review. Separate observations, uncertainties, and missing instrumentation. Do not "
            "infer personal behavior from small cohorts. Never replace supplied values with assumptions. "
            "Snapshot: {snapshot}"
        ),
        expected_output="A concise KPI diagnosis grounded only in the supplied aggregate values.",
        agent=kpi_analyst,
    )
    research = Task(
        description=(
            "Using the KPIAdmin-backed KPI diagnosis as context, assess ethical revenue paths: donations, voluntary "
            "membership, fair cosmetics, B2B education partnerships, and relevant sponsorship. "
            "Any external market claim must include a URL."
        ),
        expected_output="Evidence with sources, explicit assumptions, and suitable target groups.",
        agent=market_researcher,
        context=[analyze],
    )
    ux_design = Task(
        description=(
            "Using the market diagnosis and the KPIAdmin navigation_event_counts map, define UX/UI principles "
            "and one or more interface experiments "
            "for the relevant target groups. Cover onboarding, discovery, voluntary support conversion, "
            "accessibility, and dark-pattern risks. Do not write code or publish designs."
        ),
        expected_output="A target-group-specific UX/UI strategy with measurable hypotheses and code surfaces.",
        agent=ux_designer,
        context=[analyze, research],
    )
    game_design = Task(
        description=(
            "Using the KPIAdmin engagement and navigation data plus the market diagnosis, propose ethical "
            "game-mechanic improvements for cozy "
            "exploration, map geo-zones, social/community play, and ecological learning. Explain the "
            "player loop, likely player types, retention effect, and anti-exploitation safeguards."
        ),
        expected_output="A game-design strategy connected to Floralog's map and learning systems.",
        agent=game_designer,
        context=[analyze, research],
    )
    growth = Task(
        description=(
            "Build a measurable growth strategy from the KPIAdmin-backed KPI diagnosis, including DAU/WAU/MAU, "
            "stickiness, action_events_30d, and navigation_event_counts, plus market research and UX direction, "
            "and game-design opportunities. Cover acquisition, activation, retention, referrals, and "
            "community loops. Identify one small growth experiment and its stop criteria."
        ),
        expected_output="A KPI-linked growth plan with ethical acquisition and retention experiments.",
        agent=growth_analyst,
        context=[analyze, research, ux_design, game_design],
    )
    marketing = Task(
        description=(
            "Turn the approved-direction concepts into draft marketing work: channel strategy, content "
            "calendar ideas, social/ad concepts, and partnership or email outreach drafts. Mark every "
            "claim requiring evidence. Do not publish, send, contact, or spend."
        ),
        expected_output="A reviewable marketing plan and drafts with explicit approval boundaries.",
        agent=marketing_manager,
        context=[research, ux_design, game_design, growth],
    )
    product_plan = Task(
        description=(
            "Act as Product Manager. Reconcile UX, game design, growth, and marketing into at most three "
            "small product experiments. Connect revenue and cost coverage with cozy adventure, discovery, "
            "curiosity, community, and ecological learning. Include revenue impact, effort, risk, success "
            "metrics, stop metrics, and likely code surfaces."
        ),
        expected_output="A prioritized product plan containing at most three measurable experiments.",
        agent=product_manager,
        context=[analyze, research, ux_design, game_design, growth, marketing],
    )
    review = Task(
        description=(
            "Act as Master Orchestrator and final Community/Brand gate. Challenge contradictions, identify "
            "missing evidence, and review the Product Manager plan against Floralog's motto 'Spielerisch "
            "Lernen und Entdecken, als Community', the EUR 100 monthly gross revenue goal, and the EUR 25 "
            "monthly agent budget. Reject unsafe proposals and return the required structured review. "
            "Current monthly agent cost: {current_monthly_agent_cost_eur} EUR. Human approval is mandatory."
        ),
        expected_output="A structured RevenueReview that always requires human approval.",
        agent=master_orchestrator,
        context=[analyze, research, ux_design, game_design, growth, marketing, product_plan],
        output_pydantic=RevenueReview,
    )

    return Crew(
        agents=[
            kpi_analyst,
            market_researcher,
            ux_designer,
            game_designer,
            growth_analyst,
            marketing_manager,
            product_manager,
            master_orchestrator,
        ],
        tasks=[analyze, research, ux_design, game_design, growth, marketing, product_plan, review],
        process=Process.sequential,
        memory=False,
        cache=True,
        verbose=False,
    )
