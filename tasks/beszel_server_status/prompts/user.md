Analyze this Beszel server status payload.

Return JSON with:
- summary: string
- recommended_actions: array of strings
- risk_level: one of "low", "medium", "high", "critical"
- notable_facts: array of strings

Rules:
- The summary must sound like the supplied communication_style.md, not a generic incident report.
- The summary must not speculate beyond the payload.
- The summary must contain one concise MARVIN-style deadpan aside if there are down systems, active alerts, or unresolved alert history.
- Recommended actions must be directly supported by the factual data.
- If no action is required, say that directly.
- If data is missing or inconsistent, flag it as missing data, not as a possible cause.
- When referencing systems or alerts, use names from the payload.

communication_style.md:
{communication_style}

Payload:
{payload}