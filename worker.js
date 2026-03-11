export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const body = await request.json();
      const { imageBase64, mimeType = "image/jpeg" } = body;

      if (!imageBase64) {
        return resp({ error: "Missing imageBase64" }, 400, cors);
      }

      const base64Data = imageBase64.includes(",")
        ? imageBase64.split(",")[1]
        : imageBase64;

      const payload = {
        contents: [{
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data,
              },
            },
            {
              text: `You are a nutrition expert. Analyze this food image and return ONLY a JSON object (no markdown, no backticks) with this exact structure: {"foodName":"name","calories":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"sugar":0,"servingSize":"estimate"}. If no food detected return {"error":"No food detected"}`,
            },
          ],
        }],
      };

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`;

      const geminiRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const geminiData = await geminiRes.json();

      if (!geminiRes.ok) {
        return resp({ error: "Gemini error", details: geminiData }, geminiRes.status, cors);
      }

      const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;

      if (!text) {
        return resp({ error: "No text", raw: geminiData }, 200, cors);
      }

      try {
        return resp({ success: true, nutrition: JSON.parse(text.trim()) }, 200, cors);
      } catch {
        return resp({ success: true, text }, 200, cors);
      }
    } catch (err) {
      return resp({ error: err.message }, 500, cors);
    }
  },
};

function resp(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
