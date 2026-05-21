import json
import os
import sqlite3
import uuid
import re
import logging
from datetime import datetime
from typing import Any, Text, Dict, List
from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════
#  CONFIG — SQLite partagé avec Flask (volume ./shared)
# ══════════════════════════════════════════════════════════════

def _get_db_path() -> str:
    """
    Cherche le fichier SQLite dans cet ordre de priorité :
    1. Variable d'environnement DB_FILE
    2. Volume Railway /data/chatbot.db
    3. Volume partagé ../shared/chatbot.db  (relatif au dossier actions/)
    """
    if os.environ.get("DB_FILE"):
        return os.environ["DB_FILE"]
    if os.path.exists("/data"):
        return "/data/chatbot.db"
    # Dans Docker : actions/ est monté à /app/actions → shared est à /app/shared
    base   = os.path.dirname(os.path.abspath(__file__))   # /app/actions
    shared = os.path.join(base, "..", "shared")            # /app/shared
    return os.path.join(shared, "chatbot.db")


def _get_json_path() -> str:
    if os.environ.get("QUESTIONS_FILE"):
        return os.environ["QUESTIONS_FILE"]
    if os.path.exists("/data"):
        return "/data/unknown_questions.json"
    base = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base, "unknown_questions.json")


DB_PATH        = _get_db_path()
QUESTIONS_FILE = _get_json_path()
logger.info(f"[actions] DB_PATH        = {DB_PATH}")
logger.info(f"[actions] QUESTIONS_FILE = {QUESTIONS_FILE}")


# ══════════════════════════════════════════════════════════════
#  Méthode 1 — SQLite direct (volume partagé avec Flask)
# ══════════════════════════════════════════════════════════════

def _ensure_table(conn: sqlite3.Connection) -> None:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS unknown_questions (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            question    TEXT    NOT NULL,
            timestamp   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            sender_id   TEXT,
            admin_reply TEXT    DEFAULT NULL,
            replied_at  TEXT    DEFAULT NULL
        )
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_timestamp
        ON unknown_questions (timestamp DESC)
    """)
    conn.commit()


def _save_to_sqlite(question: str, sender_id: str = None) -> bool:
    try:
        db_dir = os.path.dirname(DB_PATH)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)

        conn = sqlite3.connect(DB_PATH, timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")   # lectures + écritures simultanées
        conn.execute("PRAGMA synchronous=NORMAL")

        _ensure_table(conn)

        # Anti-doublon : ignorer si identique au dernier
        last = conn.execute(
            "SELECT question FROM unknown_questions ORDER BY id DESC LIMIT 1"
        ).fetchone()
        if last and last["question"] == question:
            conn.close()
            logger.info(f"[SQLite] doublon ignoré: {question[:60]}")
            return False

        conn.execute(
            "INSERT INTO unknown_questions (question, timestamp, sender_id) VALUES (?, ?, ?)",
            (question, datetime.utcnow().isoformat(), sender_id)
        )
        conn.commit()
        total = conn.execute("SELECT COUNT(*) FROM unknown_questions").fetchone()[0]
        conn.close()
        logger.info(f"[SQLite] ✅ ({total} total): {question[:60]}")
        return True

    except Exception as e:
        logger.error(f"[SQLite] erreur: {e}")
        return False


# ══════════════════════════════════════════════════════════════
#  Méthode 2 — JSON (secours si SQLite inaccessible)
# ══════════════════════════════════════════════════════════════

def _load_json() -> list:
    try:
        if os.path.exists(QUESTIONS_FILE):
            with open(QUESTIONS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, list) else []
    except Exception as e:
        logger.error(f"[JSON] lecture: {e}")
    return []


def _save_json(data: list) -> bool:
    try:
        d = os.path.dirname(QUESTIONS_FILE)
        if d:
            os.makedirs(d, exist_ok=True)
        tmp = QUESTIONS_FILE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, QUESTIONS_FILE)
        return True
    except Exception as e:
        logger.error(f"[JSON] écriture: {e}")
        return False


def _save_to_json(question: str, sender_id: str = None) -> bool:
    data = _load_json()
    if data and data[-1].get("question") == question:
        logger.info(f"[JSON] doublon ignoré: {question[:60]}")
        return False
    data.append({
        "id":          str(uuid.uuid4()),
        "question":    question,
        "timestamp":   datetime.now().isoformat(),
        "sender_id":   sender_id,
        "admin_reply": None,
        "replied_at":  None,
    })
    ok = _save_json(data)
    if ok:
        logger.info(f"[JSON] ✅ ({len(data)} total): {question[:60]}")
    return ok


# ══════════════════════════════════════════════════════════════
#  Fonction principale — SQLite d'abord, JSON en secours
# ══════════════════════════════════════════════════════════════

def _save_unknown(question: str, sender_id: str = None) -> bool:
    if not question or not question.strip():
        return False
    q = question.strip()

    # Essai 1 : SQLite partagé (même volume que Flask → dashboard)
    if _save_to_sqlite(q, sender_id):
        return True

    # Essai 2 : Flask API via HTTP (import lazy pour éviter crash si requests absent)
    flask_url = os.environ.get("FLASK_BACKEND_URL", "").rstrip("/")
    if flask_url:
        try:
            import requests as _req  # import lazy
            resp = _req.post(
                f"{flask_url}/save-unknown-question",
                json={"question": q, "sender_id": sender_id},
                timeout=5,
            )
            if resp.ok:
                logger.info(f"[Flask API] ✅ {resp.json()}: {q[:60]}")
                return True
        except ImportError:
            logger.warning("[Flask API] requests non disponible")
        except Exception as e:
            logger.warning(f"[Flask API] erreur ({e})")

    # Essai 3 : JSON (secours final)
    return _save_to_json(q, sender_id)


# ══════════════════════════════════════════════════════════════
#  Helper
# ══════════════════════════════════════════════════════════════

def _is_arabic(text: str) -> bool:
    ar = len(re.findall(r'[؀-ۿ]', text))
    return ar > len(text) * 0.2 if text else False


# ═══════════════════════════════════════════════════════════
# Action 1 — Fallback (question non comprise)
# ═══════════════════════════════════════════════════════════
class ActionDefaultFallback(Action):

    def name(self) -> Text:
        return "action_default_fallback"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:

        user_message = (tracker.latest_message.get("text") or "").strip()
        sender_id    = tracker.sender_id

        if user_message:
            _save_unknown(user_message, sender_id)

        if _is_arabic(user_message):
            dispatcher.utter_message(response="utter_fallback_ar")
        else:
            dispatcher.utter_message(response="utter_fallback_fr")

        return []


# ═══════════════════════════════════════════════════════════
# Action 2 — حفظ سؤال غير معروف (depuis les Rules)
# ═══════════════════════════════════════════════════════════
class ActionSaveUnknownQuestion(Action):

    def name(self) -> Text:
        return "action_save_unknown_question"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:

        user_message = (tracker.latest_message.get("text") or "").strip()
        sender_id    = tracker.sender_id

        if user_message:
            _save_unknown(user_message, sender_id)

        return []


# ═══════════════════════════════════════════════════════════
# Action 3 — البحث في قاعدة المعرفة
# ═══════════════════════════════════════════════════════════
class ActionSearchKnowledge(Action):

    def name(self) -> Text:
        return "action_search_knowledge"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:

        user_message = (tracker.latest_message.get("text") or "").strip()

        if _is_arabic(user_message):
            dispatcher.utter_message(
                text="عذراً، لم أجد معلومات كافية. هل يمكنك إعادة الصياغة؟"
            )
        else:
            dispatcher.utter_message(
                text="Désolé, je n'ai pas trouvé d'informations suffisantes. "
                     "Pouvez-vous reformuler ?"
            )

        return []


# ═══════════════════════════════════════════════════════════
# Action 4 — تفاصيل الماستر
# ═══════════════════════════════════════════════════════════
class ActionProvideMasterDetails(Action):

    def name(self) -> Text:
        return "action_provide_master_details"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:

        user_message = (tracker.latest_message.get("text") or "").strip()

        if _is_arabic(user_message):
            dispatcher.utter_message(
                text="للمزيد من المعلومات حول برامج الماستر، "
                     "يرجى التواصل مع إدارة الكلية أو زيارة الموقع الرسمي."
            )
        else:
            dispatcher.utter_message(
                text="Pour plus d'informations sur les programmes de Master, "
                     "veuillez contacter l'administration de la faculté "
                     "ou visiter le site officiel."
            )

        return []
