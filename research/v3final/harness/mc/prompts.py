import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class Prompts:
    def __init__(self, version):
        self.version = version
        self.dir = ROOT / "prompts" / version
        self.scales = json.loads((self.dir / "scales.json").read_text())
        self._cache = {}

    def raw(self, name):
        if name not in self._cache:
            self._cache[name] = (self.dir / f"{name}.txt").read_text()
        return self._cache[name]

    def render(self, name, **kw):
        return self.raw(name).format(**kw).strip()

    def manifest(self):
        """sha256 of every prompt file: stored with each run so a changed prompt is detectable."""
        return {p.name: hashlib.sha256(p.read_bytes()).hexdigest()[:16] for p in sorted(self.dir.iterdir())}
