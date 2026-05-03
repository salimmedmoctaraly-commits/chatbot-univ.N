import json
import os
import logging
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# ── Config ────────────────────────────────────────────────
RASA_URL     = os.environ.get("RASA_URL", "http://localhost:5005/webhooks/rest/webhook")
RASA_TIMEOUT = int(os.environ.get("RASA_TIMEOUT", "15"))

# ── المسار الصحيح للملف ──────────────────────────────────
# على Railway: استخدم /data/ (Railway Volume) إذا كان موجوداً
# وإلا استخدم /app/shared/
_VOLUME_PATH = "/data/unknown_questions.json"
_DEFAULT_PATH = "/app/shared/unknown_questions.json"

def get_questions_file():
    """يختار المسار الصحيح تلقائياً."""
    env_path = os.environ.get("QUESTIONS_FILE")
    if env_path:
        return env_path
    # إذا كان /data/ موجوداً (Railway Volume)
    if os.path.exists("/data"):
        return _VOLUME_PATH
    return _DEFAULT_PATH

QUESTIONS_FILE = get_questions_file()
logger.info(f"QUESTIONS_FILE = {QUESTIONS_FILE}")

# Sessions نشطة
_active_sessions: dict = {}
SESSION_TIMEOUT = 300


# ── Helpers ───────────────────────────────────────────────
def load_questions() -> list:
    try:
        if os.path.exists(QUESTIONS_FILE):
            with open(QUESTIONS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, list) else []
    except Exception as e:
        logger.error(f"[load] {e}")
    return []


def save_questions(data: list) -> bool:
    try:
        d = os.path.dirname(QUESTIONS_FILE)
        if d:
            os.makedirs(d, exist_ok=True)
        tmp = QUESTIONS_FILE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, QUESTIONS_FILE)
        logger.info(f"[save] {len(data)} أسئلة في {QUESTIONS_FILE}")
        return True
    except Exception as e:
        logger.error(f"[save] ERREUR: {e}")
        return False


def ask_rasa(message: str, sender: str = "user") -> str:
    res = requests.post(
        RASA_URL,
        json={"sender": sender, "message": message},
        timeout=RASA_TIMEOUT,
    )
    res.raise_for_status()
    parts = [m["text"] for m in res.json() if "text" in m]
    return "\n\n".join(parts) or "..."


def get_active_count() -> int:
    now = datetime.utcnow().timestamp()
    active = {k: v for k, v in _active_sessions.items() if now - v < SESSION_TIMEOUT}
    _active_sessions.clear()
    _active_sessions.update(active)
    return len(active)


# ── Routes ────────────────────────────────────────────────
@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "service":        "UNA Chatbot API",
        "version":        "2.0.0",
        "status":         "running",
        "questions_file": QUESTIONS_FILE,
    })


@app.route("/health", methods=["GET"])
def health():
    questions = load_questions()
    return jsonify({
        "status":          "ok",
        "timestamp":       datetime.utcnow().isoformat(),
        "questions_count": len(questions),
        "active_users":    get_active_count(),
        "questions_file":  QUESTIONS_FILE,
        "file_exists":     os.path.exists(QUESTIONS_FILE),
    })


@app.route("/ping", methods=["POST"])
def ping():
    data   = request.get_json(silent=True) or {}
    sender = data.get("sender", "anonymous")
    _active_sessions[sender] = datetime.utcnow().timestamp()
    return jsonify({
        "status":       "ok",
        "active_users": get_active_count(),
    })


@app.route("/active-users", methods=["GET"])
def active_users():
    return jsonify({
        "active_users": get_active_count(),
        "timestamp":    datetime.utcnow().isoformat(),
    })


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
    logger.info(f"[/chat] {sender}: {user_message[:80]}")

    try:
        reply = ask_rasa(user_message, sender)
        return jsonify({
            "reply":        reply,
            "sender":       sender,
            "active_users": get_active_count(),
        })
    except requests.Timeout:
        return jsonify({"reply": "⏱ انتهت مهلة الاتصال، حاول مجدداً."}), 504
    except requests.ConnectionError:
        return jsonify({"reply": "⚠ تعذّر الاتصال بالخادم، يُرجى المحاولة لاحقاً."}), 503
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
        "question":  question,
        "timestamp": datetime.utcnow().isoformat()
    })

    if save_questions(questions):
        return jsonify({"status": "saved", "count": len(questions)})
    return jsonify({"error": "Erreur sauvegarde"}), 500


@app.route("/unknown-questions", methods=["GET"])
def get_questions():
    return jsonify(load_questions())


@app.route("/unknown-questions/all", methods=["DELETE"])
def delete_all():
    count = len(load_questions())
    if save_questions([]):
        logger.info(f"[DELETE ALL] {count} أسئلة محذوفة")
        return jsonify({"status": "deleted", "count": count})
    return jsonify({"error": "Erreur suppression"}), 500


@app.route("/unknown-questions/<int:index>", methods=["DELETE"])
def delete_question(index):
    data = load_questions()
    if index < 0 or index >= len(data):
        return jsonify({"error": "index out of range"}), 404
    removed = data.pop(index)
    if save_questions(data):
        return jsonify({"status": "deleted", "question": removed})
    return jsonify({"error": "Erreur suppression"}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    logger.info(f"Flask على المنفذ :{port}")
    logger.info(f"ملف الأسئلة: {QUESTIONS_FILE}")
    app.run(host="0.0.0.0", port=port, debug=False)
