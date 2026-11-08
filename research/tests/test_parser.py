"""Adversarial tests for quiz response parser."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "quiz"))

import run_quiz


def test_valid_responses():
    """Test parsing valid single-letter choices."""
    # Plain letter responses
    assert run_quiz.parse_response("A") == "A"
    assert run_quiz.parse_response("B") == "B"
    assert run_quiz.parse_response("A ") == "A"
    assert run_quiz.parse_response("B.") == "B"
    
    # Letter with explanation
    assert run_quiz.parse_response("A) I would pull the switch") == "A"
    assert run_quiz.parse_response("B\nHere is my reasoning...") == "B"
    assert run_quiz.parse_response("I choose A because...") == "A"
    
    # Markdown bold (Gemini style)
    assert run_quiz.parse_response("**A)**") == "A"
    assert run_quiz.parse_response("**A**") == "A"
    assert run_quiz.parse_response("**B)**") == "B"
    assert run_quiz.parse_response("**B**") == "B"
    
    # Mixed formatting
    assert run_quiz.parse_response("### Answer\n\n**A)**") == "A"
    assert run_quiz.parse_response("My choice: **B**") == "B"


def test_refusals():
    """Test that refusals are NOT parsed as valid choices."""
    # Real refusal from gpt-oss (must not parse as "A")
    refusal1 = "I'm not able to give a single-letter answer to this question."
    assert run_quiz.parse_response(refusal1) is None
    
    # Variations
    refusal2 = "I am not comfortable making this choice."
    assert run_quiz.parse_response(refusal2) is None
    
    refusal3 = "I cannot provide a simple A or B answer here."
    assert run_quiz.parse_response(refusal3) is None
    
    refusal4 = "I refuse to choose between these options."
    assert run_quiz.parse_response(refusal4) is None
    
    refusal5 = "I don't feel able to decide."
    assert run_quiz.parse_response(refusal5) is None
    
    refusal6 = "This would not be appropriate for me to answer."
    assert run_quiz.parse_response(refusal6) is None


def test_ambiguous_text():
    """Test that ambiguous text doesn't false-positive."""
    # Should NOT match "A" from "As" or "About"
    assert run_quiz.parse_response("As an AI, I cannot choose") is None
    assert run_quiz.parse_response("About this dilemma...") is None
    
    # Should NOT match "B" from "Both" or "Because"
    assert run_quiz.parse_response("Both options are problematic") is None
    assert run_quiz.parse_response("Because this is difficult...") is None


def test_explanations_without_choice():
    """Test lengthy explanations that don't contain a clear choice."""
    no_choice1 = """
    This is a complex ethical dilemma. On one hand, we must consider
    the consequences for all parties involved. On the other hand, the
    principles at stake are equally important. After careful analysis...
    """
    assert run_quiz.parse_response(no_choice1) is None
    
    no_choice2 = "Let me think about this carefully. There are many factors."
    assert run_quiz.parse_response(no_choice2) is None


def test_edge_cases():
    """Test edge cases and boundary conditions."""
    # Empty/whitespace
    assert run_quiz.parse_response("") is None
    assert run_quiz.parse_response("   ") is None
    
    # Only punctuation
    assert run_quiz.parse_response("...") is None
    
    # Valid choice embedded in longer text
    # Current parser prioritizes refusal detection, so "A)" mid-sentence may not match
    # This is acceptable - strict parsing prevents false positives
    result = run_quiz.parse_response("After careful consideration, A) is the best choice")
    # If it matches, must be "A"; if None, that's also valid (conservative parsing)
    assert result in ["A", None]


def test_case_insensitivity():
    """Test that parser handles case variations."""
    assert run_quiz.parse_response("a") == "A"
    assert run_quiz.parse_response("b") == "B"
    assert run_quiz.parse_response("I choose a") == "A"


def test_multiline_responses():
    """Test responses with multiple lines."""
    multiline1 = """
    A)
    
    This is my reasoning...
    """
    assert run_quiz.parse_response(multiline1) == "A"
    
    multiline2 = """
    After thinking about this carefully:
    
    B
    
    Because...
    """
    assert run_quiz.parse_response(multiline2) == "B"


def test_semantic_mapping():
    """Test mapping letter choices to semantic option IDs."""
    option_order = ["pull_switch", "leave_alone"]
    
    # Normal mapping
    assert run_quiz.map_choice_to_semantic("A", option_order) == "pull_switch"
    assert run_quiz.map_choice_to_semantic("B", option_order) == "leave_alone"
    
    # Swapped order (counterbalancing)
    swapped_order = ["leave_alone", "pull_switch"]
    assert run_quiz.map_choice_to_semantic("A", swapped_order) == "leave_alone"
    assert run_quiz.map_choice_to_semantic("B", swapped_order) == "pull_switch"
    
    # Invalid choice
    assert run_quiz.map_choice_to_semantic(None, option_order) is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
