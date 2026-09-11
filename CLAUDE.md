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

Copy `.env.example` to `.env` and fill in all values. All of the following variables are required at startup (only `TELEGRAM_LOCAL_FILE_BASE_URL` is optional); chat IDs must be integers and the admin values must be non-empty:

- `REPLICATE_AUTH` — Replicate API token
- `TELEGRAM_BOT_TOKEN` — Telegram bot token
- `TELEGRAM_LOCAL_FILE_BASE_URL` — Telegram local file base URL
- `TELEGRAM_BASE_API_URL` — Telegram base API URL
- `TELEGRAM_ADMIN_BOT_TOKEN` — token of the technical (admin) bot used to report errors
- `TELEGRAM_ADMIN_CHAT_ID` — admin chat ID that receives raw Replicate API error messages
- `YANDEX_TRANSLATE_FOLDER_ID` — Yandex Cloud folder ID for translation
- `YANDEX_TRANSLATE_API_KEY` — Yandex Cloud API key
- `ALLOWED_CHAT_IDS` — comma-separated list of permitted Telegram chat IDs
- `REDIS_URL` — Redis connection URL
- `REDIS_KEY_PREFIX` — prefix for all Redis keys

## Architecture

Telegram bot: a user sends photos/videos/audio/documents plus a text prompt, picks a model, optionally tweaks per-model settings via inline buttons, and receives the generated files back as documents. The entry point is `src/index.ts`: it validates env, wires the services, connects to Redis and starts polling.

**Request flow:**
1. `BotService` (`src/services/botService.ts`) receives every message and callback query, rejects chats outside `ALLOWED_CHAT_IDS`, loads the chat's `ChatStore` via `ChatRegistry`, and delegates to the handlers in `src/services/handlers/`:
   - `ModelSelectionHandler` — reply-keyboard model picker; a button label maps back to a model key via `getModelKeyByName`
   - `ModelSettingsHandler` — inline-keyboard settings menu; callback data is `set#<capKey>`, `choose#<capKey>#<value>` or `back`
   - `FileHandler` — accepts photos, videos, audio messages, voice notes and documents; resolves Telegram file URLs, including a local Bot API server (`TELEGRAM_LOCAL_FILE_BASE_URL`)
   - `GenerationHandler` — the status reply after every input (`handlePrompt`, debounced via `ChatStore.scheduleResponse`), the "Создать" flow (`generate`) and "Очистить"
2. Before generation `GenerationHandler.uploadChatFiles()` converts HEIC files: `ReplicateService.uploadHeicImage()` fetches the file, converts it to JPEG via `heic-convert`, uploads it to the Replicate Files API and rewrites the entry in `chat.files`
3. `YandexTranslateService` translates the prompt to English when it contains Cyrillic
4. The model's runner from `BotService.runners` calls the matching `ReplicateService.run*` method with `{ images, videos, audios }` (`src/types/files.ts`) and the chat's settings; the method returns `FileOutput[]`, which are sent as Telegram documents
5. Errors: `ReplicateService` wraps SDK failures (including output download) in `ReplicateApiError`; the user gets a mapped message (`mapReplicateError`) and the raw text goes to the admin chat via `ErrorReporterService` (redacts bot tokens, truncates to 4096 chars, never throws)

**Model registry (`src/models/registry.ts`):** every model is one declarative entry: Replicate `id`, keyboard `name`, `minImages`/`maxImages`, `minVideo`/`maxVideo`, `minAudio`/`maxAudio`, `requirePrompt` and `capabilities` (user-adjustable settings). Only the `min*` limits and `requirePrompt` are enforced (`BotService.isReady`); `max*` are informational. Files of a kind a model does not use are accepted and ignored by its runner. `ModelKey`, `Models` and all helpers (`getModel`, `getModelCapabilities`, `getModelKeyByName`, `isModelKey`, …) derive from this object, so a new key propagates everywhere, including `ModelRunners` and the Redis state types.

**Capabilities:** `src/types/capabilities.ts` is the shared vocabulary: each key (`aspectRatio`, `resolution`, `duration`, `generateAudio`, …) is a `CapabilityBase` with an `id` equal to the key, a Russian `label`, a default `value` and `valueLabels`. Values are always strings (convert with `Number()` or compare with `'true'` in the runner). A model lists only the values it supports (`valueLabels` is `Partial`), and the exact per-model types in `src/types/model.ts` are inferred from the registry literal. User choices are stored per model in `ChatStore` and merged over the defaults by `getModelOptions`.

**Adding a new model:**
1. Add an entry to `models` in `src/models/registry.ts`; declare any new capability keys in `Capabilities` first.
2. Add a `run<Model>` method in `ReplicateService`; go through `this.run` and `this.readOutput` so failures become `ReplicateApiError`.
3. Add a runner to `this.runners` in the `BotService` constructor (`ModelRunners` makes it mandatory).
4. Add a row to the models table in `README.md`.

**State:** `ChatStore` (`src/state/chatStore.ts`) holds the prompt, files, selected model, per-model settings and settings-message ids; every mutation is persisted to Redis through `RedisService` (keys prefixed by `REDIS_KEY_PREFIX`). Files expire 1 hour after the first upload of a batch (later uploads do not extend it; "Очистить" resets it). `busy` and the debounce timer are in-memory only. `ChatRegistry` caches one `ChatStore` per chat id.

**Files:** `src/types/fileMimeType.ts` lists the allowed image, video and audio MIME types; `src/helpers/fileHelpers.ts` has `isAllowedImage`/`isAllowedVideo`/`isAllowedAudio` (video and audio are limited to 20 MB). `ChatStore.images`/`videos`/`audios` filter `chat.files` by MIME type and return URL arrays.

**Bot texts:** all user-facing strings live in `src/constants/botTexts.ts` and are MarkdownV2; escape dynamic text with `escapeMarkdownV2`.

**Deployment:** push to `main` triggers the GitHub Actions workflow (`.github/workflows/deploy.yml`), which lints, builds, rsyncs to the server, and reloads via PM2 (`ecosystem.config.cjs`).

## TypeScript Notes

The project uses strict TypeScript (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`). Use `import type` for type-only imports. All imports must include `.js` extensions (NodeNext module resolution).
