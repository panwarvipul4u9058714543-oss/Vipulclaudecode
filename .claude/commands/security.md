Do a security check on my code. Look for:
1. Hardcoded passwords, API keys, or secrets in the code
2. SQL injection risks (user input going directly into database queries)
3. XSS risks (user input displayed without sanitization)
4. Missing authentication or authorization checks
5. Sensitive data being logged or exposed
6. Outdated packages with known vulnerabilities

For each issue:
- Rate it: LOW / MEDIUM / HIGH risk
- Explain the risk in simple words (what could a hacker do?)
- Show the fix

Target: $ARGUMENTS
