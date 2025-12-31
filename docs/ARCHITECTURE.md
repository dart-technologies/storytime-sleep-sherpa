# Storytime Architecture

## Overview
- **Client:** Expo SDK 54 app using Expo Router. UI reads from an in-memory TinyBase store.
- **Auth:** Google Sign-In → Firebase Auth (ID tokens used for all protected backend calls).
- **Metadata:** Firestore `stories` collection (one doc per story).
- **Media:** Firebase Storage for cover images + narrated audio (`covers/…`, `narrations/…`).
- **AI (text + images):** Vertex AI (Gemini) via Firebase Functions (v2 / Cloud Run).
- **Voice:** ElevenLabs (TTS narration + Conversational AI token brokering).

## GCP / Backend Stack
- **Firebase Auth** for identity + tokens.
- **Firestore** stores story documents and powers the real-time sync to TinyBase.
- **Firebase Storage** stores:
  - cover images (uploaded mood images and/or generated illustrations)
  - narration audio (mp3)
- **Firebase Cloud Functions v2** (Cloud Run under the hood):
  - `generate`: calls Vertex AI Gemini to produce structured JSON `{ title, summary, narrative }`.
  - `vision`: calls Vertex AI for image analysis and stores the image to Storage.
  - `illustrate`: calls Vertex AI for cover generation and stores the image to Storage.
  - `narrate`: calls ElevenLabs TTS and stores audio to Storage.
  - `elevenlabsToken`: fetches an ElevenLabs conversational token (keeps API key off-device).
- **Secret Manager** stores server-only secrets like `ELEVENLABS_API_KEY`.

## Core Data Model
- **Firestore:** `stories/{storyId}`
  - user-facing metadata: `title`, `summary`, `personaId`, `duration`, `isFavorite`, `isPublic`, `createdAt`
  - media links: `coverImageUrl`, `audioUrl`
  - remix lineage: `remixOfStoryId`
  - provenance for “true remix”: `generation` (v1) including intake history + image analysis + model IDs

## Key User Flows

### 1) Sign-in
1. User signs in with Google.
2. Firebase Auth session established.
3. Client uses Firebase ID token for all Cloud Function calls and Firestore writes.

### 2) Library (My Stories / Community) + Sync
1. App subscribes to Firestore `stories` queries (my stories + public stories).
2. Snapshots are applied into TinyBase tables (`myStories`, `publicStories`).
3. UI reads from TinyBase (instant list rendering; Firestore is the sync source).

### 3) Create Story
1. User selects a persona (voice + style).
2. User optionally provides an “intake summary” (title/summary hints) via conversation UI.
3. Optional “mood image”:
   - pick local image → `vision` analyzes image + stores it to Storage → returns `imageUrl`
   - or pick a seasonal preset → analyzed similarly
4. Story production pipeline:
   - `generate` (Vertex/Gemini) → returns title/summary/narrative
   - `narrate` (ElevenLabs TTS) → returns `audioUrl` (Storage download URL)
   - optionally `illustrate` (Vertex/Gemini image) → returns `coverImageUrl` (Storage download URL)
5. Client saves story metadata to Firestore (optimistic insert into TinyBase first).

### 4) Remix Story
1. User taps Remix on an existing story.
2. Client loads the base story’s `generation` block (intake convo + image analysis + model IDs) and passes it into the next production run as **base context**.
3. The new intake context is appended/combined with the base context, and a new story is generated.
4. The new story is saved as a new Firestore doc with:
   - `remixOfStoryId` pointing to the base story
   - its own `generation` block (so remixes are chainable)
5. The “Add mood image” UI is prepopulated from the base story’s `coverImageUrl` unless the user replaces/clears it.

## Audio Flow (UX)
- **Ambient soundscapes:** play while browsing/intake (persona-selectable).
- **Latency masks:** short persona-specific audio clips that play immediately while network/AI work happens, masking generation latency.
- **Voice conversation:** ElevenLabs conversational mode (token fetched via backend) with iOS audio-session workarounds to reduce glitches.
- **Narration playback:** plays the ElevenLabs-generated `audioUrl` for a story.

## Storage Layout (Firebase Storage)
- `covers/<uid>/<timestamp>_<uuid>.(jpg|png)` (vision upload)
- `covers/<uid>/<personaId>/<timestamp>_<uuid>.(jpg|png)` (illustration)
- `narrations/<uid>/<personaId>/<timestamp>_<uuid>.mp3` (TTS)

## Sync + Offline Notes
- TinyBase is in-memory and is the UI source-of-truth for lists/details during a session.
- Firestore `onSnapshot` keeps TinyBase up-to-date and enables cross-device access (same user → same `userId` query).
- Writes use an optimistic local insert + Firestore `setDoc`; slow writes surface as “syncing in background”.

## Tests / Guarantees
- Unit tests cover the Firestore subscription wiring and story saves.
- `hooks/__tests__/tinybaseFirestoreSync.integration.test.ts` exercises the full “save → snapshot → TinyBase” pipeline with an in-memory Firestore mock to catch regressions in sync behavior.

## Firestore Setup (Rules + Indexes)
- Firestore permissions are enforced by rules in `firestore.rules`.
- The app’s current queries require composite indexes defined in `firestore.indexes.json`.
- Deploy with: `firebase deploy --only firestore` (or `firebase deploy --only firestore:rules,firestore:indexes`).
