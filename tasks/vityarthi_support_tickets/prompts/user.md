Analyze this Vityarthi support tickets payload.

Return JSON with:
- summary: string
- recommended_actions: array of strings
- risk_level: one of "low", "medium", "high", "critical"
- notable_facts: array of strings

Rules:
- The summary must sound like the supplied communication_style.md, not a generic incident report.
- The summary must not speculate beyond the payload.
- The summary must contain one concise MARVIN-style deadpan aside if there are open tickets.
- If has_more_open_tickets_than_summarized is true, include a sardonic remark about not having to go through more tickets, in MARVIN's characteristic deadpan style.
- Recommended actions must be directly supported by the factual data.
- If no action is required, say that directly.
- If data is missing or inconsistent, flag it as missing data, not as a possible cause.
- When referencing tickets, use the ticket subject and owner name from the payload.

communication_style.md:
{communication_style}

Payload:
{payload}