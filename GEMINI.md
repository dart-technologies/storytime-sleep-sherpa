# GEMINI.md (Storytime: Sleep Sherpa)

This document provides technical guidelines and project context for AI assistants working on the Storytime codebase.

## 🚀 Tech Stack
- **Frontend:** Expo SDK 54 (React Native), React Navigation (Tabs), TinyBase, Expo Updates
- **AI:** ElevenLabs (Agents, TTS), Vertex AI (Gemini 3 Pro + Gemini Vision)
- **Backend:** Firebase (Auth, Firestore, Storage, Cloud Functions)
- **Monitoring:** Firebase Crashlytics
- **Styling:** Custom StyleSheet + BlurView (Glassmorphism) + `constants/Theme.ts`, Reanimated for animations
- **Audio:** `expo-audio` (Background Playback), `expo-file-system` (Caching), `expo-keep-awake`

## 🛠️ Key Commands
### Environment Setup
```bash
cp .env.example .env.local
# Then fill in EXPO_PUBLIC_* keys (including EXPO_PUBLIC_ELEVENLABS_AGENT_* and EXPO_PUBLIC_ELEVENLABS_VOICE_*)
```

### Script: Latency Masking
```bash
# Generate all masks
node scripts/pregenerate-latency-masks.mjs --env .env.local --out generated/latency-masks

# List available ElevenLabs voices
node scripts/pregenerate-latency-masks.mjs --list-voices --env .env.local
```

### Development
```bash
npm install
yarn ios
```

### Deployment (Cloud Functions)
```bash
cd functions
yarn deploy
```

## 🎭 Persona Context
Each "Sherpa" has a specific system prompt and voice profile in ElevenLabs:
- **Luna:** Ethereal, fantasy focus, whisper profile (🌙).
- **Kai:** Meditative, nature/ocean focus, deep profile (🌊).
- **River:** Dreamy, wandering/travel focus (🌀).
- **Echo:** ASMR specialist, intimate/soft profile (🫧).
- **Sage:** Grandfatherly, wisdom/legend focus (🔥).

## 🏗️ Project Structure
- `app/`: Expo Router screens (Tabs, Create, Library, Auth).
- `app/create/intake/[personaId].tsx`: Main orchestration flow (Voice -> Vision -> Story -> Audio).
- `app.config.js`: Dynamic Expo configuration with required native plugins.
- `components/`: UI components (PersonaCard, WaveformVisualizer, PlaybackFooter, BreathingGuide).
- `constants/`: Centralized theme tokens and configuration.
- `hooks/`: Custom hooks for AI, Playback, and Data (`useGemini`, `useElevenLabs`, `useStore`).
- `functions/`: GCP Cloud Functions for secure AI orchestration (Gemini w/ JSON structure, Retries).
- `lib/`: Shared utilities (`assetMapper.ts`, `personas.ts`, `seasonalSpecials.ts`).
- `plan/`: MVP details, roadmap, and architectural specs.

## 📏 Engineering Standards
- **ASMR-First:** All audio interactions must prioritize low tempo, soft volume, and natural pauses.
- **Offline-First:** TinyBase is the primary data source, syncing with Firestore in the background.
- **Zero-Latency UI:** Serve all library data from TinyBase to ensure instantaneous responsiveness.
- **Generation Phase:** The intake flows through strictly defined phases (Stopping Voice -> Latency Mask -> Generation -> Cover Art -> Narration).
- **Latency Masking:** Always play pre-generated "masking" audio immediately upon transition.
- **Structured AI:** Use JSON schemas for Vertex AI story generation to ensure robust parsing.
- **Safe Area:** Use `react-native-safe-area-context` for all screen layouts.
- **Permissions:** Require `NSPhotoLibraryUsageDescription` for Mood Image selection.
- **Dynamic Config:** Prefer `app.config.js` for environment-aware orchestration and plugin management.

## 🧪 Testing Checklist
- [x] ElevenLabs Agent real-time streaming stability.
- [x] Vertex AI story generation (Structured JSON) and "sleepiness" tone.
- [x] Vision analysis for Mood Images (seasonal & upload).
- [x] Seamless transition from latency mask audio to generated story audio.
- [x] Firestore sync and library persistence.
- [x] Sleep timer with gradual volume fade-out.
- [x] Background audio playback (iOS).
- [x] Crashlytics integration verified.
- [x] Unit and integration tests passing.
