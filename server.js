import http from "http";

const PORT = process.env.PORT || 10000;

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "GET") {
    res.writeHead(200);
    return res.end(JSON.stringify({ status: "Alice webhook is running" }));
  }

  if (req.method !== "POST") {
    res.writeHead(405);
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  try {
    let raw = "";

    for await (const chunk of req) {
      raw += chunk;
    }

    const body = JSON.parse(raw || "{}");

    const userText =
      body?.request?.original_utterance ||
      body?.request?.command ||
      "";

    if (!userText.trim()) {
      return res.end(JSON.stringify({
        version: body.version || "1.0",
        response: {
          text: "Привет! Я Бро Ассистент. Спрашивай что угодно.",
          end_session: false
        }
      }));
    }

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-6-luna",
        instructions:
          "Ты голосовой помощник внутри Алисы. Отвечай по-русски, естественно и коротко, потому что ответ будет озвучен голосом.",
        input: userText,
        max_output_tokens: 250
      })
    });

    const data = await openaiResponse.json();

    if (!openaiResponse.ok) {
      throw new Error(data?.error?.message || "OpenAI API error");
    }

    let answer = data.output_text;

    if (!answer) {
      const texts = [];

      for (const item of data.output || []) {
        for (const content of item.content || []) {
          if (content.type === "output_text" && content.text) {
            texts.push(content.text);
          }
        }
      }

      answer = texts.join("\n");
    }

    answer = (answer || "Не получилось сформировать ответ.").slice(0, 1000);

    res.end(JSON.stringify({
      version: body.version || "1.0",
      response: {
        text: answer,
        end_session: false
      }
    }));

  } catch (error) {
    res.end(JSON.stringify({
      version: "1.0",
      response: {
        text: "Ошибка OpenAI: " + error.message,
        end_session: false
      }
    }));
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
