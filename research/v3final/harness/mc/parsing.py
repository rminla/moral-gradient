import json
import re

ANS_RE = re.compile(r"ANSWER\s*[:：]\s*\**\s*\(?([A-Za-z]|\d+)\)?", re.I)


def last_answer(text):
    if not text:
        return None
    m = ANS_RE.findall(text)
    return m[-1] if m else None


def parse_likert(text, lo, hi):
    a = last_answer(text)
    if a is None or not a.isdigit():
        return None
    v = int(a)
    return v if lo <= v <= hi else None


def parse_choice(text, letters):
    a = last_answer(text)
    if a is None:
        return None
    a = a.upper()
    return a if a in letters else None


def first_json(text):
    if not text:
        return None
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M)
    depth, start = 0, None
    for i, ch in enumerate(text):
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}" and depth:
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(text[start:i + 1])
                except json.JSONDecodeError:
                    start = None
    return None
