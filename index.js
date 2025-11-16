import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// Variables de entorno que vamos a cargar en Railway
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT;
const CATALOG_JSON = process.env.CATALOG_JSON;

// Endpoint raíz
app.get("/", (req, res) => {
  res.send("Bot de Tini Migliore está corriendo 💜");
});

// Verificación del webhook
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});

// Recepción de mensajes
app.post("/webhook", async (req, res) => {
  try {
    const webhookEvent = req.body.entry?.[0].changes?.[0].value;

    if (webhookEvent?.messages?.[0]) {
      const message = webhookEvent.messages[0];
      const from = message.from;
      const text = message.text?.body;

      if (text) {
        const reply = await generateReply(text);
        await sendWhatsAppMessage(from, reply);
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Error en webhook:", err);
    res.sendStatus(500);
  }
});

// Generar respuesta con OpenAI
async function generateReply(userMessage) {
  try {
    const catalog = CATALOG_JSON ? JSON.parse(CATALOG_JSON) : null;

    const messages = [
      {
        role: "system",
        content:
          SYSTEM_PROMPT +
          "\n\nInformación del catálogo (no la muestres literalmente al usuario):\n" +
          JSON.stringify(catalog)
      },
      {
        role: "user",
        content: userMessage
      }
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages,
        temperature: 0.4
      })
    });

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "No pude generar una respuesta 💜";
  } catch (err) {
    console.error("OpenAI error:", err);
    return "Tuve un problema al responder 💜";
  }
}

// Enviar mensaje por WhatsApp
async function sendWhatsAppMessage(to, text) {
  const url = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;

  const body = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text }
  };

  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WHATSAPP_TOKEN}`
    },
    body: JSON.stringify(body)
  });
}

app.listen(PORT, () => {
  console.log(`🚀 Bot de Tini corriendo en puerto ${PORT}`);
});
