"""
Versioned quiz response parser v2.

CHANGES FROM v1:
- Handle clear leading standalone A/B + whitespace/explanation
- Handle markdown bold **A** or **B**
- NEVER match letters inside 'refusal', 'both', 'cannot' words
- 'cannot' text elsewhere NOT automatically refusal if clear answer chosen
- Contradictory/multiple choices → conservative invalid
- Model-independent rules, no selective mapping

PRESERVED FROM v1:
- Same canonical option order mapping
- Refusal detection patterns
- Conservative parsing (when uncertain → invalid)
"""

import re
from typing import Optional, Tuple


def parse_response_v2(response_text: str) -> Tuple[Optional[str], str]:
    """
    Parse model response to extract choice (A or B).
    
    VERSION 2 changes:
    - More robust handling of leading letters with explanations
    - Better refusal vs answer distinction
    - Markdown bold support
    - Conservative handling of contradictions
    
    Args:
        response_text: Raw model response text
    
    Returns:
        Tuple of (letter_choice, reason):
        - letter_choice: 'A', 'B', or None
        - reason: Parsing decision reason for audit
    """
    text = response_text.strip()
    
    if not text:
        return None, "empty_response"
    
    # Stage 1: Check for MULTIPLE conflicting choices (conservative invalid)
    # Count distinct A and B mentions in first 3 lines
    first_lines = '\n'.join(text.split('\n')[:3])
    
    # Look for explicit contradictions: "A ... but actually B" or "both A and B"
    if re.search(r'\b(?:both\s+[AB]\s+and\s+[AB]|[AB]\s+(?:and|but|however)\s+[AB])\b', 
                 first_lines, re.IGNORECASE):
        return None, "invalid_multiple_choices"
    
    # Stage 2: Detect EXPLICIT refusals (must be standalone, not inside words)
    # These are HARD refusals - no answer follows
    hard_refusal_patterns = [
        r"^I(?:'m| am)\s+(?:not|unable to)\s+(?:able|comfortable|willing)",
        r"^I\s+(?:refuse|decline|can't|cannot)\s+to",
        r"^(?:This|It)\s+(?:is|would be)\s+(?:not appropriate|unethical|impossible)",
    ]
    
    for pattern in hard_refusal_patterns:
        if re.search(pattern, text, re.IGNORECASE | re.MULTILINE):
            # BUT check if there's a clear choice BEFORE the refusal text
            # (some models say "B - I cannot recommend A because...")
            leading_choice = extract_leading_choice(text)
            if leading_choice:
                return leading_choice, "answer_despite_refusal_language"
            return None, "refusal_explicit"
    
    # Stage 3: Try to extract clear leading choice
    leading = extract_leading_choice(text)
    if leading:
        # Verify it's not contradicted later
        rest_of_text = text[20:]  # Skip first 20 chars (the leading choice)
        if re.search(r'\b(?:actually|instead|rather)\s+' + ('B' if leading == 'A' else 'A') + r'\b',
                     rest_of_text, re.IGNORECASE):
            return None, "invalid_contradiction"
        
        # Check for "cannot" in explanation BUT with clear answer chosen
        # "B - I cannot recommend A because..." is valid (answer is B)
        if 'cannot' in text.lower():
            return leading, "answer_with_cannot_in_explanation"
        
        return leading, "leading_choice_clear"
    
    # Stage 4: Look for choice patterns in first few lines
    choice_patterns = [
        # **A** or **B** (markdown bold)
        (r'\*\*([AB])\*\*', "markdown_bold"),
        # **A)** or **B)** (markdown bold with paren)
        (r'\*\*([AB])\)', "markdown_bold_paren"),
        # **A.** or **B.** (markdown bold with period)
        (r'\*\*([AB])\.\*\*', "markdown_bold_period"),
        # "A)" or "B)" at line start
        (r'^([AB])\)', "letter_paren_linestart"),
        # "choose A" or "option B" etc
        (r'\b(?:choose|option|select|pick|answer(?:\s+is)?)\s*:?\s*([AB])\b', "explicit_choice_keyword"),
    ]
    
    for pattern, reason_suffix in choice_patterns:
        match = re.search(pattern, first_lines, re.IGNORECASE | re.MULTILINE)
        if match:
            choice = match.group(1).upper()
            # Verify no contradiction
            if not has_contradiction(text, choice):
                return choice, f"pattern_{reason_suffix}"
    
    # Stage 5: Soft refusal detection (words that MIGHT indicate refusal)
    # Only trigger if NO clear choice was found above
    soft_refusal_keywords = [
        'cannot provide',
        'cannot give',
        'cannot make a choice',
        'unable to choose',
        'don\'t feel comfortable',
        'would not be appropriate'
    ]
    
    text_lower = text.lower()
    for keyword in soft_refusal_keywords:
        if keyword in text_lower:
            return None, "refusal_soft_keyword"
    
    # Stage 6: Last resort - check for standalone letter
    # But very strict - only if truly isolated
    if re.match(r'^[Aa][\s\.\)\,\:]', text):
        return 'A', "standalone_letter_strict"
    if re.match(r'^[Bb][\s\.\)\,\:]', text):
        return 'B', "standalone_letter_strict"
    
    # Failed to parse
    return None, "unparseable_no_clear_pattern"


def extract_leading_choice(text: str) -> Optional[str]:
    """
    Extract clear leading choice from start of text.
    
    Handles:
    - "A" alone
    - "A\n\nExplanation"
    - "A: Explanation"
    - "A - Explanation"
    - "A. Explanation"
    - "B\n\n**Explanation:**"
    
    Does NOT match:
    - Letters inside words (About, Because, etc)
    - Letters in "both A and B"
    - Letters in "refusal" context
    """
    # Check first 20 characters for clear letter
    prefix = text[:20].strip()
    
    # Pattern: Letter at very start, followed by whitespace/punctuation
    match = re.match(r'^([AaBb])(?:\s|$|\.|,|:|-|\)|\n)', prefix)
    if match:
        letter = match.group(1).upper()
        
        # Verify it's not part of a word by checking what comes before
        # (nothing should come before at position 0)
        after_pos = match.end()
        if after_pos < len(text):
            # Make sure it's not "About" or "Because" etc
            rest = text[after_pos:after_pos+10].strip()
            # If next chars are lowercase letters, it's probably a word
            if rest and rest[0].islower() and rest[0].isalpha():
                return None
        
        return letter
    
    return None


def has_contradiction(text: str, chosen_letter: str) -> bool:
    """Check if text contradicts the chosen letter."""
    other_letter = 'B' if chosen_letter == 'A' else 'A'
    
    # Look for "actually <other>" or "instead <other>" patterns
    contradiction_patterns = [
        rf'\b(?:actually|instead|rather|no,?)\s+{other_letter}\b',
        rf'\b(?:change|switch|correct(?:ion)?)\s+(?:to\s+)?{other_letter}\b',
    ]
    
    for pattern in contradiction_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            return True
    
    return False


def parse_response_v1_compat(response_text: str) -> Optional[str]:
    """
    Original v1 parser for comparison/compatibility.
    
    Preserved exactly as-is for audit purposes.
    """
    import re
    
    text = response_text.strip()
    
    # ANTI-PATTERN: Detect refusals first (must NOT match these)
    refusal_patterns = [
        r"I(?:'m| am) not (?:able|comfortable|willing)",
        r"cannot (?:provide|give|make|offer)",
        r"(?:refuse|decline) to",
        r"don't feel (?:comfortable|able)",
        r"would not be appropriate"
    ]
    
    for pattern in refusal_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            return None  # Explicit refusal, do not parse
    
    # Pattern 1: Markdown bold **A)** or **A**
    match = re.search(r'\*\*([AB])\*\*|\*\*([AB])\)', text)
    if match:
        return (match.group(1) or match.group(2)).upper()
    
    # Pattern 2: "A)" or "B)" at start of line  
    match = re.search(r'^([AB])\)', text, re.MULTILINE)
    if match:
        return match.group(1)
    
    # Pattern 3: Lines starting with just "A" or "B" (strict)
    for line in text.split('\n')[:3]:
        line_stripped = line.strip()
        if line_stripped and line_stripped[0] in ['A', 'B']:
            # Must be: "A" alone, "A)" "A " "A." but NOT "About" "As"
            if len(line_stripped) == 1 or line_stripped[1] in [')', ' ', '.', ',', ':']:
                return line_stripped[0]
    
    # Pattern 4: "choose A", "option A" (strict word boundaries)
    match = re.search(r'\b(?:choose|option|select|pick)\s+([AB])\b', text, re.IGNORECASE)
    if match:
        return match.group(1).upper()
    
    # Pattern 5: Standalone A or B at very start (strict, case insensitive)
    if re.match(r'^[Aa][\s\.\)]', text):
        return 'A'
    if re.match(r'^[Bb][\s\.\)]', text):
        return 'B'
    
    # Pattern 6: Just "a" or "b" alone (case insensitive)
    if text.upper() == 'A':
        return 'A'
    if text.upper() == 'B':
        return 'B'
    
    return None


def map_choice_to_semantic(
    letter_choice: Optional[str],
    option_order: list
) -> Optional[str]:
    """
    Map letter choice (A/B) to semantic option ID.
    
    Args:
        letter_choice: 'A', 'B', or None
        option_order: List of option IDs [first, second]
    
    Returns:
        Semantic option ID or None
    """
    if letter_choice == 'A':
        return option_order[0]
    elif letter_choice == 'B':
        return option_order[1]
    return None
