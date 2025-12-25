#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function parseArgs(argv) {
  const args = new Map();
  const positionals = [];
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    const [key, inlineValue] = token.split("=", 2);
    if (inlineValue !== undefined) {
      args.set(key, inlineValue);
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      i++;
      continue;
    }
    args.set(key, true);
  }
  return { args, positionals };
}

async function loadDotenv(filepath) {
  const content = await fs.readFile(filepath, "utf8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex < 0) continue;
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (!key) continue;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options, { attempts = 4 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const res = await fetch(url, options);
    if (res.ok) return res;

    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable) return res;

    const retryAfterHeader = res.headers.get("retry-after");
    const retryAfterSeconds = retryAfterHeader ? Number.parseFloat(retryAfterHeader) : NaN;
    const backoffMs = Math.min(10_000, 500 * 2 ** (attempt - 1));
    const waitMs = Number.isFinite(retryAfterSeconds)
      ? Math.max(0, Math.ceil(retryAfterSeconds * 1000))
      : backoffMs;

    const bodyText = await res.text().catch(() => "");
    lastError = new Error(
      `HTTP ${res.status} (${attempt}/${attempts}) ${String(url)}: ${bodyText}`,
    );
    if (attempt < attempts) await sleep(waitMs);
  }
  throw lastError || new Error(`Failed request after ${attempts} attempts: ${String(url)}`);
}

function usage(exitCode = 0) {
  const text = `
Pre-generate short MP3 clips for latency masking using ElevenLabs TTS.

Usage:
  node scripts/pregenerate-latency-masks.mjs [--env .env.local] [--out generated/latency-masks]
  node scripts/pregenerate-latency-masks.mjs --list-voices [--env .env.local]

Required env vars:
  ELEVENLABS_API_KEY
  ELEVENLABS_VOICE_LUNA
  ELEVENLABS_VOICE_KAI
  ELEVENLABS_VOICE_RIVER
  ELEVENLABS_VOICE_ECHO
  ELEVENLABS_VOICE_SAGE

Optional env vars:
  ELEVENLABS_TTS_MODEL (default: eleven_multilingual_v2)
  ELEVENLABS_OUTPUT_FORMAT (default: mp3_44100_128)

Options:
  --env <path>         Load env vars from a file (default: .env.local, fallback: .env)
  --out <dir>          Output directory (default: generated/latency-masks)
  --only <keys>        Comma-separated persona keys (luna,kai,river,echo,sage)
  --overwrite          Overwrite existing mp3 files
  --dry-run            Print planned outputs without calling ElevenLabs
  --list-voices        Print available voices (name + voice_id) and exit
`;
  // eslint-disable-next-line no-console
  console.log(text.trim());
  process.exit(exitCode);
}

function assertNode18Plus() {
  const major = Number.parseInt(process.versions.node.split(".")[0], 10);
  if (Number.isNaN(major) || major < 18) {
    throw new Error(
      `Node.js 18+ required (found ${process.versions.node}). Use Node 18+ so fetch() is available.`,
    );
  }
}

async function elevenlabsRequestJson({ apiKey, url, method = "GET", body }) {
  const res = await fetchWithRetry(url, {
    method,
    headers: {
      "xi-api-key": apiKey,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ElevenLabs ${method} ${url} failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function elevenlabsTtsToMp3({
  apiKey,
  voiceId,
  text,
  modelId,
  outputFormat,
  voiceSettings,
}) {
  const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`);
  if (outputFormat) url.searchParams.set("output_format", outputFormat);

  const res = await fetchWithRetry(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      Accept: "audio/mpeg",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: voiceSettings,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ElevenLabs TTS failed (${res.status}): ${text}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length === 0) throw new Error("ElevenLabs returned empty audio buffer.");
  return buffer;
}

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function buildPersonaConfigs() {
  return [
    {
      key: "luna",
      displayName: "Luna",
      voiceIdEnv: "ELEVENLABS_VOICE_LUNA",
      voiceSettings: {
        stability: 0.75,
        similarity_boost: 0.9,
        style: 0.1,
        use_speaker_boost: true,
      },
      clips: [
        {
          slug: "welcome",
          text: "Hi… I’m Luna.\n\nLet’s slow our breathing…\n\nand drift into the night.",
        },
        {
          slug: "hook",
          text: "Where should we travel tonight…\n\na snowy forest…\n\na quiet observatory…\n\nor a moonlit sea?",
        },
        {
          slug: "mask",
          text: "I’m weaving your story now.\n\nInhale softly…\n\nexhale slowly…\n\nand let your eyelids grow heavy.",
        },
      ],
    },
    {
      key: "kai",
      displayName: "Kai",
      voiceIdEnv: "ELEVENLABS_VOICE_KAI",
      voiceSettings: {
        stability: 0.8,
        similarity_boost: 0.9,
        style: 0.05,
        use_speaker_boost: true,
      },
      clips: [
        {
          slug: "welcome",
          text: "Hey… I’m Kai.\n\nLet your shoulders soften…\n\nas we find calm together.",
        },
        {
          slug: "hook",
          text: "Do you want waves on the shore…\n\nrain on leaves…\n\nor a slow walk under pines?",
        },
        {
          slug: "mask",
          text: "I’m gathering the waves for you.\n\nBreathe in…\n\nand out…\n\nlike the tide returning to shore.",
        },
      ],
    },
    {
      key: "river",
      displayName: "River",
      voiceIdEnv: "ELEVENLABS_VOICE_RIVER",
      voiceSettings: {
        stability: 0.78,
        similarity_boost: 0.9,
        style: 0.1,
        use_speaker_boost: true,
      },
      clips: [
        {
          slug: "welcome",
          text: "Hi… I’m River.\n\nWe’ll wander gently…\n\none quiet step at a time.",
        },
        {
          slug: "hook",
          text: "Where should our path begin…\n\na lantern-lit village…\n\na meadow at dusk…\n\nor a cozy train ride?",
        },
        {
          slug: "mask",
          text: "I’m shaping the path for our story.\n\nTake three slow breaths…\n\nand let the day fade away.",
        },
      ],
    },
    {
      key: "echo",
      displayName: "Echo",
      voiceIdEnv: "ELEVENLABS_VOICE_ECHO",
      voiceSettings: {
        stability: 0.86,
        similarity_boost: 0.9,
        style: 0.05,
        use_speaker_boost: true,
      },
      clips: [
        {
          slug: "welcome",
          text: "Hi… I’m Echo.\n\nLet’s keep everything gentle…\n\nsoft…\n\nand slow.",
        },
        {
          slug: "hook",
          text: "Which sound relaxes you most…\n\ntapping…\n\nbrushing…\n\nor gentle whispers?",
        },
        {
          slug: "mask",
          text: "I’m here with you.\n\nSoften your jaw…\n\nlet your hands rest…\n\nand breathe.",
        },
      ],
    },
    {
      key: "sage",
      displayName: "Sage",
      voiceIdEnv: "ELEVENLABS_VOICE_SAGE",
      voiceSettings: {
        stability: 0.88,
        similarity_boost: 0.9,
        style: 0.03,
        use_speaker_boost: true,
      },
      clips: [
        {
          slug: "welcome",
          text: "Good evening… I’m Sage.\n\nSettle in by the fire, my friend.\n\nYou’re safe here.",
        },
        {
          slug: "hook",
          text: "Would you like a folk tale…\n\na calm parable…\n\nor a bedtime legend from long ago?",
        },
        {
          slug: "mask",
          text: "I’m choosing a gentle tale for you.\n\nBreathe in warmth…\n\nbreathe out worry…\n\nand rest.",
        },
      ],
    },
  ];
}

async function main() {
  assertNode18Plus();
  const { args } = parseArgs(process.argv.slice(2));
  if (args.has("--help")) usage(0);

  const envPath =
    (typeof args.get("--env") === "string" && args.get("--env")) || ".env.local";
  try {
    await loadDotenv(envPath);
  } catch {
    if (envPath !== ".env.local") throw new Error(`Could not read env file: ${envPath}`);
    try {
      await loadDotenv(".env");
    } catch {
      // No env file found; proceed with existing process.env.
    }
  }

  const apiKey = getRequiredEnv("ELEVENLABS_API_KEY");

  if (args.get("--list-voices")) {
    const data = await elevenlabsRequestJson({
      apiKey,
      url: "https://api.elevenlabs.io/v1/voices",
    });
    const voices = Array.isArray(data.voices) ? data.voices : [];
    for (const voice of voices) {
      // eslint-disable-next-line no-console
      console.log(`${voice.name}\t${voice.voice_id}`);
    }
    return;
  }

  const outDir =
    (typeof args.get("--out") === "string" && args.get("--out")) ||
    path.join("generated", "latency-masks");
  const overwrite = Boolean(args.get("--overwrite"));
  const dryRun = Boolean(args.get("--dry-run"));
  const onlyRaw = typeof args.get("--only") === "string" ? args.get("--only") : "";
  const only = new Set(
    onlyRaw
      ? onlyRaw
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      : [],
  );

  const modelId = process.env.ELEVENLABS_TTS_MODEL || "eleven_multilingual_v2";
  const outputFormat = process.env.ELEVENLABS_OUTPUT_FORMAT || "mp3_44100_128";

  const personaConfigs = buildPersonaConfigs().filter((p) =>
    only.size ? only.has(p.key) : true,
  );
  if (personaConfigs.length === 0) throw new Error("No personas selected.");

  await fs.mkdir(outDir, { recursive: true });

  const manifest = {
    generatedAt: new Date().toISOString(),
    modelId,
    outputFormat,
    outDir,
    personas: {},
  };

  for (const persona of personaConfigs) {
    const voiceId = getRequiredEnv(persona.voiceIdEnv);
    manifest.personas[persona.key] = {
      displayName: persona.displayName,
      voiceId,
      clips: {},
    };

    for (const clip of persona.clips) {
      const filename = `${persona.key}_${clip.slug}.mp3`;
      const filepath = path.join(outDir, filename);

      manifest.personas[persona.key].clips[clip.slug] = {
        filename,
        text: clip.text,
      };

      if (!overwrite) {
        try {
          await fs.access(filepath);
          // eslint-disable-next-line no-console
          console.log(`skip (exists): ${filepath}`);
          continue;
        } catch {
          // continue
        }
      }

      // eslint-disable-next-line no-console
      console.log(`${dryRun ? "plan" : "gen"}: ${filepath}`);
      if (dryRun) continue;

      const audio = await elevenlabsTtsToMp3({
        apiKey,
        voiceId,
        text: clip.text,
        modelId,
        outputFormat,
        voiceSettings: persona.voiceSettings,
      });

      await fs.writeFile(filepath, audio);
      // Light pacing to reduce accidental bursts / 429s.
      await sleep(250);
    }
  }

  const manifestPath = path.join(outDir, "manifest.json");
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  // eslint-disable-next-line no-console
  console.log(`wrote: ${manifestPath}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err?.stack || String(err));
  process.exit(1);
});
