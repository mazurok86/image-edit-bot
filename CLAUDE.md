# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Run in development mode via ts-node
npm run build      # Compile TypeScript to dist/
npm run start      # Run compiled output
npm run lint       # Run ESLint
npm run lint:fix   # Run ESLint with auto-fix
npm run format     # Format with Prettier
```

No test suite is configured.

## Environment Setup

Copy `.env.example` to `.env` and fill in all values. All five variables are required at startup:

- `REPLICATE_AUTH` — Replicate API token
- `TELEGRAM_BOT_TOKEN` — Telegram bot token
- `YANDEX_TRANSLATE_FOLDER_ID` — Yandex Cloud folder ID for translation
- `YANDEX_TRANSLATE_API_KEY` — Yandex Cloud API key
- `ALLOWED_CHAT_IDS` — comma-separated list of permitted Telegram chat IDs

## Architecture

This is a Telegram bot that lets users edit images and generate videos using AI models on Replicate. The entry point is `src/index.ts`, which wires together the services and starts polling.

**Request flow:**
1. User sends a photo/video/document + text prompt via Telegram
2. `BotService` handles all Telegram events and per-chat state
3. When a model button is tapped, `BotService.uploadChatFiles()` converts any HEIC files: fetches, converts to JPEG via `heic-convert`, uploads to Replicate Files API, and replaces the entry in `chat.files` in-place
4. `BotService` calls `YandexTranslateService` to translate any Russian (Cyrillic) prompts to English
5. `ReplicateService` runs the chosen Replicate model and returns file buffers
6. Results are sent back as Telegram documents

**Key services:**
- `src/services/botService.ts` — core message handler; manages state flow, keyboard menus, file handling, HEIC upload, and generation lifecycle
- `src/services/replicateService.ts` — one method per Replicate model (Flux, Seedream, NanoBananaPro, Kling, Kling Motion Control); also has `uploadHeicImage(url)` which fetches a HEIC URL, converts to JPEG, uploads via `replicate.files.create`, and returns a Replicate file URL
- `src/services/yandexTranslateService.ts` — translates Cyrillic prompts to English before inference; skips translation if no Cyrillic detected
- `src/state/chatStore.ts` — in-memory per-chat state (`ChatState`); files auto-expire after 1 hour of inactivity

**File types:**
- `src/types/chatFile.ts` — `ChatFile = { url: string, mimeType: FileMimeType }` — represents a user-uploaded file in chat state
- `src/types/fileMimeType.ts` — union of allowed MIME types
- `src/helpers/chatHelpers.ts` — `getChatImages(chat)` / `getChatVideos(chat)` — filter `chat.files` by MIME type and return URL arrays

**Models (`src/models/index.ts`):**
- `REPLICATE_MODELS` — actual Replicate model IDs (e.g. `black-forest-labs/flux-kontext-pro`)
- `BOT_MODELS` — display labels shown in Telegram keyboard buttons; these string values are also used as the routing key in `BotService.modelMap`

**Adding a new model:** add entries to both `REPLICATE_MODELS` and `BOT_MODELS`, add a method in `ReplicateService`, and add a mapping in the `BotService` constructor's `modelMap`.

**Deployment:** push to `main` triggers the GitHub Actions workflow (`.github/workflows/deploy.yml`), which lints, builds, rsyncs to the server, and reloads via PM2 (`ecosystem.config.cjs`).

## TypeScript Notes

The project uses strict TypeScript (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`). Use `import type` for type-only imports. All imports must include `.js` extensions (NodeNext module resolution).
