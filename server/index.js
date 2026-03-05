import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import Tesseract from 'tesseract.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

if (!DEEPSEEK_API_KEY) {
  console.error('Missing DEEPSEEK_API_KEY in .env');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files from client/dist in production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

/** Run OCR on base64 image data */
async function runOcr(base64Data) {
  if (!base64Data || typeof base64Data !== 'string') {
    throw new Error('Invalid image data');
  }
  const base64Match = base64Data.match(/^data:image\/[a-zA-Z+]+;base64,([\s\S]+)$/);
  const base64Str = base64Match ? base64Match[1] : base64Data.replace(/^data:[^;]+;base64,/, '');
  if (!base64Str || base64Str.length < 100) {
    throw new Error('Image data too small or invalid. The photo may be blank or corrupted.');
  }
  let buffer;
  try {
    buffer = Buffer.from(base64Str, 'base64');
  } catch (e) {
    throw new Error('Invalid image format. Please try taking a new photo.');
  }
  if (buffer.length < 100) {
    throw new Error('Image data too small. The photo may be blank or corrupted.');
  }
  const result = await Tesseract.recognize(buffer, 'fin+eng', {
    logger: () => {},
  });
  return result.data.text?.trim() || '';
}

/** Call DeepSeek API to match label text to positions */
async function askDeepSeek(labelText, positionsWithContainers) {
  const systemPrompt = `You are an expert warehouse assistant. You receive OCR text from an item label and a list of positions (items) in a packing list. Your task is to identify which position this item belongs to.

Match by:
- Order numbers, reference numbers, or IDs
- Client/customer names
- Product names or descriptions
- Quantities
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

Positions in the packing list (each has: container number, position number, name, description, quantities):
${JSON.stringify(positionsWithContainers, null, 2)}

Return ONLY valid JSON, no other text.`;

  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
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

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`DeepSeek API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('Empty response from DeepSeek');

  // Extract JSON from response (AI may wrap in markdown code blocks)
  let jsonStr = content.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1].trim();

  try {
    const parsed = JSON.parse(jsonStr);
    return parsed;
  } catch (e) {
    return {
      positionId: null,
      confidence: 'low',
      explanation: content,
      whyNotOthers: 'Vastaus ei ollut odotetussa muodossa.',
    };
  }
}

app.post('/api/ai-search', async (req, res) => {
  try {
    const { image, positions } = req.body;
    if (!image || !positions || !Array.isArray(positions)) {
      return res.status(400).json({ error: 'Missing image (base64) or positions array' });
    }

    let labelText;
    try {
      labelText = await runOcr(image);
    } catch (ocrErr) {
      return res.status(400).json({
        error: ocrErr.message || 'OCR could not read the image. Try a clearer photo with good lighting.',
      });
    }
    if (!labelText) {
      return res.status(400).json({
        error: 'OCR could not extract any text from the image. The photo may be too dark or blurry. Try a clearer photo with good lighting.',
      });
    }

    const result = await askDeepSeek(labelText, positions);
    res.json({
      labelText,
      ...result,
    });
  } catch (err) {
    console.error('ai-search error:', err);
    res.status(500).json({
      error: err.message || 'Server error',
    });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
