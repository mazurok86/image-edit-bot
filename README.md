# image-edit-bot

Telegram-бот для редактирования изображений и генерации видео с помощью AI-моделей на [Replicate](https://replicate.com). Пользователь отправляет фото/видео/аудио/документ с текстовым запросом, выбирает модель — бот прогоняет вход через выбранную модель и возвращает результат.

Русскоязычные запросы автоматически переводятся на английский перед инференсом (через Yandex Translate). Доступ ограничен списком разрешённых чатов.

## Возможности

- Редактирование изображений и генерация видео на выбор из нескольких моделей Replicate
- Настройка параметров под каждую модель (соотношение сторон, размер, разрешение, длительность, FPS, звук, режим и т.д.) через inline-кнопки
- Приём фото, видео, аудио, голосовых сообщений и документов; референсные изображения/видео/аудио для Seedance 2.5
- Автоперевод запросов с русского (кириллица) на английский
- Конвертация HEIC → JPEG перед загрузкой на Replicate
- Ограничение доступа по `ALLOWED_CHAT_IDS`
- Персистентное состояние чатов в Redis; файлы истекают через час после первой загрузки
- Информативные ошибки (модерация контента, перегрузка сервиса, ограничения по видео и т.д.)

## Поддерживаемые модели

| Ключ | Replicate ID | Назначение | Настройки |
|------|--------------|-----------|-----------|
| `qwen` | `qwen/qwen-image-edit-plus` | Редактирование изображений (1–4) | Соотношение сторон |
| `flux1` | `black-forest-labs/flux-kontext-pro` | Редактирование изображений | Соотношение сторон |
| `flux2` | `black-forest-labs/flux-2-pro` | Редактирование изображений (1–4) | Соотношение сторон |
| `seedream` | `bytedance/seedream-4` | Редактирование изображений (1–4) | Соотношение сторон, размер (2K/4K) |
| `nanoBanana` | `google/nano-banana-pro` | Редактирование изображений (1–4) | Соотношение сторон |
| `kling` | `kwaivgi/kling-v2.1` | Видео из изображения (5s, 720p) | Режим (standard/pro) |
| `klingMC` | `kwaivgi/kling-v2.6-motion-control` | Видео с motion control (изображение + видео) | Ориентация персонажа |
| `wan22` | `wan-video/wan-2.2-i2v-fast` | Видео из изображения | Кол-во кадров, разрешение, FPS |
| `seedance25` | `bytedance/seedance-2.5` | Видео из текста и референсов: изображения, видео, аудио (редактирование, продление, липсинк) | Длительность, соотношение сторон, разрешение, звук |

## Требования

- Node.js 24+
- Redis
- Токены: Replicate, Telegram Bot, Yandex Cloud Translate

## Установка

```bash
npm install
cp .env.example .env   # заполнить значения
```

## Переменные окружения

Все переменные проверяются при старте (кроме `TELEGRAM_LOCAL_FILE_BASE_URL`), при отсутствии обязательной приложение падает.

| Переменная | Описание |
|-----------|----------|
| `REPLICATE_AUTH` | API-токен Replicate |
| `TELEGRAM_BOT_TOKEN` | Токен Telegram-бота |
| `TELEGRAM_BASE_API_URL` | Базовый URL Telegram API (`https://api.telegram.org`) |
| `TELEGRAM_ADMIN_BOT_TOKEN` | Токен технического (админского) Telegram-бота для отправки ошибок |
| `TELEGRAM_ADMIN_CHAT_ID` | Chat ID админского чата, куда отправляются необработанные ошибки Replicate API |
| `TELEGRAM_LOCAL_FILE_BASE_URL` | Базовый URL локального сервера файлов Telegram |
| `YANDEX_TRANSLATE_FOLDER_ID` | Folder ID в Yandex Cloud для перевода |
| `YANDEX_TRANSLATE_API_KEY` | API-ключ Yandex Cloud |
| `ALLOWED_CHAT_IDS` | Список разрешённых Telegram chat ID через запятую |
| `REDIS_URL` | URL Redis (`redis://localhost:6379`) |
| `REDIS_KEY_PREFIX` | Префикс ключей в Redis (`bot:`) |

## Команды

```bash
npm run dev        # запуск в режиме разработки через ts-node
npm run build      # компиляция TypeScript в dist/
npm run start      # запуск собранного кода
npm run lint       # ESLint
npm run lint:fix   # ESLint с автоисправлением
npm run format     # форматирование Prettier
```

Тесты в проекте не настроены.

## Как это работает

1. Пользователь отправляет фото/видео/аудио/документ и текст запроса в Telegram.
2. `BotService` (`src/services/botService.ts`) обрабатывает все события Telegram и делегирует их обработчикам:
   - `ModelSelectionHandler` — выбор модели через клавиатуру
   - `ModelSettingsHandler` — настройки модели через inline-кнопки
   - `FileHandler` — приём фото/видео/аудио/документов, конвертация HEIC → JPEG
   - `GenerationHandler` — запуск генерации и отправка результата
3. Кириллические запросы переводятся на английский через `YandexTranslateService`.
4. `ReplicateService` запускает выбранную модель Replicate (по одному методу на модель) и возвращает файлы.
5. Результат отправляется обратно в чат.

Состояние каждого чата (`ChatState`) хранится в Redis через `ChatRegistry` / `ChatStore`; загруженные файлы истекают через час после первой загрузки (последующие загрузки срок не продлевают, очистка сбрасывает его).

### Реестр моделей

Все модели описаны декларативно в `src/models/registry.ts`: Replicate ID, ограничения по числу изображений/видео/аудио, обязательность промпта и настраиваемые параметры (`capabilities`). Проверяются только минимумы и обязательность промпта; файлы того типа, который модель не использует, принимаются и игнорируются её раннером. Типобезопасность параметров обеспечивают типы в `src/types/model.ts` и `src/types/capabilities.ts`: каждая модель перечисляет только поддерживаемые ею значения, а точные типы настроек выводятся из литерала реестра.

### Добавление новой модели

1. Добавить запись в `models` в `src/models/registry.ts` (id, ограничения, `requirePrompt`, `capabilities`); новые ключи настроек сначала объявить в `src/types/capabilities.ts`.
2. Добавить метод в `ReplicateService`.
3. Добавить раннер в `runners` в конструкторе `BotService` (тип `ModelRunners` не даст его забыть).
4. Добавить строку в таблицу моделей выше.

## Структура проекта

```
src/
├── index.ts                      # точка входа: проверка env, инициализация сервисов
├── config/                       # типы окружения
├── constants/botTexts.ts         # тексты сообщений бота (MarkdownV2)
├── errors/                       # ReplicateApiError
├── helpers/                      # утилиты (файлы, строки, массивы)
├── models/registry.ts            # декларативный реестр моделей
├── services/
│   ├── botService.ts             # ядро обработки событий Telegram
│   ├── replicateService.ts       # вызовы моделей Replicate
│   ├── yandexTranslateService.ts # перевод кириллицы → английский
│   ├── redisService.ts           # обёртка над Redis-клиентом
│   └── handlers/                 # обработчики: файлы, генерация, выбор/настройки модели
├── state/
│   ├── chatRegistry.ts           # кэш ChatStore по chatId
│   └── chatStore.ts              # состояние чата + персист в Redis
└── types/                        # типы моделей, capabilities, файлов, состояния
```

## Деплой

Push в `main` запускает GitHub Actions (`.github/workflows/deploy.yml`): линт, сборка TypeScript, rsync на сервер и перезапуск через PM2 (`ecosystem.config.cjs`). Уведомления о старте и завершении деплоя приходят в Telegram.

## Технологии

TypeScript (strict, NodeNext), `node-telegram-bot-api`, `replicate`, `redis`, `heic-convert`, Yandex Cloud Translate.
