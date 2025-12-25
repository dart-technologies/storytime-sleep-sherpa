# 🌙 Storytime: Sleep Sherpa

> AI-powered sleep stories with conversational voice personas, ASMR narration, and social remix.

[![Hackathon](https://img.shields.io/badge/Hackathon-AI%20Partner%20Catalyst-6366f1)](https://ai-partner-catalyst.devpost.com/)
[![Platform](https://img.shields.io/badge/Platform-iOS-000000?logo=apple)](https://expo.dev)
[![SDK](https://img.shields.io/badge/Expo-SDK%2054-4630eb?logo=expo)](https://expo.dev)

---

## ✨ Features

| Feature | Technology |
|---------|------------|
| 🎙️ **Conversational Intake** | ElevenLabs Agents |
| 📖 **Story Generation** | Vertex AI (Gemini 3 Pro) |
| 🖼️ **Image Context** | Vertex AI Vision |
| 🎧 **ASMR Narration** | ElevenLabs TTS |
| 💾 **Offline-First** | TinyBase + Cloud Storage |

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
cd storytime && npm install

# Configure environment
cp .env.example .env.local
# Add (Expo client): EXPO_PUBLIC_GOOGLE_CLIENT_ID, EXPO_PUBLIC_FIREBASE_*, CLOUD_FUNCTIONS_URL
# Set (Cloud Functions secrets/config): ELEVENLABS_API_KEY, GOOGLE_CLOUD_PROJECT_ID, VERTEX_AI_LOCATION, ELEVENLABS_AGENT_*, ELEVENLABS_VOICE_*

# Run
npm run ios
```

## 🎧 Latency Masking Clips

Pre-generate short per-persona MP3 clips (welcome + hook question + calming “mask” audio) to play instantly while story generation/narration happens:

```bash
node scripts/pregenerate-latency-masks.mjs --env .env.local --out generated/latency-masks
node scripts/pregenerate-latency-masks.mjs --list-voices --env .env.local
```

If generation fails due to an unavailable `voice_id`, swap `ELEVENLABS_VOICE_*` to a voice your API key can access (use `--list-voices`).

## 📁 Project Structure

```
storytime/
├── assets/images/    # App icon
├── public/avatars/   # Persona avatars (luna, kai, river, echo, sage)
├── plan/             # MVP Roadmap
├── scripts/          # One-off utilities (pre-gen audio, etc.)
├── docs/             # Setup & architecture guides
├── app/              # Expo Router screens (to build)
├── components/       # UI components (to build)
├── hooks/            # useGemini, useElevenLabs (to build)
├── functions/        # Cloud Functions (to build)
└── lib/              # Personas & themes (to build)
```

## 🛠️ Tech Stack

- **Frontend:** Expo SDK 54, React Native, TinyBase
- **AI:** ElevenLabs Agents, Vertex AI (Gemini 3 Pro + Vision)
- **Backend:** Firebase (Auth, Firestore), Cloud Functions, Cloud Storage

## 📋 Roadmap

See [`plan/MVP_ROADMAP.md`](./plan/MVP_ROADMAP.md) for detailed implementation phases.
