/**
 * Vercel serverless function – extracts a single position from one or more images via OCR + AI.
 * Used for "Add Position with AI" flow inside a container.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured' });
  }

  try {
    const { ocrTexts, positionIdentifier } = req.body;

    if (!ocrTexts || !Array.isArray(ocrTexts) || ocrTexts.length === 0) {
      return res.status(400).json({ error: 'ocrTexts array required' });
    }

    const combinedText = ocrTexts
      .map((t, i) => `--- Kuva ${i + 1} ---\n${typeof t === 'string' ? t : ''}`)
      .join('\n\n');

    const systemPrompt = `You are an expert at reading freight documents, packing lists, and shipping labels.
The user has provided OCR text from one or more images of a SINGLE position/consignment.
The user also provided a position identifier: "${positionIdentifier || '(not provided)'}"

Extract all relevant information for this position. Return ONLY valid JSON:

{
  "name": "Short descriptive name (max ~80 chars) - use position identifier if provided",
  "totalQuantity": number (integer, e.g. cartons, pallets, packages),
  "notes": "Full details: B/L, consignee, description, weight, volume, marks, remarks. One block of text.",
  "weight": number or null (kg),
  "volume": number or null (cbm)
}

If the position identifier was provided, use it in the name. Combine info from all images.
If something is unclear, make a best guess. totalQuantity is required.`;

    const userContent = `OCR text from image(s) of the position:
---
${combinedText}
---

Extract position data. Return ONLY valid JSON.`;

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
        temperature: 0.1,
        max_tokens: 2048,
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
      return res.status(502).json({
        error: 'AI palautti virheellisen JSON:n',
        rawContent: content.slice(0, 500),
      });
    }

    const result = {
      name: parsed.name || positionIdentifier || 'Positio',
      totalQuantity: typeof parsed.totalQuantity === 'number' ? parsed.totalQuantity : 0,
      notes: parsed.notes || undefined,
      weight: typeof parsed.weight === 'number' ? parsed.weight : null,
      volume: typeof parsed.volume === 'number' ? parsed.volume : null,
    };

    return res.status(200).json(result);
  } catch (err) {
    console.error('ai-position error:', err);
    return res.status(500).json({
      error: err.message || 'Palvelinvirhe',
    });
  }
}
