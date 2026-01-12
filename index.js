import express from "express";
import cors from "cors";
import fs from "fs";
import { z } from "zod";
import OpenAI from "openai";
import { log } from "console";
import "dotenv/config";

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ipUsage = new Map();
const MAX_PER_IP = 5;

const AnalyzeSchema = z.object({
  text: z.string().min(5),
});

app.get("/", (req, res) => {
  res.send("SendWise server alive");
});

app.post("/analyze", async (req, res) => {
  const ip = req.socket.remoteAddress;
  const count = ipUsage.get(ip) || 0;

  if (count >= MAX_PER_IP) {
    return res.json({ limitReached: true });
  }

  ipUsage.set(ip, count + 1);

  const parsed = AnalyzeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Texto inválido" });
  }

  const userText = parsed.data.text;

  const prompt = `
Sos un revisor profesional de mensajes.
No respondas como chat.
No hagas preguntas.

Devolvé SOLO JSON con este formato:
{
  "status": "OK" | "Warning",
  "reason": "explicación corta y humana",
  "suggestion": "versión mejorada del mensaje"
}

Mensaje:
"""${userText}"""
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    const content = completion.choices[0].message.content;

    fs.appendFileSync(
      "logs.txt",
      `\n---\n${new Date().toISOString()}\n${userText}\n${content}\n`
    );

    res.json(JSON.parse(content));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error analizando mensaje" });
  }
});

app.post("/analyze/feedback", (req, res) => {
  fs.appendFileSync(
    "feedback.txt",
    `${new Date().toISOString()} | ${JSON.stringify(req.body)}\n`
  );
  res.json({ ok: true });
});

app.listen(3000, () => {
  console.log("✅ SendWise server corriendo en http://localhost:3000");
});
