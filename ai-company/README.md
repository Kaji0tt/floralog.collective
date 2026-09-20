# Floralog AI Company

CrewAI workflows for evidence-based product and revenue decisions.

The project targets EUR 100 monthly gross revenue while preserving Floralog's core:
"Spielerisch Lernen und Entdecken, als Community".

## Team

The company structure is defined in code and does not require manual setup:

- KPI Analyst: diagnoses revenue and engagement from aggregate data only.
- Ethical Market Researcher: researches target groups and requires sources.
- Product Strategist: proposes small experiments toward EUR 100 monthly revenue.
- Community and Brand Reviewer: rejects pay-to-win and protects Floralog's core.

The deterministic `RevenueGrowthFlow` coordinates these roles. Every implementation still
requires explicit human approval; the crew cannot merge, deploy, or execute SQL.

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
