import pytest
from pydantic import ValidationError

from floralog_ai.schemas import KpiSnapshot
from floralog_ai.snapshot_client import fetch_snapshot


def test_snapshot_rejects_personal_data() -> None:
    payload = {
        "generated_at": "2026-09-20T00:00:00Z",
        "revenue_mtd_eur": 0,
        "revenue_30d_eur": 0,
        "transaction_count_30d": 0,
        "donation_page_views_30d": 0,
        "donation_orders_30d": 0,
        "donation_captures_30d": 0,
        "dau": 0,
        "wau": 0,
        "mau": 0,
        "referrals_completed_30d": 0,
        "community_actions_30d": 0,
        "email": "must-not-pass@example.com",
    }
    with pytest.raises(ValidationError, match="email"):
        KpiSnapshot.model_validate(payload)


def test_snapshot_client_requires_https() -> None:
    with pytest.raises(ValueError, match="HTTPS"):
        fetch_snapshot("http://localhost/kpis", "secret")
