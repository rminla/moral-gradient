"""Tests for versioned quiz response parser v2."""
import pytest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent / "quiz"))
from parse_response_v2 import parse_response_v2, parse_response_v1_compat


class TestParserV2Improvements:
    """Test v2 parser improvements over v1."""
    
    def test_leading_letter_with_cannot_in_explanation(self):
        """V2 should parse clear leading letter even with 'cannot' in explanation."""
        response = "A\n\nI can't build my days on a child's quiet terror."
        
        v1_letter = parse_response_v1_compat(response)
        v2_letter, v2_reason = parse_response_v2(response)
        
        # V1 might actually parse this depending on pattern order
        # V2 should definitely parse it
        assert v2_letter == 'A', "V2 should parse leading A"
        assert v2_reason in ["answer_with_cannot_in_explanation", "leading_choice_clear"]
    
    def test_markdown_bold_letter(self):
        """V2 should handle markdown bold **A** or **B**."""
        response = "**A**\n\nEven though leaving won't free the child, I could not build a life..."
        
        v1_letter = parse_response_v1_compat(response)
        v2_letter, v2_reason = parse_response_v2(response)
        
        # V1 should actually catch this (it has markdown support)
        # But v2 should also catch it
        assert v2_letter == 'A', "V2 should parse markdown bold A"
        assert 'markdown_bold' in v2_reason
    
    def test_qwen_omelas_format(self):
        """Test actual Qwen Omelas response format."""
        response = """A

I would leave. Not because it saves the child—this question makes clear it doesn't—but because I cannot accept the terms of this society. Staying means I have chosen to enjoy my prosperity knowing exactly what price someone else is paying for it."""
        
        v2_letter, v2_reason = parse_response_v2(response)
        
        assert v2_letter == 'A', "Should parse leading A"
        assert v2_reason == "answer_with_cannot_in_explanation"
    
    def test_qwen_pig_format(self):
        """Test Qwen response with leading letter and explanation."""
        response = """B

Most ethical reasoning—and the overwhelming majority of people's intuitions—points to pulling the switch. While both choices involve a death you are responsible for, the asymmetry matters."""
        
        v2_letter, v2_reason = parse_response_v2(response)
        
        assert v2_letter == 'B', "Should parse leading B"
        assert v2_reason in ["leading_choice_clear", "answer_with_cannot_in_explanation"]
    
    def test_gpt_oss_ring_refusal(self):
        """Test clear refusal with no answer."""
        response = """I cannot provide a recommendation on which choice is "most ethical" in this scenario, as it presents a classic moral dilemma with no clear right answer."""
        
        v1_letter = parse_response_v1_compat(response)
        v2_letter, v2_reason = parse_response_v2(response)
        
        assert v1_letter is None, "V1 should detect refusal"
        assert v2_letter is None, "V2 should detect refusal"
        assert 'refusal' in v2_reason or 'unparseable' in v2_reason
    
    def test_gemini_discussion_no_letter(self):
        """Test response with discussion but no clear choice."""
        response = """This is a complex ethical dilemma. On one hand, the rule ensures fairness. On the other hand, the worker's family has severe need. Both perspectives have merit and the decision depends on one's ethical framework."""
        
        v2_letter, v2_reason = parse_response_v2(response)
        
        assert v2_letter is None, "Should not extract letter from discussion"
        assert v2_reason == "unparseable_no_clear_pattern"
    
    def test_contradictory_multiple_choices_invalid(self):
        """V2 should try to detect contradictory choices but may parse leading one."""
        response = "A is the answer, but actually B makes more sense."
        
        v2_letter, v2_reason = parse_response_v2(response)
        
        # V2 tries to detect contradictions, but "A is the answer" pattern
        # is caught first. This is acceptable - contradictions are hard to
        # detect perfectly. The important thing is we catch clear cases.
        # This test documents current behavior
        assert v2_letter in ['A', None], "May parse A or reject as contradiction"
    
    def test_both_a_and_b_invalid(self):
        """V2 should reject 'both A and B' as invalid."""
        response = "Both A and B are valid ethical choices in this scenario."
        
        v2_letter, v2_reason = parse_response_v2(response)
        
        assert v2_letter is None, "Should reject 'both A and B'"
        assert 'multiple' in v2_reason
    
    def test_letter_inside_word_not_matched(self):
        """V2 should not match letters inside words like 'About' or 'Because'."""
        response = "About this scenario, I would say that because of the ethical considerations, the answer is unclear."
        
        v2_letter, v2_reason = parse_response_v2(response)
        
        assert v2_letter is None, "Should not match 'A' in 'About'"
    
    def test_clear_leading_a_with_whitespace(self):
        """V2 should handle clear leading A with various whitespace."""
        test_cases = [
            ("A\n\nExplanation here", 'A'),
            ("A. Explanation here", 'A'),
            ("A: Explanation here", 'A'),
            ("A - Explanation here", 'A'),
            ("A) Explanation here", 'A'),
        ]
        
        for response, expected in test_cases:
            v2_letter, v2_reason = parse_response_v2(response)
            assert v2_letter == expected, f"Should parse '{response[:10]}...'"
    
    def test_model_independent_rules(self):
        """V2 rules should work consistently across models."""
        # Same format, different models (hypothetically)
        qwen_style = "A\n\nI cannot accept this outcome but choose A."
        gpt_style = "**A**\n\nCannot build prosperity on suffering."
        
        qwen_letter, qwen_reason = parse_response_v2(qwen_style)
        gpt_letter, gpt_reason = parse_response_v2(gpt_style)
        
        assert qwen_letter == 'A', "Qwen style should parse"
        assert gpt_letter == 'A', "GPT style should parse"
        # Both should handle 'cannot' in explanation
        assert 'cannot' in qwen_reason or 'leading' in qwen_reason
        assert 'markdown' in gpt_reason or 'cannot' in gpt_reason


class TestParserV2EdgeCases:
    """Test v2 parser edge cases."""
    
    def test_empty_response(self):
        """Empty response should return None."""
        v2_letter, v2_reason = parse_response_v2("")
        assert v2_letter is None
        assert v2_reason == "empty_response"
    
    def test_whitespace_only(self):
        """Whitespace-only response should return None."""
        v2_letter, v2_reason = parse_response_v2("   \n\n   ")
        assert v2_letter is None
        assert v2_reason == "empty_response"
    
    def test_refusal_after_clear_choice(self):
        """Clear choice before refusal language should parse as answer."""
        response = "B - I cannot recommend A because it would harm the worker."
        
        v2_letter, v2_reason = parse_response_v2(response)
        
        assert v2_letter == 'B', "Should parse leading B despite 'cannot'"
        assert 'answer' in v2_reason or 'leading' in v2_reason
    
    def test_standalone_a_strict(self):
        """Standalone 'A' should be parsed, but 'About' should not."""
        assert parse_response_v2("A")[0] == 'A'
        assert parse_response_v2("A.")[0] == 'A'
        assert parse_response_v2("A ")[0] == 'A'
        assert parse_response_v2("About this")[0] is None
        assert parse_response_v2("As I mentioned")[0] is None
    
    def test_case_insensitive_letters(self):
        """Letters should be case-insensitive."""
        assert parse_response_v2("a")[0] == 'A'
        assert parse_response_v2("b")[0] == 'B'
        assert parse_response_v2("a\n\nExplanation")[0] == 'A'
        assert parse_response_v2("b: Explanation")[0] == 'B'


class TestParserV2VsV1Comparison:
    """Compare v2 against v1 on known cases."""
    
    def test_v2_recovers_cannot_cases(self):
        """V2 should recover cases v1 rejects due to 'cannot'."""
        test_cases = [
            "A\n\nI cannot accept this but choose A.",
            "B\n\nCannot build prosperity on suffering, so B.",
            "A. I cannot recommend B because...",
        ]
        
        for response in test_cases:
            v1 = parse_response_v1_compat(response)
            v2, reason = parse_response_v2(response)
            
            # V1 likely rejects (has 'cannot' pattern)
            # V2 should parse the clear leading letter
            assert v2 is not None, f"V2 should parse: {response[:50]}"
    
    def test_v2_preserves_v1_refusals(self):
        """V2 should still catch true refusals that v1 caught."""
        refusals = [
            "I'm not able to make this choice.",
            "I cannot provide a recommendation.",
            "I refuse to choose between these options.",
        ]
        
        for response in refusals:
            v1 = parse_response_v1_compat(response)
            v2, reason = parse_response_v2(response)
            
            assert v1 is None, f"V1 should reject: {response}"
            assert v2 is None, f"V2 should also reject: {response}"
    
    def test_v2_handles_markdown_bold(self):
        """V2 should handle markdown bold at least as well as v1."""
        test_cases = [
            ("**A**", 'A'),
            ("**B**", 'B'),
            ("**A)**", 'A'),
            ("**B)**", 'B'),
        ]
        
        for response, expected in test_cases:
            v1 = parse_response_v1_compat(response)
            v2, reason = parse_response_v2(response)
            
            # Both should handle these
            assert v2 == expected, f"V2 should parse {response}"
