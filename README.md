# 🌙 Storytime: Sleep Sherpa

> AI-powered sleep stories with conversational voice personas, ASMR narration, and social remix.

[![Hackathon](https://img.shields.io/badge/Hackathon-AI%20Partner%20Catalyst-6366f1)](https://ai-partner-catalyst.devpost.com/)
[![Platform](https://img.shields.io/badge/Platform-iOS-000000?logo=apple)](https://expo.dev)
[![SDK](https://img.shields.io/badge/Expo-SDK%2054-4630eb?logo=expo)](https://expo.dev)
[![Coverage](https://img.shields.io/badge/Coverage-83%25-green.svg)](./coverage/lcov-report/index.html)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🎥 Demo

YouTube: https://youtu.be/ignccc5iVXM

## 🧪 TestFlight Beta

Join the iOS beta: https://testflight.apple.com/join/5X3eGRNA

## ✨ Features

| Feature | Technology |
|---------|------------|
| 🎙️ **Conversational Intake** | ElevenLabs Agents |
| 📖 **Story Generation** | Vertex AI (Gemini 3) |
| 🖼️ **Image Context** | Vertex AI (Gemini Vision) |
| 🎧 **ASMR Narration** | ElevenLabs TTS |
| 💾 **Offline-First** | TinyBase + Cloud Storage + Connectivity Handling |
| ⚡ **Instant Updates** | Expo Updates (OTA) |

## 🎭 Meet Your Sherpas

| Persona | Voice | Specialty |
|---------|-------|-----------|
| **Luna** | Whisper, ethereal | Fantasy journeys |
| **Kai** | Deep, meditative | Nature & ocean |
| **River** | Dreamy | Peaceful wanderings |
| **Echo** | ASMR specialist | Intimate sounds |
| **Sage** | Grandfatherly | Wisdom tales |

## 🚀 Quick Start

```bash
# Clone & install
git clone https://github.com/dart-technologies/storytime-sleep-sherpa.git
cd storytime-sleep-sherpa && yarn install

# Configure environment
cp .env.example .env.local
# Add (Expo client): EXPO_PUBLIC_GOOGLE_CLIENT_ID, EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID, EXPO_PUBLIC_FIREBASE_*, EXPO_PUBLIC_ELEVENLABS_AGENT_*, EXPO_PUBLIC_ELEVENLABS_VOICE_*.
# Cloud Functions URLs: set full function URLs via EXPO_PUBLIC_CLOUD_FUNCTION_GENERATE + EXPO_PUBLIC_CLOUD_FUNCTION_NARRATE + EXPO_PUBLIC_CLOUD_FUNCTION_ELEVENLABS_TOKEN (optional: EXPO_PUBLIC_CLOUD_FUNCTION_VISION + EXPO_PUBLIC_CLOUD_FUNCTION_ILLUSTRATE for cover art; ILLUSTRATE is inferred from GENERATE/VISION in most Firebase deployments), OR set a shared EXPO_PUBLIC_CLOUD_FUNCTIONS_URL base like `https://us-central1-<project>.cloudfunctions.net`.
# Optional: EXPO_PUBLIC_DEBUG=true for verbose logging in non-__DEV__ builds.
# Optional: EXPO_PUBLIC_TEST_STORY_DURATION_SEC=15 to generate very short stories while debugging (saves credits).
# If you get `HTTP 401` with an HTML response from these URLs, Cloud Run is enforcing IAM; redeploy functions with `invoker: 'public'` (see `functions/src/index.ts`).
# Set (Cloud Functions secrets/config): ELEVENLABS_API_KEY, GOOGLE_CLOUD_PROJECT_ID, VERTEX_AI_LOCATION (optionally `global`), `VERTEX_AI_TRY_GLOBAL_LOCATION` (default true), and optionally `VERTEX_AI_TEXT_MODEL` / `VERTEX_AI_VISION_MODEL` / `VERTEX_AI_IMAGE_MODEL` (e.g. `gemini-3-pro-image-preview`).
# For EAS builds: provide file secrets GOOGLE_SERVICES_INFO_PLIST / GOOGLE_SERVICES_JSON (see app.config.js).

# Run
yarn ios
```

## 🌐 Web Sharing (EAS Hosting)

- Deploy the web build: `npx expo export -p web` then `eas deploy --prod`
- Set `EXPO_PUBLIC_WEB_BASE_URL` to the deployed URL (used by the in-app share sheet)
- Deploy Firebase Functions with `sharedStory` (see `functions/src/index.ts`)

## 🎧 Latency Masking Clips

Pre-generate short per-persona MP3 clips (welcome + hook question + calming “mask” audio) to play instantly while story generation/narration happens:

```bash
node scripts/pregenerate-latency-masks.mjs --env .env.local --out generated/latency-masks
node scripts/pregenerate-latency-masks.mjs --list-voices --env .env.local
```

If generation fails due to an unavailable `voice_id`, swap `EXPO_PUBLIC_ELEVENLABS_VOICE_*` (and `ELEVENLABS_VOICE_*` for scripts) to a voice your API key can access (use `--list-voices`).

## 📁 Project Structure

```
storytime/
├── assets/images/    # App icon
├── public/avatars/   # Persona avatars (luna, kai, river, echo, sage)
├── plan/             # MVP Roadmap
├── scripts/          # One-off utilities (pre-gen audio, etc.)
├── docs/             # Setup & architecture guides
├── app/              # Expo Router screens
├── components/       # UI components
├── hooks/            # Custom React hooks
├── functions/        # Cloud Functions
└── lib/              # Shared utilities & constants
```

## 🛠️ Tech Stack

- **Frontend:** Expo SDK 54, React Native, TinyBase, Expo Updates
- **AI:** ElevenLabs Agents, Vertex AI (Gemini 3 + Vision)
- **Backend:** Firebase (Auth, Firestore), Cloud Functions, Cloud Storage

## 📋 Roadmap

See [`plan/MVP_ROADMAP.md`](./plan/MVP_ROADMAP.md) for detailed implementation phases.
