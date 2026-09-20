import os

from crewai import Agent, Crew, Process, Task

from floralog_ai.schemas import RevenueReview

DEFAULT_MODEL = "openai/gpt-5-nano"


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
    product_strategist = Agent(
        role="Floralog Product Strategist",
        goal="Design small measurable experiments toward EUR 100 monthly gross revenue.",
        backstory="You preserve playful learning, discovery, and community while avoiding pay-to-win.",
        llm=model,
        allow_delegation=False,
        verbose=False,
    )
    brand_reviewer = Agent(
        role="Community and Brand Reviewer",
        goal="Return no more than three safe proposals with explicit success and stop metrics.",
        backstory="You are the final independent gate and require human approval for implementation.",
        llm=model,
        allow_delegation=False,
        verbose=False,
    )

    analyze = Task(
        description=(
            "Analyze the supplied KPI snapshot. Separate observations, uncertainties, and missing "
            "instrumentation. Do not infer personal behavior from small cohorts. Snapshot: {snapshot}"
        ),
        expected_output="A concise KPI diagnosis grounded only in the supplied aggregate values.",
        agent=kpi_analyst,
    )
    research = Task(
        description=(
            "Using the KPI diagnosis as context, assess ethical revenue paths: donations, voluntary "
            "membership, fair cosmetics, B2B education partnerships, and relevant sponsorship. "
            "Any external market claim must include a URL."
        ),
        expected_output="Evidence with sources, explicit assumptions, and suitable target groups.",
        agent=market_researcher,
        context=[analyze],
    )
    propose = Task(
        description=(
            "Create at most three small experiments. Core scanning, learning, discovery, and community "
            "access must stay free. Include revenue impact, community benefit, effort, risk, success "
            "metrics, stop metrics, and likely code surfaces."
        ),
        expected_output="At most three measurable, non-pay-to-win product experiments.",
        agent=product_strategist,
        context=[analyze, research],
    )
    review = Task(
        description=(
            "Review the proposals against Floralog's motto 'Spielerisch Lernen und Entdecken, als "
            "Community', the EUR 100 monthly gross revenue goal, and the EUR 25 monthly agent budget. "
            "Reject unsafe proposals and return the required structured review. Current monthly agent "
            "cost: {current_monthly_agent_cost_eur} EUR."
        ),
        expected_output="A structured RevenueReview that always requires human approval.",
        agent=brand_reviewer,
        context=[analyze, research, propose],
        output_pydantic=RevenueReview,
    )

    return Crew(
        agents=[kpi_analyst, market_researcher, product_strategist, brand_reviewer],
        tasks=[analyze, research, propose, review],
        process=Process.sequential,
        memory=False,
        cache=True,
        verbose=False,
    )
