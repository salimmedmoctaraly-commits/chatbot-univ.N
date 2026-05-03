import json
import os
import uuid
from datetime import datetime
from typing import Any, Text, Dict, List
from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher
import re
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_DEFAULT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "unknown_questions.json")
QUESTIONS_FILE = os.environ.get("QUESTIONS_FILE", _DEFAULT_PATH)


def _load_questions() -> list:
    try:
        if os.path.exists(QUESTIONS_FILE):
            with open(QUESTIONS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, list) else []
    except (json.JSONDecodeError, IOError) as e:
        logger.error(f"[load_questions] Erreur lecture : {e}")
    return []


def _save_questions(data: list) -> bool:
    try:
        d = os.path.dirname(QUESTIONS_FILE)
        if d:
            os.makedirs(d, exist_ok=True)
        with open(QUESTIONS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except IOError as e:
        logger.error(f"[save_questions] Erreur écriture : {e}")
        return False


def _normalize_question(q: dict) -> dict:
    if "id" not in q:
        q["id"] = str(uuid.uuid4())
    if "admin_reply" not in q:
        q["admin_reply"] = None
    if "replied_at" not in q:
        q["replied_at"] = None
    return q


def _migrate_legacy_data(data: list) -> list:
    migrated = False
    for i, q in enumerate(data):
        if "id" not in q or "admin_reply" not in q:
            data[i] = _normalize_question(q)
            migrated = True
    if migrated:
        logger.info("[migrate] Données legacy migrées")
        _save_questions(data)
    return data


class ActionDefaultFallback(Action):

    def name(self) -> Text:
        return "action_default_fallback"

    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        user_message = (tracker.latest_message.get("text") or "").strip()
        arabic_chars = len(re.findall(r'[\u0600-\u06FF]', user_message))
        is_arabic = arabic_chars > len(user_message) * 0.2 if user_message else False
        if user_message:
            self._save_unknown(user_message)
        if is_arabic:
            dispatcher.utter_message(response="utter_fallback_ar")
        else:
            dispatcher.utter_message(response="utter_fallback_fr")
        return []

    def _save_unknown(self, question: str):
        data = _load_questions()
        data = _migrate_legacy_data(data)
        if data and data[-1].get("question") == question:
            return
        data.append({
            "id": str(uuid.uuid4()),
            "question": question,
            "timestamp": datetime.now().isoformat(),
            "admin_reply": None,
            "replied_at": None
        })
        if _save_questions(data):
            logger.info(f"[save_unknown] ✅ ({len(data)} total) : {question[:60]}")
        else:
            logger.error(f"[save_unknown] ❌ Échec : {question[:60]}")


class ActionSearchKnowledge(Action):

    def name(self) -> Text:
        return "action_search_knowledge"

    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        user_message = (tracker.latest_message.get("text") or "").strip()
        arabic_chars = len(re.findall(r'[\u0600-\u06FF]', user_message))
        is_arabic = arabic_chars > len(user_message) * 0.2 if user_message else False
        if is_arabic:
            dispatcher.utter_message(text="عذراً، لم أجد معلومات كافية. هل يمكنك إعادة الصياغة؟")
        else:
            dispatcher.utter_message(text="Désolé, je n'ai pas trouvé d'informations suffisantes. Pouvez-vous reformuler ?")
        return []


class ActionSaveUnknownQuestion(Action):

    def name(self) -> Text:
        return "action_save_unknown_question"

    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        user_message = (tracker.latest_message.get("text") or "").strip()
        if user_message:
            data = _load_questions()
            data = _migrate_legacy_data(data)
            if not (data and data[-1].get("question") == user_message):
                data.append({
                    "id": str(uuid.uuid4()),
                    "question": user_message,
                    "timestamp": datetime.now().isoformat(),
                    "admin_reply": None,
                    "replied_at": None
                })
                if _save_questions(data):
                    logger.info(f"[ActionSaveUnknown] ✅ {user_message[:60]}")
                else:
                    logger.error(f"[ActionSaveUnknown] ❌ Échec : {user_message[:60]}")
        return []


class ActionProvideMasterDetails(Action):

    def name(self) -> Text:
        return "action_provide_master_details"

    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        user_message = (tracker.latest_message.get("text") or "").strip()
        arabic_chars = len(re.findall(r'[\u0600-\u06FF]', user_message))
        is_arabic = arabic_chars > len(user_message) * 0.2 if user_message else False
        if is_arabic:
            dispatcher.utter_message(text="للمزيد من المعلومات حول برامج الماستر، يرجى التواصل مع إدارة الكلية.")
        else:
            dispatcher.utter_message(text="Pour plus d'informations sur les programmes de Master, veuillez contacter l'administration de la faculté.")
        return []