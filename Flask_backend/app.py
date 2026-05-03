import json
import os
import logging
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import uuid

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

RASA_URL     = os.environ.get("RASA_URL", "http://localhost:5005/webhooks/rest/webhook")
RASA_TIMEOUT = int(os.environ.get("RASA_TIMEOUT", "15"))

_DEFAULT = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..", "rasa", "actions", "unknown_questions.json"
)
QUESTIONS_FILE = os.environ.get("QUESTIONS_FILE", os.path.normpath(_DEFAULT))

SESSION_TIMEOUT = 300
_active_sessions: dict = {}

logger.info(f"QUESTIONS_FILE = {QUESTIONS_FILE}")
logger.info(f"RASA_URL       = {RASA_URL}")


# ✅ FIX RAILWAY : crée le fichier au démarrage s'il n'existe pas
def _init_file():
    try:
        d = os.path.dirname(QUESTIONS_FILE)
        if d:
            os.makedirs(d, exist_ok=True)
        if not os.path.exists(QUESTIONS_FILE):
            with open(QUESTIONS_FILE, "w", encoding="utf-8") as f:
                json.dump([], f)
            logger.info(f"[init] Fichier créé : {QUESTIONS_FILE}")
        else:
            logger.info(f"[init] Fichier existant : {QUESTIONS_FILE}")
    except Exception as e:
        logger.error(f"[init] Impossible de créer le fichier : {e}")

_init_file()


def load_questions() -> list:
    try:
        if os.path.exists(QUESTIONS_FILE):
            with open(QUESTIONS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, list) else []
    except (json.JSONDecodeError, IOError) as e:
        logger.error(f"[load] {e}")
    return []


def save_questions(data: list) -> bool:
    try:
        d = os.path.dirname(QUESTIONS_FILE)
        if d:
            os.makedirs(d, exist_ok=True)
        with open(QUESTIONS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        logger.info(f"[save] {len(data)} questions écrites")
        return True
    except IOError as e:
        logger.error(f"[save] ERREUR: {e}")
        return False


def ask_rasa(message: str, sender: str = "user") -> str:
    res = requests.post(RASA_URL, json={"sender": sender, "message": message}, timeout=RASA_TIMEOUT)
    res.raise_for_status()
    parts = [m["text"] for m in res.json() if "text" in m]
    return "\n\n".join(parts) or "..."


def get_active_count() -> int:
    now = datetime.utcnow().timestamp()
    active = {k: v for k, v in _active_sessions.items() if now - v < SESSION_TIMEOUT}
    _active_sessions.clear()
    _active_sessions.update(active)
    return len(active)


@app.route("/", methods=["GET"])
def index():
    return jsonify({"service": "UNA Chatbot API", "version": "2.0.0", "status": "running"})


@app.route("/health", methods=["GET"])
def health():
    questions = load_questions()
    return jsonify({
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "questions_count": len(questions),
        "active_users": get_active_count(),
        "questions_file": QUESTIONS_FILE,
        "file_exists": os.path.exists(QUESTIONS_FILE),
    })


@app.route("/active-users", methods=["GET"])
def active_users():
    return jsonify({"active_users": get_active_count(), "timestamp": datetime.utcnow().isoformat()})


@app.route("/ping", methods=["POST"])
def ping():
    data   = request.get_json(silent=True) or {}
    sender = data.get("sender", "anonymous")
    _active_sessions[sender] = datetime.utcnow().timestamp()
    return jsonify({"status": "ok", "active_users": get_active_count()})


@app.route("/chat", methods=["GET", "POST"])
def chat():
    if request.method == "GET":
        return jsonify({"endpoint": "/chat", "method": "POST"})
    data         = request.get_json(silent=True) or {}
    user_message = data.get("message", "").strip()
    sender       = data.get("sender", "anonymous")
    if not user_message:
        return jsonify({"error": "message is required"}), 400
    _active_sessions[sender] = datetime.utcnow().timestamp()
    try:
        reply = ask_rasa(user_message, sender)
        return jsonify({"reply": reply, "sender": sender, "active_users": get_active_count()})
    except requests.Timeout:
        return jsonify({"reply": "⏱ انتهت مهلة الاتصال بالبوت."}), 504
    except requests.ConnectionError:
        return jsonify({"reply": "⚠ تعذّر الاتصال بالخادم."}), 503
    except Exception as e:
        logger.exception(e)
        return jsonify({"reply": f"⚠ خطأ: {str(e)}"}), 500


@app.route("/save-unknown-question", methods=["POST"])
def save_unknown_question():
    data     = request.get_json(silent=True) or {}
    question = data.get("question", "").strip()
    if not question:
        return jsonify({"error": "question is required"}), 400
    questions = load_questions()
    if questions and questions[-1].get("question") == question:
        return jsonify({"status": "duplicate", "count": len(questions)})
    questions.append({
        "id": str(uuid.uuid4()),
        "question": question,
        "timestamp": datetime.utcnow().isoformat(),
        "admin_reply": None,
        "replied_at": None
    })
    if save_questions(questions):
        return jsonify({"status": "saved", "count": len(questions)})
    return jsonify({"error": "Erreur lors de la sauvegarde"}), 500


@app.route("/unknown-questions", methods=["GET"])
def get_questions():
    return jsonify(load_questions())


@app.route("/unknown-questions/reply", methods=["POST"])
def reply_to_unknown_question():
    data       = request.get_json(silent=True) or {}
    q_id       = data.get("question_id")
    reply_text = data.get("reply", "").strip()
    if not q_id:
        return jsonify({"error": "question_id est requis"}), 400
    if not reply_text:
        return jsonify({"error": "La réponse est vide"}), 400
    questions = load_questions()
    found = False
    for i, q in enumerate(questions):
        if q.get("id") == q_id:
            questions[i]["admin_reply"] = reply_text
            questions[i]["replied_at"]  = datetime.utcnow().isoformat()
            found = True
            break
    if not found:
        return jsonify({"error": "Question introuvable"}), 404
    if save_questions(questions):
        return jsonify({"success": True, "message": "Réponse sauvegardée"})
    return jsonify({"error": "Erreur lors de la sauvegarde"}), 500


@app.route("/unknown-questions/all", methods=["DELETE"])
def delete_all():
    count = len(load_questions())
    if save_questions([]):
        return jsonify({"status": "deleted", "count": count, "permanent": True})
    return jsonify({"error": "Erreur lors de la suppression"}), 500


@app.route("/unknown-questions/<string:question_id>", methods=["DELETE"])
def delete_question(question_id):
    data         = load_questions()
    original_len = len(data)
    data         = [q for q in data if q.get("id") != question_id]
    if len(data) == original_len:
        return jsonify({"error": "Question introuvable"}), 404
    if save_questions(data):
        return jsonify({"status": "deleted", "permanent": True, "count": original_len - len(data)})
    return jsonify({"error": "Erreur lors de la suppression"}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    logger.info(f"Flask démarré sur :{port}")
    app.run(host="0.0.0.0", port=port, debug=False)