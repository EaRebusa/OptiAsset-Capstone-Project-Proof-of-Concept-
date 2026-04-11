import re
from difflib import SequenceMatcher

def normalize_string(text):
    """Basic normalization: lowercase and remove non-alphanumeric."""
    if not text:
        return ""
    return re.sub(r'[^a-z0-9]', '', text.lower())

def get_fuzzy_ratio(a, b):
    """Calculates similarity between 0 and 1."""
    return SequenceMatcher(None, a, b).ratio()

def match_asset_to_spec(input_model, specs_list):
    """
    Hybrid matching logic:
    1. Exact Match
    2. Normalized Match
    3. Token Intersection
    4. Fuzzy Scoring
    """
    if not input_model:
        return None

    for spec in specs_list:
        if spec.model_name == input_model:
            return spec

    norm_input = normalize_string(input_model)
    input_tokens = set(re.findall(r'\w+', input_model.lower()))

    best_fuzzy_spec = None
    highest_score = 0

    for spec in specs_list:
        # Do not allow fuzzy matching against our Generic Safety Nets
        if "Generic" in spec.model_name:
            continue

        norm_spec = normalize_string(spec.model_name)
        spec_tokens = set(re.findall(r'\w+', spec.model_name.lower()))

        if norm_input == norm_spec:
            return spec

        if spec_tokens and spec_tokens.issubset(input_tokens):
            return spec

        score = get_fuzzy_ratio(norm_input, norm_spec)
        if score > highest_score:
            highest_score = score
            best_fuzzy_spec = spec

    if highest_score > 0.85:
        return best_fuzzy_spec

    return None