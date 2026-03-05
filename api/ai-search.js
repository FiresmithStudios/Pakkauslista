/** Vercel serverless function – calls DeepSeek with OCR text (OCR runs in browser) */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured' });
  }

  try {
    const { labelText, positions } = req.body;
    if (!labelText || typeof labelText !== 'string' || !positions || !Array.isArray(positions)) {
      return res.status(400).json({ error: 'Missing labelText or positions' });
    }

    const systemPrompt = `You are an expert warehouse assistant. You receive OCR text from an item label and a list of positions (items) in a packing list. Your task is to identify which position this item belongs to.

Match by:
- Order numbers, reference numbers, or IDs
- Client/customer names
- Product names or descriptions
- Quantities
- Notes (each position may have free-form notes with extra identifying info)
- Any other identifying information

You MUST respond in valid JSON with this exact structure:
{
  "positionId": "the-id-of-the-best-matching-position-or-null-if-no-match",
  "confidence": "high" | "medium" | "low",
  "explanation": "Clear explanation in Finnish of why this item belongs to this position. Mention specific matches (order number, client name, etc.). If no match, explain why.",
  "whyNotOthers": "Brief explanation in Finnish of why other positions were ruled out. Mention key differences."
}

If no position matches, set positionId to null and explain why.`;

    const userContent = `OCR text from the item label:
---
${labelText}
---

Positions in the packing list (each has: container number, position number, name, notes, quantities):
${JSON.stringify(positions, null, 2)}

Return ONLY valid JSON, no other text.`;

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.2,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({
        error: `DeepSeek API error ${response.status}: ${errText.slice(0, 200)}`,
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return res.status(502).json({ error: 'Empty response from DeepSeek' });
    }

    let jsonStr = content.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = {
        positionId: null,
        confidence: 'low',
        explanation: content,
        whyNotOthers: 'Vastaus ei ollut odotetussa muodossa.',
      };
    }

    return res.status(200).json({
      labelText,
      ...parsed,
    });
  } catch (err) {
    console.error('ai-search error:', err);
    return res.status(500).json({
      error: err.message || 'Palvelinvirhe',
    });
  }
}
