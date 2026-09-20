# Floralog AI Company

CrewAI workflows for evidence-based product and revenue decisions.

The project targets EUR 100 monthly gross revenue while preserving Floralog's core:
"Spielerisch Lernen und Entdecken, als Community".

## Local setup

```powershell
uv sync
uv run python -c "import crewai; import floralog_ai"
uv run pytest
```

Production credentials belong in environment variables or GitHub Secrets. Never add a
Supabase service-role key to this project.
