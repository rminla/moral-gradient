"""Secret handling: keys are read from env only, never logged. All text written to the
ledger passes through redact(), which strips any configured secret value that might be
echoed back in an error body."""
import os

SECRET_ENV = ("ANTHROPIC_API_KEY", "GROQ_API_KEY", "JEV_API_KEY", "OPENROUTER_API_KEY")


def get_key(name: str) -> str:
    v = os.environ.get(name, "")
    if not v:
        raise RuntimeError(f"missing env var {name}")
    return v


def redact(text):
    if text is None:
        return None
    s = text if isinstance(text, str) else str(text)
    for name in SECRET_ENV:
        v = os.environ.get(name)
        if v and len(v) >= 8 and v in s:
            s = s.replace(v, f"[REDACTED:{name}]")
    return s
