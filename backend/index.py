"""Облачная функция Yandex Cloud: хранение прогресса карточек.

Страница карточек (открытая как Telegram Mini App) присылает POST с JSON:
  {"action": "get", "initData": "..."}
  {"action": "set", "initData": "...", "data": "<json-строка прогресса>", "ts": 1729500000000}

initData — строка, которую Telegram выдаёт Mini App. Функция проверяет её
подпись ключом бота, поэтому подделать чужой user id нельзя.

Переменные окружения функции:
  BOT_TOKEN     — токен бота от @BotFather
  YDB_ENDPOINT  — Endpoint базы YDB (grpcs://...)
  YDB_DATABASE  — путь базы (/ru-central1/...)
  ALLOW_ORIGIN  — откуда разрешены запросы (по умолчанию https://ngafitulin.github.io)
  MAX_AGE_DAYS  — сколько дней считать initData действительным (по умолчанию 7)
"""
import hashlib
import hmac
import json
import os
import time
from urllib.parse import parse_qsl

MAX_DATA = 300_000  # байт; прогресс одного ученика обычно 5–50 КБ


# ── проверка подписи Telegram ─────────────────────────────────
def verify_init_data(init_data, bot_token, max_age_s):
    """Возвращает dict пользователя Telegram или None, если подпись неверна."""
    if not init_data or not bot_token:
        return None
    pairs = dict(parse_qsl(init_data, keep_blank_values=True))
    got = pairs.pop("hash", "")
    if not got:
        return None
    check = "\n".join(f"{k}={pairs[k]}" for k in sorted(pairs))
    secret = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    want = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(want, got):
        return None
    try:
        if time.time() - int(pairs.get("auth_date", "0")) > max_age_s:
            return None
        user = json.loads(pairs.get("user", "{}"))
    except (ValueError, TypeError):
        return None
    return user if isinstance(user, dict) and isinstance(user.get("id"), int) else None


# ── хранилище YDB ─────────────────────────────────────────────
class YdbStore:
    """Таблица progress(user_id Uint64, data Utf8, ts Uint64, PRIMARY KEY(user_id))."""

    _GET = """
    DECLARE $uid AS Uint64;
    SELECT data, ts FROM progress WHERE user_id = $uid;
    """
    _PUT = """
    DECLARE $uid AS Uint64; DECLARE $data AS Utf8; DECLARE $ts AS Uint64;
    UPSERT INTO progress (user_id, data, ts) VALUES ($uid, $data, $ts);
    """

    def __init__(self):
        import ydb  # импорт здесь, чтобы тесты работали без SDK

        self.ydb = ydb
        driver = ydb.Driver(
            endpoint=os.environ["YDB_ENDPOINT"],
            database=os.environ["YDB_DATABASE"],
            credentials=ydb.iam.MetadataUrlCredentials(),
        )
        driver.wait(timeout=10, fail_fast=True)
        self.pool = ydb.SessionPool(driver)

    def _read(self, tx, uid):
        rs = tx.execute(tx.session.prepare(self._GET), {"$uid": uid})
        rows = rs[0].rows
        return (rows[0].data, rows[0].ts) if rows else (None, 0)

    def get(self, uid):
        def op(session):
            tx = session.transaction(self.ydb.SerializableReadWrite())
            res = self._read(tx, uid)
            tx.commit()
            return res

        return self.pool.retry_operation_sync(op)

    def put_if_newer(self, uid, data, ts):
        """Пишет, только если ts новее сохранённого. Возвращает (записано, ts_в_базе)."""

        def op(session):
            tx = session.transaction(self.ydb.SerializableReadWrite())
            _, cur = self._read(tx, uid)
            if cur and cur > ts:
                tx.commit()
                return False, cur
            tx.execute(session.prepare(self._PUT), {"$uid": uid, "$data": data, "$ts": ts}, commit_tx=True)
            return True, ts

        return self.pool.retry_operation_sync(op)


_store = None


def store():
    global _store
    if _store is None:
        _store = YdbStore()
    return _store


# ── HTTP ──────────────────────────────────────────────────────
def _resp(code, body, origin):
    return {
        "statusCode": code,
        "headers": {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Max-Age": "86400",
        },
        "body": json.dumps(body, ensure_ascii=False),
    }


def handle(event, st):
    origin = os.environ.get("ALLOW_ORIGIN", "https://ngafitulin.github.io")
    method = (event.get("httpMethod") or "POST").upper()
    if method == "OPTIONS":
        return _resp(204, {}, origin)
    if method != "POST":
        return _resp(405, {"error": "method"}, origin)

    raw = event.get("body") or ""
    if event.get("isBase64Encoded"):
        import base64

        raw = base64.b64decode(raw).decode("utf-8")
    if len(raw) > MAX_DATA + 10_000:
        return _resp(413, {"error": "too_large"}, origin)
    try:
        req = json.loads(raw)
    except ValueError:
        return _resp(400, {"error": "bad_json"}, origin)

    max_age = int(os.environ.get("MAX_AGE_DAYS", "7")) * 86400
    user = verify_init_data(req.get("initData", ""), os.environ.get("BOT_TOKEN", ""), max_age)
    if not user:
        return _resp(401, {"error": "bad_init_data"}, origin)
    uid = user["id"]

    action = req.get("action")
    if action == "get":
        data, ts = st.get(uid)
        return _resp(200, {"data": data, "ts": ts}, origin)
    if action == "set":
        data, ts = req.get("data"), req.get("ts")
        if not isinstance(data, str) or not isinstance(ts, int) or ts < 0:
            return _resp(400, {"error": "bad_payload"}, origin)
        if len(data.encode("utf-8")) > MAX_DATA:
            return _resp(413, {"error": "too_large"}, origin)
        try:
            json.loads(data)
        except ValueError:
            return _resp(400, {"error": "bad_data"}, origin)
        saved, cur = st.put_if_newer(uid, data, ts)
        return _resp(200, {"saved": saved, "ts": cur}, origin)
    return _resp(400, {"error": "bad_action"}, origin)


def handler(event, context):
    """Точка входа для Yandex Cloud Functions (index.handler)."""
    return handle(event, store())
