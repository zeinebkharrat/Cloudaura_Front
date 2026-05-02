import json
from security_analyzer import LoginRiskAnalyzer

with open("test_payloads.json", "r", encoding="utf-8") as f:
    test_cases = json.load(f)

analyzer = LoginRiskAnalyzer()

for i, test in enumerate(test_cases, 1):
    result = analyzer.analyze(test['username'], test['password'])
    is_blocked = result['is_blocked']
    success = (is_blocked == test['expected_blocked'])
    if not success:
        print(f"FAILED: Test {i}: {test['name']}")
        print(f"User: {test['username']}, Pass: {test['password']}")
        print(f"Expected blocked: {test['expected_blocked']}, Actual blocked: {is_blocked}")
        print(f"Score: {result['risk_score']}, Details: {result['details']}")
