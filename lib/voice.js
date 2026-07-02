/**
 * lib/voice.js — text-to-speech for Sam's WhatsApp voice replies (Beverly's chief of staff).
 *
 * Groq Orpheus TTS returns WAV only, so we convert to OGG/Opus (WhatsApp's
 * voice-note format) with ffmpeg. Everything returns null on failure so callers
 * can fall back to text — voice is purely additive and never blocks a reply.
 *
 * Config (env, all optional):
 *   KIM_TTS_VOICE      — Orpheus voice: hannah | diana | autumn | austin | daniel | troy (default hannah)
 *   KIM_TTS_MODEL      — default canopylabs/orpheus-v1-english
 *   KIM_TTS_MAX_CHARS  — cap input so voice notes stay short (default 700)
 *   KIM_TTS_EMOTION    — "on" (default) rewrites the reply into an expressive
 *                        spoken script with Orpheus [vocal directions] via a
 *                        fast Haiku pass; "off" speaks the text verbatim
 *   KIM_TTS_EMOTION_MODEL — default claude-haiku-4-5-20251001
 */
import { spawn } from "node:child_process";

const GROQ_API_KEY  = process.env.GROQ_API_KEY;
const TTS_MODEL     = process.env.KIM_TTS_MODEL || "canopylabs/orpheus-v1-english";
const TTS_VOICE     = process.env.KIM_TTS_VOICE || "hannah";
const TTS_MAX_CHARS = Number(process.env.KIM_TTS_MAX_CHARS || 700);
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const EMOTION_ON    = (process.env.KIM_TTS_EMOTION || "on") !== "off";
const EMOTION_MODEL = process.env.KIM_TTS_EMOTION_MODEL || "claude-haiku-4-5-20251001";

const VOICIFY_PROMPT = `You turn a WhatsApp text reply from Sam (Beverly Cutajar's AI chief of staff — a warm, discreet, prepared, confident colleague) into a script for text-to-speech so it sounds like a real person talking, never flat.

The TTS engine (Orpheus) supports inline vocal directions in square brackets: 1-2 word adjectives/adverbs like [warm], [cheerful], [excited], [reassuring], [playful], [serious], [confident], [sympathetic]. A direction colours everything after it until the next one.

Rewrite the reply as natural speech:
- Match the mood of the content: good news sounds genuinely pleased, problems sound serious and steady, greetings and thanks sound warm. Never monotone, never theatrical.
- Insert 1-3 vocal directions at the moments the mood shifts. Start with one that sets the overall tone.
- Speak like a person: contractions, short sentences, natural rhythm. Drop anything unreadable aloud — URLs, long IDs, reference codes (say "the quote" not "S00621" unless the number matters, then read it as digits).
- Keep every fact and figure accurate. Do not add information, opinions, or promises that are not in the original.
- Keep it tight: under 550 characters, cut list-like repetition, keep the one key next step.

Output ONLY the spoken script with its bracketed directions. No preamble, no quotes, no markdown.`;

/**
 * Rewrite a text reply into an expressive spoken script with Orpheus
 * [vocal directions]. Returns the original text on any failure — this
 * step is additive polish, never a gate.
 */
export async function voicifyText(text) {
  if (!EMOTION_ON || !ANTHROPIC_API_KEY || !text) return text;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMOTION_MODEL,
        max_tokens: 400,
        system: VOICIFY_PROMPT,
        messages: [{ role: "user", content: String(text).slice(0, 2000) }],
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) { console.error("[VOICE] voicify", r.status, (await r.text()).slice(0, 160)); return text; }
    const out = (await r.json())?.content?.find((b) => b.type === "text")?.text?.trim();
    return out || text;
  } catch (e) { console.error("[VOICE] voicify failed:", e.message); return text; }
}

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
// Runs the emotion pass first so the spoken version sounds alive, not flat.
export async function synthesizeWhatsappVoice(text) {
  const script = await voicifyText(text);
  const wav = await synthesizeWav(script);
  if (!wav) return null;
  return await wavToOggOpus(wav);
}
