# Floralog AI Company

CrewAI workflows for evidence-based product and revenue decisions.

The project targets EUR 100 monthly gross revenue while preserving Floralog's core:
"Spielerisch Lernen und Entdecken, als Community".

## Team

The company structure is defined in code and does not require manual setup:

- KPI Analyst: diagnoses revenue and engagement from aggregate data only.
- Ethical Market Researcher: researches nature-interested outdoor gamers, location-based players, and adjacent audiences.
- UX and UI Designer: translates target-group insight into accessible, cozy interfaces and conversion experiments.
- Game Designer: develops ethical engagement, map-zone, social, and ecological-learning mechanics.
- Growth Analyst: connects product loops to acquisition, activation, retention, and referral strategies.
- Marketing Manager: prepares campaign, content, partnership, and outreach drafts without publishing or contacting anyone.
- Product Manager: reconciles the specialist proposals into a small, measurable product plan.
- Master Orchestrator: challenges the reasoning, applies the final brand gate, and produces the human-approval package.

The deterministic `RevenueGrowthFlow` runs these roles sequentially:

```text
KPI -> Market -> UX/UI + Game Design -> Growth -> Marketing -> Product Manager -> Master Orchestrator
```

Every implementation still requires explicit human approval. The crew has no social-media,
email, ad-spend, merge, deploy, or SQL tools. The Marketing Manager creates drafts only; those
external capabilities can be added later as separately approved tools with their own permissions.

## Phase 2 status

The payment ledger migration, PayPal capture recording, funnel tracking, and aggregate KPI Edge
Function are implemented. Production activation waits for the manual SQL and secret steps in
`../docs/AI_COMPANY_SETUP.md`.

## Local setup

```powershell
uv sync
uv run python -c "import crewai; import floralog_ai"
uv run pytest
```

Production credentials belong in environment variables or GitHub Secrets. Never add a
Supabase service-role key to this project.
