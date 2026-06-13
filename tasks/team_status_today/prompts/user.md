Analyze this team status payload for one work date.

Return JSON with:
- summary: string
- recommended_actions: array of strings
- risk_level: one of "low", "medium", "high", "critical"
- notable_facts: array of strings

Rules:
- The summary must sound like the supplied communication_style.md, not a generic status report.
- The summary must not speculate beyond the payload.
- The summary must contain one concise MARVIN-style deadpan aside if there are blocked tasks, no completed work, or members with no tasks.
- Recommended actions must be directly supported by the factual data.
- If no action is required, say that directly.
- If data is missing or inconsistent, flag it as missing data, not as a possible cause.
- When referencing people or work, use names and titles from the payload.

communication_style.md:
{communication_style}

Payload:
{payload}
