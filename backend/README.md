# Прогресс карточек в Yandex Cloud

Карточки (`index.html` на GitHub Pages) открываются как Telegram Mini App.
Прогресс каждого ученика хранится в базе YDB по его Telegram ID.
Облачная функция проверяет подпись Telegram, поэтому чужой прогресс не прочитать.

```
Telegram → index.html (GitHub Pages) → облачная функция (index.py) → YDB
```

Всё укладывается в бесплатный уровень Yandex Cloud (1 млн вызовов функций,
1 ГБ и 1 млн операций YDB в месяц).

## 1. Бот

1. В Telegram открой [@BotFather](https://t.me/BotFather) → `/newbot` → получи **токен**.
2. `/mybots` → твой бот → **Bot Settings → Menu Button** → ссылка
   `https://ngafitulin.github.io/english_cards/` и название «Учить».

Теперь у бота внизу слева кнопка, которая открывает карточки внутри Telegram.
Для проверки сервер бота не нужен.

## 2. Аккаунт Yandex Cloud

1. [console.yandex.cloud](https://console.yandex.cloud) → войти Яндекс ID.
2. Создать **платёжный аккаунт** (нужна карта; бесплатный уровень работает только с ним).
3. Каталог `default` появится сам — дальше всё создаём в нём.

## 3. База YDB

1. **Managed Service for YDB → Создать базу** → тип **Serverless** → создать.
2. Открыть базу → **Навигация → Новый SQL-запрос**, выполнить:

   ```sql
   CREATE TABLE progress (
     user_id Uint64,
     data Utf8,
     ts Uint64,
     PRIMARY KEY (user_id)
   );
   ```
3. На вкладке **Обзор** скопировать **Эндпоинт** (`grpcs://ydb.serverless.yandexcloud.net:2135`)
   и **Базу данных** (`/ru-central1/b1g.../etn...`).

## 4. Сервисный аккаунт

**Identity and Access Management → Сервисные аккаунты → Создать**:
имя `cards-fn`, роль **`ydb.editor`**.

## 5. Облачная функция

1. **Cloud Functions → Создать функцию** → имя `cards-progress`.
2. Редактор → среда **Python 3.12** → способ **Редактор кода**:
   - создать файл `index.py` — вставить содержимое [`index.py`](index.py);
   - создать файл `requirements.txt` — вставить `ydb>=3.11,<4`.
3. Точка входа: `index.handler`. Таймаут: 10 с. Память: 128 МБ.
4. Сервисный аккаунт: `cards-fn`.
5. Переменные окружения:

   | Имя | Значение |
   |---|---|
   | `BOT_TOKEN` | токен от BotFather |
   | `YDB_ENDPOINT` | эндпоинт из шага 3 |
   | `YDB_DATABASE` | путь базы из шага 3 |
   | `ALLOW_ORIGIN` | `https://ngafitulin.github.io` |

6. **Сохранить изменения**.
7. На вкладке **Обзор** включить **Публичная функция** и скопировать
   **Ссылку для вызова** (`https://functions.yandexcloud.net/d4e...`).

## 6. Подключить карточки

В `index.html` найти строку

```js
const API_URL = "";
```

и вставить ссылку из шага 5.7 между кавычками. Закоммитить —
GitHub Pages обновится через минуту.

## Проверка

1. Открой бота → кнопка «Учить» → нажми «Не знаю» на паре слов.
2. Закрой, открой снова (или с другого телефона) — «В повторении» должно показать эти слова.
3. В консоли YDB: `SELECT user_id, ts FROM progress;` — появится строка с твоим ID.

Если не сохраняется: Cloud Functions → `cards-progress` → **Логи**.
Ответ `401` — неверный `BOT_TOKEN` или карточки открыты не из этого бота.
