Give me a full health check of this project. Check and report on:

1. GIT STATUS: Any uncommitted changes? How many commits ahead of main?
2. DEPENDENCIES: Are there outdated packages? Run npm outdated or pip list --outdated
3. SECURITY: Run npm audit — any vulnerabilities?
4. TESTS: Run the test suite — are any tests failing?
5. BUILD: Does the project build without errors?
6. CODE QUALITY: Any TypeScript errors? Any ESLint warnings?
7. FILE STRUCTURE: Does the project structure look clean and organized?

Present results as a simple dashboard:
✅ = Good  ⚠️ = Warning  ❌ = Problem

Then summarize: "Your project is in [GOOD/FAIR/NEEDS ATTENTION] shape."
List the top 3 things to fix if anything is wrong, in order of importance.
