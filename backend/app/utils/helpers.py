import json


def parse_list_field(raw_value, fallback: list[str]) -> list[str]:
    if isinstance(raw_value, list):
        return [str(x).strip() for x in raw_value if str(x).strip()] or fallback
    if not raw_value:
        return fallback
    text = str(raw_value).strip()
    if text.startswith('['):
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list) and parsed:
                return [str(x).strip() for x in parsed if str(x).strip()]
        except json.JSONDecodeError:
            pass
    parts = [part.strip() for part in text.split(',') if part.strip()]
    return parts or fallback
