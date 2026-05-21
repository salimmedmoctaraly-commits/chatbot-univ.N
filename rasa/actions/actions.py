import json
import os
import uuid
import re
import logging
import requests as http_requests
from datetime import datetime
from typing import Any, Text, Dict, List
from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ══════════════════════════════════════════════════════════════
#  CONFIG — Flask API ou fichier JSON de secours
# ══════════════════════════════════════════════════════════════

# URL du backend Flask (priorité : variable d'environnement)
# En Docker : http://flask_app:5000
# En local  : http://localhost:5000
FLASK_BACKEND_URL = os.environ.get("FLASK_BACKEND_URL", "").rstrip("/")
logger.info(f"[actions] FLASK_BACKEND_URL = {FLASK_BACKEND_URL or '(non défini — mode JSON)'}")

# Fichier JSON de secours (quand Flask n'est pas disponible)
def _get_questions_file() -> str:
    env = os.environ.get("QUESTIONS_FILE")
    if env:
        return env
    if os.path.exists("/data"):
        return "/data/unknown_questions.json"
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "unknown_questions.json")

QUESTIONS_FILE = _get_questions_file()
logger.info(f"[actions] QUESTIONS_FILE (secours) = {QUESTIONS_FILE}")


# ══════════════════════════════════════════════════════════════
#  Helpers — JSON (mode secours)
# ══════════════════════════════════════════════════════════════

def _load_questions() -> list:
    try:
        if os.path.exists(QUESTIONS_FILE):
            with open(QUESTIONS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, list) else []
    except (json.JSONDecodeError, IOError) as e:
        logger.error(f"[load] Erreur JSON: {e}")
    return []


def _save_questions(data: list) -> bool:
    """Écriture atomique — empêche la corruption du fichier."""
    try:
        d = os.path.dirname(QUESTIONS_FILE)
        if d:
            os.makedirs(d, exist_ok=True)
        tmp = QUESTIONS_FILE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, QUESTIONS_FILE)
        return True
    except IOError as e:
        logger.error(f"[save] Erreur JSON: {e}")
        return False


def _normalize(q: dict) -> dict:
    if "id" not in q:
        q["id"] = str(uuid.uuid4())
    if "admin_reply" not in q:
        q["admin_reply"] = None
    if "replied_at" not in q:
        q["replied_at"] = None
    return q


def _migrate(data: list) -> list:
    changed = False
    for i, q in enumerate(data):
        if "id" not in q or "admin_reply" not in q:
            data[i] = _normalize(q)
            changed = True
    if changed:
        logger.info("[migrate] données anciennes migrées")
        _save_questions(data)
    return data


def _is_arabic(text: str) -> bool:
    ar = len(re.findall(r'[؀-ۿ]', text))
    return ar > len(text) * 0.2 if text else False


# ══════════════════════════════════════════════════════════════
#  Fonction principale de sauvegarde
#  Priorité : API Flask → fichier JSON (secours)
# ══════════════════════════════════════════════════════════════

def _save_unknown(question: str, sender_id: str = None) -> bool:
    """
    Sauvegarde une question inconnue.
    1. Essaie l'API Flask  → écrit dans SQLite (lu par le dashboard)
    2. Si Flask indisponible → écrit dans unknown_questions.json (secours)
    """
    if not question or not question.strip():
        return False
    q = question.strip()

    # ── Méthode 1 : API Flask (SQLite) ────────────────────────
    if FLASK_BACKEND_URL:
        try:
            resp = http_requests.post(
                f"{FLASK_BACKEND_URL}/save-unknown-question",
                json={"question": q, "sender_id": sender_id},
                timeout=5,
            )
            if resp.status_code == 200:
                data = resp.json()
                status = data.get("status", "ok")
                count  = data.get("count", "?")
                logger.info(f"[save] ✅ Flask API ({status}, {count} total): {q[:60]}")
                return True
            else:
                logger.warning(f"[save] Flask API status {resp.status_code}: {resp.text[:100]}")
        except http_requests.Timeout:
            logger.warning("[save] Flask API timeout — secours JSON")
        except http_requests.ConnectionError:
            logger.warning("[save] Flask API inaccessible — secours JSON")
        except Exception as e:
            logger.warning(f"[save] Flask API erreur ({e}) — secours JSON")

    # ── Méthode 2 : Fichier JSON (secours) ────────────────────
    data = _load_questions()
    data = _migrate(data)
    # Éviter les doublons consécutifs
    if data and data[-1].get("question") == q:
        logger.info(f"[save] doublon ignoré (JSON): {q[:60]}")
        return False
    data.append({
        "id":          str(uuid.uuid4()),
        "question":    q,
        "timestamp":   datetime.now().isoformat(),
        "sender_id":   sender_id,
        "admin_reply": None,
        "replied_at":  None,
    })
    ok = _save_questions(data)
    if ok:
        logger.info(f"[save] ✅ JSON ({len(data)} total): {q[:60]}")
    else:
        logger.error(f"[save] ❌ échec JSON: {q[:60]}")
    return ok


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
