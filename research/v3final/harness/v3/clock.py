"""Model-agnostic run clock: active (monotonic) vs wall time, plus a pause heartbeat.

The box can be frozen (VM snapshot/suspend) while a run is in flight. CLOCK_MONOTONIC does not
advance while frozen; wall time does. Progress lines report both, and a daemon heartbeat logs any
pause it detects (wall jump >> monotonic jump). Timestamps use the box's local zone label.
"""
import threading, time
from datetime import datetime


def now_local(fmt="%H:%M"):
    d = datetime.now().astimezone()
    return f"{d.strftime(fmt)} {d.tzname()}"


class RunClock:
    def __init__(self, tag="", every=30.0, min_pause=60.0, out=print):
        self.tag, self.every, self.min_pause, self.out = tag, every, min_pause, out
        self.w0, self.m0 = time.time(), time.monotonic()
        self.pauses, self.paused_s = 0, 0.0
        self._stop = threading.Event(); self._lock = threading.Lock()
        self._w, self._m = self.w0, self.m0

    def check(self):
        """Compare wall vs monotonic since the last check; record a pause if wall ran ahead."""
        w, m = time.time(), time.monotonic()
        with self._lock:
            gap = (w - self._w) - (m - self._m); self._w, self._m = w, m
            if gap >= self.min_pause:
                self.pauses += 1; self.paused_s += gap
                self.out(f"  {self.tag}[pause] box was frozen ~{gap:.0f}s; resumed {now_local()}", flush=True)
            return gap

    def _loop(self):
        while not self._stop.wait(self.every): self.check()

    def start(self):
        threading.Thread(target=self._loop, daemon=True).start(); return self

    def stop(self):
        self._stop.set(); self.check()

    def active(self): return time.monotonic() - self.m0
    def wall(self): return time.time() - self.w0

    def summary(self):
        return f"active {self.active():.0f}s wall {self.wall():.0f}s pauses {self.pauses} ({self.paused_s:.0f}s)"
