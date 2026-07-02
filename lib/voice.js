/**
 * lib/voice.js — text-to-speech for Kim's WhatsApp voice replies.
 *
 * Groq Orpheus TTS returns WAV only, so we convert to OGG/Opus (WhatsApp's
 * voice-note format) with ffmpeg. Everything returns null on failure so callers
 * can fall back to text — voice is purely additive and never blocks a reply.
 *
 * Config (env, all optional):
 *   KIM_TTS_VOICE      — Orpheus voice: hannah | diana | autumn | austin | daniel | troy (default hannah)
 *   KIM_TTS_MODEL      — default canopylabs/orpheus-v1-english
 *   KIM_TTS_MAX_CHARS  — cap input so voice notes stay short (default 700)
 */
import { spawn } from "node:child_process";

const GROQ_API_KEY  = process.env.GROQ_API_KEY;
const TTS_MODEL     = process.env.KIM_TTS_MODEL || "canopylabs/orpheus-v1-english";
const TTS_VOICE     = process.env.KIM_TTS_VOICE || "hannah";
const TTS_MAX_CHARS = Number(process.env.KIM_TTS_MAX_CHARS || 700);

// Groq Orpheus → WAV buffer, or null on failure.
export async function synthesizeWav(text) {
  if (!GROQ_API_KEY || !text || !String(text).trim()) return null;
  const input = String(text).slice(0, TTS_MAX_CHARS);
  try {
    const r = await fetch("https://api.groq.com/openai/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: "Bearer " + GROQ_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ model: TTS_MODEL, voice: TTS_VOICE, input, response_format: "wav" }),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) { console.error("[VOICE] Groq TTS", r.status, (await r.text()).slice(0, 160)); return null; }
    return Buffer.from(await r.arrayBuffer());
  } catch (e) { console.error("[VOICE] Groq TTS failed:", e.message); return null; }
}

// WAV buffer → OGG/Opus buffer (WhatsApp voice note) via ffmpeg, or null.
export function wavToOggOpus(wav) {
  return new Promise((resolve) => {
    if (!wav || !wav.length) return resolve(null);
    let ff;
    try {
      ff = spawn("ffmpeg", [
        "-i", "pipe:0",
        "-c:a", "libopus", "-b:a", "32k", "-ar", "48000", "-ac", "1",
        "-application", "voip",
        "-f", "ogg", "pipe:1",
      ], { stdio: ["pipe", "pipe", "ignore"] });
    } catch (e) { console.error("[VOICE] ffmpeg spawn:", e.message); return resolve(null); }

    const chunks = [];
    ff.stdout.on("data", (d) => chunks.push(d));
    ff.on("error", (e) => { console.error("[VOICE] ffmpeg error:", e.message); resolve(null); });
    ff.on("close", (code) => resolve(code === 0 && chunks.length ? Buffer.concat(chunks) : null));
    ff.stdin.on("error", () => {}); // ignore EPIPE if ffmpeg dies early
    ff.stdin.write(wav);
    ff.stdin.end();
  });
}

// text → WhatsApp voice-note buffer (OGG/Opus), or null on any failure.
export async function synthesizeWhatsappVoice(text) {
  const wav = await synthesizeWav(text);
  if (!wav) return null;
  return await wavToOggOpus(wav);
}
