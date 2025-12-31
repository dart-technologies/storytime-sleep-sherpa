# Audio Investigation & Fixes (LiveKit + Expo Audio)

## Summary

We hit a cluster of iOS audio issues while combining:

- **LiveKit (via `@elevenlabs/react-native`)** for real-time voice conversations (mic + agent playback)
- **`expo-audio`** for local playback (latency masks, ambient soundscapes, story narration)

Key symptoms were:

- LiveKit mic/audio becoming unreliable after playing `expo-audio` during a LiveKit call (matches LiveKit RN issue: https://github.com/livekit/client-sdk-react-native/issues/286).
- Screen recordings capturing app audio **noticeably quieter** than normal playback.
- iOS Control Center screen recordings sometimes **omit LiveKit voice-session audio entirely** (even when other in-app audio is captured).
- A short burst of **“white noise”** when tapping the mic to start voice.
- The mic “active” glow not appearing quickly/reliably.

The resolution is an explicit, deterministic audio-session handoff between **playback** and **voice** modes, plus UI/UX improvements for “connecting” state and tighter ambient gating.

## What Was Happening

### 1) LiveKit + `expo-audio` session contention

iOS has a single global `AVAudioSession`. Both LiveKit and `expo-audio` can change:

- category (playback vs playAndRecord)
- mode (default vs voiceChat/videoChat/spokenAudio)
- category options (mixing, speaker routing, bluetooth)

When `expo-audio` plays (ambient/masks) during an active LiveKit call, the underlying audio session can be reconfigured in a way that disrupts LiveKit’s mic capture / routing (see LiveKit issue #286).

### 2) Quiet (or missing) output during screen recording

iOS can treat certain audio-session configs (especially “mixing”/secondary-audio options and voice-chat modes) as lower-priority output, which often results in screen recordings capturing app audio at a lower level than expected.

In addition, iOS Control Center screen recording appears to sometimes drop audio from “voice communication” style sessions. In our stack this can present as **LiveKit conversation audio missing from the screen recording** (agent voice and/or mic), even though ambient/story playback is recorded.

Mitigations / workarounds:

- Avoid `voiceChat` / `videoChat` when you care about screen recording capture (prefer `EXPO_PUBLIC_IOS_VOICE_AUDIO_MODE=spokenAudio`).
- If Control Center screen recording stops capturing *post-voice* app audio (e.g., the “Crafting your story” mask), try `EXPO_PUBLIC_IOS_AUDIO_REARM_AFTER_VOICE_MS=500` to force a delayed playback re-arm after the voice session ends.
- If you need to share a repro/demo and Control Center won’t capture the voice audio, enable `EXPO_PUBLIC_ELEVENLABS_RECORD_AGENT_AUDIO=1` and use the in-app **Export Agent Audio** button to grab a WAV of the agent track.
- If you expected mic audio in the screen recording, confirm the Control Center recording mic is enabled (long-press the record button), but note iOS may still suppress mic/call audio during voice sessions.

### 3) “White noise” on mic press

Starting voice triggered a rapid chain of audio changes:

- ambient fade-out
- latency mask stop/start
- audio session mode/category switching
- LiveKit session start

That combination can produce a brief audible artifact during the route/category transition.

## Fix Strategy

### Goal

Make audio behavior explicit and predictable:

- **Playback mode**: `expo-audio` controls audio; LiveKit audio session is stopped.
- **Voice mode**: LiveKit audio session is configured + started; `expo-audio` is set to a recording-capable mode.
- Avoid repeatedly reconfiguring LiveKit for playback (reduces iOS warnings and transition artifacts).
- Ensure “mic is starting” has a dedicated UI state so the user gets immediate feedback.

## Code Changes (Comprehensive Resolution)

### Runtime toggles (Expo public env)

These are safe to change in `.env.local` for local testing:

- `EXPO_PUBLIC_ELEVENLABS_ALLOW_MIXING_WITH_OTHERS`
  - `0`: prefer consistent capture volume (recommended for screen recording)
  - `1`: allow mixing with other apps’ audio (can reduce capture loudness on iOS)
- `EXPO_PUBLIC_IOS_VOICE_AUDIO_MODE`
  - `spokenAudio` (default): tends to record at a more consistent level than VoIP modes
  - `default`: baseline iOS mode
  - `voiceChat` / `videoChat`: enables more aggressive VoIP-style processing (often worse for screen recording loudness)
- `EXPO_PUBLIC_IOS_PLAYBACK_AUDIO_MODE`
  - `spokenAudio` (default): good baseline for story playback + screen recording
  - `default`: fallback if `spokenAudio` causes silence or routing issues
- `EXPO_PUBLIC_IOS_AUDIO_REARM_AFTER_VOICE_MS`
  - `0`: off (default)
  - `250`–`1000`: after a voice session ends, wait N ms then re-apply playback audio configuration (can help if Control Center screen recording stops capturing post-voice “mask”/story audio)
- `EXPO_PUBLIC_ELEVENLABS_RECORD_AGENT_AUDIO`
  - `0`: off (default)
  - `1`: record the ElevenLabs agent audio stream as a WAV file (useful when iOS screen recording won’t capture LiveKit voice audio)

### Debug tracing (optional)

For focused audio diagnostics without turning on full verbose logging:

- `EXPO_PUBLIC_AUDIO_DEBUG=verbose`
  - Logs audio session transitions (voice/playback), LiveKit mode changes, and player state.
- `EXPO_PUBLIC_AUDIO_DEBUG_SAMPLE_MS=1000`
  - Logs periodic snapshots while any audio is playing.
  - Set to `0` to disable sampling if it’s too noisy.

### 1) Centralized LiveKit + Expo audio-session management

File: `components/elevenlabsConversation/audioSession.ts`

- Added explicit helpers to:
  - `configureAndStartLiveKitAudioSession()` (config + `AudioSession.startAudioSession()`).
  - `stopLiveKitAudioSession()` (calls `AudioSession.stopAudioSession()`).
- `setAudioForVoice()` now:
  - stops any existing LiveKit audio session, briefly waits
  - sets Expo voice mode (`allowsRecording: true`, `interruptionMode: 'doNotMix'`)
  - configures + starts LiveKit audio session
  - forces remote audio track volume to `1`
  - sets iOS Apple audio config to:
    - `audioCategory: 'playAndRecord'`
    - `audioCategoryOptions: ['allowAirPlay', 'allowBluetooth', 'allowBluetoothA2DP', 'defaultToSpeaker']`
    - `audioMode: EXPO_PUBLIC_IOS_VOICE_AUDIO_MODE` (falls back to `default` if rejected)
- `setAudioForPlayback()` now:
  - stops LiveKit audio session
  - sets Expo playback mode (`allowsRecording: false`)
  - sets iOS Apple audio config to:
    - `audioCategory: 'playback'`
    - `audioCategoryOptions: ['allowAirPlay', 'allowBluetoothA2DP']`
    - `audioMode: EXPO_PUBLIC_IOS_PLAYBACK_AUDIO_MODE` (falls back to `default` if rejected)
  - avoids re-starting LiveKit for playback (reduces iOS errors like `OSStatus -50` during category switching)

Why this helps:

- Keeps LiveKit’s session alive during voice and prevents `expo-audio` from silently “stealing” the audio session mid-call.
- Avoids iOS voice-chat modes and “mixing” options during voice to reduce quiet screen recording captures.
- Reduces churn and route changes when returning to playback.

### 2) Ensure `ElevenLabsConversationProvider` uses the handoff

File: `components/ElevenLabsConversationProvider.tsx`

- Before `conversation.startSession(...)`, we call `setAudioForVoice()`.
- On disconnect/error we call `setAudioForPlayback()`.
- We stop latency-mask playback before starting a voice session to avoid overlapping audio while LiveKit is initializing.

### 3) Reduce voice-start artifacts by hard-pausing ambient immediately

Files:

- `components/AudioProvider.tsx`
- `hooks/intake/useSoundscapeState.ts`
- `hooks/intake/useIntakeFlow.ts`

Changes:

- `pauseAmbient()` now accepts an optional `{ fadeMs }` and supports instant pause when `fadeMs <= 0`.
- On mic tap to start voice, we use `pauseAmbient({ fadeMs: 0 })` to prevent a short fade “tail” bleeding into the audio-session transition.

### 4) Fix mic glow + “connecting” UX

Files:

- `hooks/intake/useIntakeFlow.ts`
- `app/create/intake/[personaId].native.tsx`
- `components/screenStyles/intakeStyles.ts`

Changes:

- Added `isVoiceStarting` state to represent “user tapped mic, connection is in-flight.”
- The mic now uses `micActive = isSessionActive || isVoiceStarting`, so the icon + glow update immediately on tap.
- The glow is implemented using `BreathingGuide` in `variant="glow"` for a diffuse, cloud-like pulse.
- While `isVoiceStarting` is true, tapping mic again cancels (stops conversation) immediately.

## Verification

Local checks run after the changes:

- `yarn typecheck`
- `yarn test:ci components/elevenlabsConversation/__tests__/audioSession.test.ts`
- `yarn test:ci components/__tests__/AudioProvider.test.tsx`

## Notes / Follow-ups

If you still hear a “white noise” burst on mic start:

- Confirm whether a bluetooth route is involved (AirPods can exaggerate route-switch artifacts).
- Try with soundscape disabled; if it only happens with soundscape enabled, the artifact is likely from the ambient/route transition.
- Consider adding a small delay (50–150ms) between stopping ambient and starting LiveKit if needed (at the cost of slightly slower mic start).

If screen recordings still capture audio too quietly:

- The next lever is reducing “mixing” across the entire voice flow (including the `ElevenLabsProvider audioSessionConfig`), but that can impact other UX (like allowing external audio).
- Another lever is trying iOS `audioMode: 'spokenAudio'` while keeping `audioCategory: 'playAndRecord'` and avoiding `mixWithOthers`.
