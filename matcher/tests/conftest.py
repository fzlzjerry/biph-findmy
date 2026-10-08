from datetime import datetime, timedelta, timezone

import pytest

from matcher import Matcher
from matcher.embed import load_embedder

NOW = datetime(2026, 10, 8, 8, 0, tzinfo=timezone.utc)


@pytest.fixture(scope="session")
def tfidf_matcher() -> Matcher:
    return Matcher(backend="tfidf")


@pytest.fixture(scope="session")
def onnx_matcher() -> Matcher:
    if load_embedder() is None:
        pytest.skip("embedding model not downloaded (run scripts/fetch_model.py)")
    return Matcher(backend="onnx")


@pytest.fixture(params=["tfidf", "onnx"], scope="session")
def any_matcher(request) -> Matcher:
    if request.param == "onnx" and load_embedder() is None:
        pytest.skip("embedding model not downloaded")
    return Matcher(backend=request.param)


def ago(days: float = 0, hours: float = 0) -> datetime:
    return NOW - timedelta(days=days, hours=hours)
