import json
import os
import uuid
import re
import logging
from datetime import datetime
from typing import Any, Text, Dict, List
from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── مسار الملف ────────────────────────────────────────────
# Railway Volume  → /data/unknown_questions.json
# Local Docker    → rasa/actions/unknown_questions.json
def _get_questions_file() -> str:
    env = os.environ.get("QUESTIONS_FILE")
    if env:
        return env
    if os.path.exists("/data"):
        return "/data/unknown_questions.json"
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "unknown_questions.json")

QUESTIONS_FILE = _get_questions_file()
logger.info(f"[actions] QUESTIONS_FILE = {QUESTIONS_FILE}")


# ── Helpers ───────────────────────────────────────────────
def _load_questions() -> list:
    try:
        if os.path.exists(QUESTIONS_FILE):
            with open(QUESTIONS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, list) else []
    except (json.JSONDecodeError, IOError) as e:
        logger.error(f"[load] Erreur: {e}")
    return []


def _save_questions(data: list) -> bool:
    """كتابة ذرية — تمنع تلف الملف عند الكتابة المتزامنة."""
    try:
        d = os.path.dirname(QUESTIONS_FILE)
        if d:
            os.makedirs(d, exist_ok=True)
        tmp = QUESTIONS_FILE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, QUESTIONS_FILE)  # ذري — لا يتلف الملف
        return True
    except IOError as e:
        logger.error(f"[save] Erreur: {e}")
        return False


def _normalize(q: dict) -> dict:
    """يضيف الحقول الناقصة للأسئلة القديمة."""
    if "id" not in q:
        q["id"] = str(uuid.uuid4())
    if "admin_reply" not in q:
        q["admin_reply"] = None
    if "replied_at" not in q:
        q["replied_at"] = None
    return q


def _migrate(data: list) -> list:
    """ترحيل البيانات القديمة تلقائياً."""
    changed = False
    for i, q in enumerate(data):
        if "id" not in q or "admin_reply" not in q:
            data[i] = _normalize(q)
            changed = True
    if changed:
        logger.info("[migrate] بيانات قديمة تمت ترقيتها")
        _save_questions(data)
    return data


def _is_arabic(text: str) -> bool:
    ar = len(re.findall(r'[\u0600-\u06FF]', text))
    return ar > len(text) * 0.2 if text else False


def _save_unknown(question: str) -> bool:
    """حفظ سؤال غير معروف مع anti-doublon."""
    if not question or not question.strip():
        return False
    q = question.strip()
    data = _load_questions()
    data = _migrate(data)
    # تجنب التكرار المتتالي
    if data and data[-1].get("question") == q:
        logger.info(f"[save] doublon ignoré: {q[:60]}")
        return False
    data.append({
        "id":          str(uuid.uuid4()),
        "question":    q,
        "timestamp":   datetime.now().isoformat(),
        "admin_reply": None,
        "replied_at":  None
    })
    ok = _save_questions(data)
    if ok:
        logger.info(f"[save] ✅ ({len(data)} total): {q[:60]}")
    else:
        logger.error(f"[save] ❌ فشل: {q[:60]}")
    return ok


# ═══════════════════════════════════════════════════════════
# Action 1 — Fallback
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

        if user_message:
            _save_unknown(user_message)

        if _is_arabic(user_message):
            dispatcher.utter_message(response="utter_fallback_ar")
        else:
            dispatcher.utter_message(response="utter_fallback_fr")

        return []


# ═══════════════════════════════════════════════════════════
# Action 2 — حفظ سؤال غير معروف (من Rules)
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
        if user_message:
            _save_unknown(user_message)

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