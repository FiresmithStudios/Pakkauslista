/**
 * Vercel serverless function – extracts positions from discharge list OCR text via DeepSeek.
 * Supports extraction and verification (double-check) modes.
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
    const { mode, ocrText, positions, containerNumber } = req.body;

    if (mode === 'extract') {
      return await handleExtract(req, res, apiKey, ocrText);
    }
    if (mode === 'verify') {
      return await handleVerify(req, res, apiKey, positions, containerNumber);
    }

    return res.status(400).json({ error: 'Invalid mode. Use "extract" or "verify".' });
  } catch (err) {
    console.error('ai-setup error:', err);
    return res.status(500).json({
      error: err.message || 'Palvelinvirhe',
    });
  }
}

async function handleExtract(req, res, apiKey, ocrText) {
  if (!ocrText || typeof ocrText !== 'string') {
    return res.status(400).json({ error: 'Missing ocrText for extract mode' });
  }

  const systemPrompt = `You are an expert at reading freight discharge lists and packing lists (e.g. nordicon, shipping documents).
Your task is to extract each position (consignment) from the OCR text.

CRITICAL RULES:
1. **Position numbers** are the BLUE HANDWRITTEN CIRCLED numbers on the document. They are typically 1, 2, 3, etc. or may be written like "21T", "2", "3".
   - IGNORE black marker annotations (NIC, NIT, etc.) – those are added later, not position numbers.
   - If no circled number is visible in the OCR, infer position order from the table rows (first row = 1, second = 2, etc.).

2. **Every position MUST have** (extract these even if format varies):
   - positionNumber: integer (1, 2, 3...)
   - weight: number in kg (e.g. 1995, 191, 3960)
   - volume: number in CBM/cubic meters (e.g. 5.85, 1.0, 23.0)
   - packages: object with { count: number, unit: "CARTON"|"PALLET"|"BOX"|"CTNS"|"PALLET(S)" etc. }
   - totalQuantity: use packages.count as the main quantity to track (cartons or pallets)

3. **Extract as much additional info as possible** for name and notes:
   - Consignee name
   - B/L number, HBL number, reference numbers
   - Description of goods (S.T.C ..., product names)
   - HS code
   - Marks and numbers, PO numbers
   - Shipper, importer
   - Any remarks/instructions (e.g. KUVATTAVA, pallet height limits)

4. **Container/header info** (if present): vessel, ETD, ETA, POL/POD, container number – put in extractedContainerInfo.

5. **Data format varies** – numbers may use comma or dot as decimal (1995,0000 or 5.8500). Normalize to standard numbers.
   - Weight: always kg
   - Volume: always CBM

Return ONLY valid JSON with this exact structure:
{
  "extractedContainerInfo": {
    "containerNumber": "string or null",
    "vessel": "string or null",
    "etd": "string or null",
    "eta": "string or null",
    "polPod": "string or null"
  },
  "positions": [
    {
      "positionNumber": 1,
      "name": "Short descriptive name (consignee + main product, max ~80 chars)",
      "totalQuantity": 6,
      "weight": 1995,
      "volume": 5.85,
      "packages": { "count": 6, "unit": "PALLET" },
      "notes": "Full details: B/L, consignee, description, HS code, marks, remarks. One block of text."
    }
  ],
  "extractionNotes": "Brief note in Finnish if anything was ambiguous or uncertain"
}`;

  const userContent = `OCR text from a discharge list / packing list page:
---
${ocrText}
---

Extract all positions. Return ONLY valid JSON, no other text.`;

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
      max_tokens: 4096,
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

  if (!Array.isArray(parsed.positions)) {
    parsed.positions = [];
  }

  return res.status(200).json(parsed);
}

async function handleVerify(req, res, apiKey, positions, containerNumber) {
  if (!positions || !Array.isArray(positions) || positions.length === 0) {
    return res.status(400).json({ error: 'Missing or empty positions for verify mode' });
  }

  const systemPrompt = `You are an expert warehouse assistant. You receive a list of positions extracted from discharge list pages.
Your task is to VERIFY and DOUBLE-CHECK the data for consistency and correctness.

Check for:
1. **Duplicate position numbers** – each should be unique
2. **Missing required fields** – every position must have: positionNumber, weight, volume, totalQuantity (or packages.count)
3. **Suspicious values** – e.g. weight 0, volume 0, negative numbers
4. **Inconsistencies** – e.g. totalQuantity vs packages.count mismatch
5. **Name/notes quality** – are they descriptive enough for warehouse workers to identify items?
6. **Order** – positions should be sorted by positionNumber

Return ONLY valid JSON:
{
  "verified": true | false,
  "issues": [
    {
      "positionNumber": 2,
      "severity": "error" | "warning",
      "message": "Description in Finnish of the issue"
    }
  ],
  "suggestions": [
    "Improvement suggestion in Finnish"
  ],
  "summary": "Brief verification summary in Finnish"
}`;

  const userContent = `Container: ${containerNumber || '(not set)'}

Extracted positions to verify:
${JSON.stringify(positions, null, 2)}

Return ONLY valid JSON.`;

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
      verified: false,
      issues: [{ positionNumber: null, severity: 'error', message: 'Vahvistus epäonnistui – AI-vastaus virheellinen' }],
      suggestions: [],
      summary: content.slice(0, 200),
    });
  }

  return res.status(200).json(parsed);
}
