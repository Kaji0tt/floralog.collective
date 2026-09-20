from floralog_ai.crews.revenue import build_revenue_crew


def test_revenue_crew_contains_cross_functional_product_cycle() -> None:
    crew = build_revenue_crew()

    assert len(crew.agents) == 8
    assert len(crew.tasks) == 8
    assert crew.tasks[-1].output_pydantic is not None
    assert crew.tasks[-1].agent.role == "Floralog Master Orchestrator"
