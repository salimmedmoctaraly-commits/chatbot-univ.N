import os
import re
import uuid
import logging
import requests
from datetime import datetime
from typing import Any, Text, Dict, List
from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── URL Flask ─────────────────────────────────────────────
# على Railway: FLASK_URL = https://cheerful-perception-xxxx.railway.app
# محلياً:      FLASK_URL = http://flask_app:5000
FLASK_URL = os.environ.get(
    "FLASK_URL",
    "http://flask_app:5000"
)
logger.info(f"[actions] FLASK_URL = {FLASK_URL}")


# ── Helpers ───────────────────────────────────────────────
def _is_arabic(text: str) -> bool:
    ar = len(re.findall(r'[\u0600-\u06FF]', text))
    return ar > len(text) * 0.2 if text else False


def _save_unknown(question: str) -> bool:
    """
    يرسل السؤال إلى Flask /save-unknown-question
    Flask هو المسؤول الوحيد عن الكتابة في الملف.
    """
    if not question or not question.strip():
        return False
    try:
        res = requests.post(
            f"{FLASK_URL}/save-unknown-question",
            json={"question": question.strip()},
            timeout=5,
        )
        if res.status_code == 200:
            data = res.json()
            logger.info(f"[save] ✅ ({data.get('count','?')} total): {question[:60]}")
            return True
        else:
            logger.error(f"[save] ❌ HTTP {res.status_code}: {res.text[:100]}")
            return False
    except requests.Timeout:
        logger.error(f"[save] ⏱ Timeout Flask: {question[:60]}")
        return False
    except requests.ConnectionError as e:
        logger.error(f"[save] ❌ Connexion Flask: {e}")
        return False
    except Exception as e:
        logger.error(f"[save] ❌ Erreur: {e}")
        return False


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
# Action 2 — حفظ سؤال غير معروف
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
