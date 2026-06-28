import re
import unicodedata
import sqlite3
import json
import os
import logging
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# ══════════════════════════════════════════════════════════════
#  CONFIG
# ══════════════════════════════════════════════════════════════
RASA_URL     = os.environ.get("RASA_URL", "http://localhost:5005/webhooks/rest/webhook")
RASA_TIMEOUT = int(os.environ.get("RASA_TIMEOUT", "15"))

# Sessions نشطة — فقط عند إرسال رسائل فعلية
_active_sessions: dict = {}
SESSION_TIMEOUT = 300  # 5 دقائق — مدة عرض المستخدم كنشط بعد آخر رسالة


# ══════════════════════════════════════════════════════════════
#  DATABASE — SQLite
# ══════════════════════════════════════════════════════════════

def get_db_path() -> str:
    """يختار مسار قاعدة البيانات تلقائياً حسب البيئة."""
    if os.environ.get("DB_FILE"):
        return os.environ["DB_FILE"]
    # Railway Volume
    if os.path.exists("/data"):
        return "/data/chatbot.db"
    # Local / Docker
    base   = os.path.dirname(os.path.abspath(__file__))
    shared = os.path.join(base, "shared")
    os.makedirs(shared, exist_ok=True)
    return os.path.join(shared, "chatbot.db")


def get_legacy_json_path() -> str:
    """مسار ملف JSON القديم (للترحيل)."""
    if os.environ.get("QUESTIONS_FILE"):
        return os.environ["QUESTIONS_FILE"]
    if os.path.exists("/data"):
        return "/data/unknown_questions.json"
    base = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base, "shared", "unknown_questions.json")


DB_PATH     = get_db_path()
LEGACY_JSON = get_legacy_json_path()
logger.info(f"DB_PATH     = {DB_PATH}")
logger.info(f"LEGACY_JSON = {LEGACY_JSON}")


def get_db() -> sqlite3.Connection:
    """فتح اتصال بقاعدة البيانات مع إعدادات الأداء."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")   # كتابة متزامنة أفضل
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA synchronous=NORMAL") # توازن أداء/أمان
    return conn


def init_db() -> None:
    """إنشاء الجداول إذا لم تكن موجودة."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with get_db() as conn:
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
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_replied
            ON unknown_questions (admin_reply)
        """)
        # جدول تسجيل جميع التفاعلات لإحصائيات الكليات
        conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_logs (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                message     TEXT    NOT NULL,
                sender_id   TEXT,
                timestamp   TEXT    NOT NULL,
                faculty     TEXT    DEFAULT NULL
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_chatlog_faculty
            ON chat_logs (faculty)
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_chatlog_ts
            ON chat_logs (timestamp DESC)
        """)
        conn.commit()
    logger.info("[DB] ✓ جداول قاعدة البيانات جاهزة")


def migrate_from_json() -> None:
    """
    ترحيل تلقائي من JSON القديم إلى SQLite.
    يعمل مرة واحدة فقط إذا كانت قاعدة البيانات فارغة.
    """
    if not os.path.exists(LEGACY_JSON):
        return

    with get_db() as conn:
        count = conn.execute(
            "SELECT COUNT(*) FROM unknown_questions"
        ).fetchone()[0]
        if count > 0:
            logger.info(f"[DB] قاعدة البيانات تحتوي {count} سؤال — تخطي الترحيل")
            return

    try:
        with open(LEGACY_JSON, "r", encoding="utf-8") as f:
            data = json.load(f)

        if not isinstance(data, list) or len(data) == 0:
            logger.info("[DB] ملف JSON فارغ — لا يوجد ما يُرحَّل")
            return

        with get_db() as conn:
            for item in data:
                conn.execute(
                    """
                    INSERT INTO unknown_questions
                        (question, timestamp, sender_id, admin_reply, replied_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        item.get("question", "").strip(),
                        item.get("timestamp", datetime.utcnow().isoformat()),
                        item.get("sender_id"),
                        item.get("admin_reply"),
                        item.get("replied_at"),
                    )
                )
            conn.commit()

        logger.info(f"[DB] ✓ تم ترحيل {len(data)} سؤال من JSON إلى SQLite")

        # أرشفة ملف JSON القديم
        archive = LEGACY_JSON + ".migrated"
        os.rename(LEGACY_JSON, archive)
        logger.info(f"[DB] JSON القديم أُرشف إلى {archive}")

    except Exception as e:
        logger.error(f"[DB] خطأ في الترحيل: {e}")


def row_to_dict(row: sqlite3.Row) -> dict:
    """تحويل صف SQLite إلى dict."""
    return dict(row)


# ══════════════════════════════════════════════════════════════
#  FACULTY DETECTION — اكتشاف الكلية من محتوى الرسالة
#  يستخدم: تطبيع النص + قاموس شامل + نظام التسجيل (Scoring)
# ══════════════════════════════════════════════════════════════

_ARABIC_DIACRITICS = re.compile(
    r'[ً-ٰٟۖ-ۜ۟-۪ۤۧۨ-ۭ]'
)


def normalize_text(text: str) -> str:
    """تطبيع النص: إزالة التشكيل، NFC، حروف صغيرة، ضغط المسافات."""
    text = _ARABIC_DIACRITICS.sub('', text)
    text = unicodedata.normalize('NFC', text)
    text = text.lower()
    text = re.sub(r'\s+', ' ', text).strip()
    return text


# قاموس شامل لكل كلية — كل نمط مع حدود كلمة صريحة
_FACULTY_REGEX: dict[str, list[str]] = {

    # ══ كلية الطب والصيدلة وطب الأسنان ══
    "FMPOS": [
        r"\bfmpos\b",
        r"\bpcem\d?\b", r"\bpcep\d?\b",
        r"\bm[eé]decine\b", r"\bmedical\b",
        r"\bpharmac(ie|y)\b",
        r"\bodontologie\b", r"\bdentiste\b", r"\bdentaire\b",
        r"\bnursing\b", r"\bchirurgie\b",
        r"\bالطب\b", r"\bطب\b",
        r"\bصيدلة\b", r"\bأسنان\b", r"\bطبيب\b",
        r"\bتمريض\b", r"\bجراحة\b",
        r"السنة الطبية", r"تحضيرية طبية",
        r"numérus clausus", r"طب بشري", r"طب عام",
        r"\bسريري[ةا]?\b",
    ],

    # ══ كلية الحقوق والعلوم السياسية ══
    "FSJP": [
        r"\bfsjp\b",
        r"\bdroit\b",
        r"sciences?\s+politiques?",
        r"\bjuridique\b", r"\bjudiciaire\b",
        r"droit\s+des\s+affaires",
        r"droit\s+priv[eé]", r"droit\s+public",
        r"administration\s+publique",
        r"carri[eè]res?\s+judiciaires?",
        r"\bالحقوق\b", r"\bحقوق\b",
        r"علوم\s+سياسية",
        r"\bقانون\b", r"\bالقانون\b",
        r"\bقانوني[ةة]?\b",
        r"إدارة\s+عمومية",
        r"الإدارة\s+العمومية",
        r"القانون\s+المدني",
        r"القانون\s+التجاري",
        r"القانون\s+العام",
    ],

    # ══ كلية الاقتصاد والتسيير ══
    "FEG": [
        r"\bfeg\b",
        r"\b[eé]conomie\b",
        r"sciences?\s+[eé]conomiques?",
        r"\bgestion\b",
        r"\bfinance\b",
        r"\bcomptabilit[eé]\b",
        r"\bbanques?\b", r"\bassurance\b",
        r"ressources\s+humaines",
        r"\bmarketing\b", r"\bmanagement\b",
        r"gestion\s+des\s+(entreprises?|projets?|ressources?)",
        r"techniques?\s+de\s+gestion",
        r"\bالاقتصاد\b", r"\bاقتصاد\b",
        r"\bالتسيير\b", r"\bتسيير\b",
        r"\bمالية\b", r"\bمحاسبة\b",
        r"\bبنوك\b", r"\bالتأمين\b",
        r"موارد\s+بشرية",
        r"تسيير\s+المؤسسات",
        r"مشاريع\s+عمومية",
        r"إدارة\s+أعمال",
        r"علوم\s+اقتصادية",
    ],

    # ══ كلية الآداب والعلوم الإنسانية ══
    "FLSH": [
        r"\bflsh\b",
        r"\blettres\b",
        r"sciences?\s+humaines?",
        r"\bhistoire\b",
        r"\bg[eé]ographie\b",
        r"\bphilosophie\b",
        r"\bsociologie\b",
        r"\banthropologie\b",
        r"\blinguistique\b",
        r"\bpsychologie\b",
        r"\blitt[eé]rature\b",
        r"\bالآداب\b", r"\bآداب\b",
        r"\bالأدب\b", r"أدب\s+عربي",
        r"\bتاريخ\b", r"\bالتاريخ\b",
        r"\bجغرافيا\b", r"\bالجغرافيا\b",
        r"\bفلسفة\b", r"\bالفلسفة\b",
        r"علم\s+الاجتماع",
        r"اللغة\s+العربية",
        r"اللغة\s+الفرنسية",
        r"اللغة\s+الإنجليزية",
        r"اللغة\s+الإسبانية",
        r"اللغة\s+التركية",
        r"اللغة\s+الصينية",
        r"اللغات\s+الوطنية",
        r"عمل\s+اجتماعي",
        r"تنمية\s+محلية",
        r"البيئة\s+والتنمية",
        r"\bأنثروبولوجيا\b", r"\bلسانيات\b",
    ],

    # ══ كلية العلوم والتقنيات ══
    "FST": [
        r"\bfst\b",
        r"sciences?\s+et\s+techniques?",
        r"علوم\s+والتقنيات",
        r"كلية\s+العلوم\s+والتقنيات",
        # دورات تحضيرية
        r"\bmpi\b",
        r"\bcycle\s+bg\b", r"\bbranche\s+bg\b", r"bg\s+fst",
        # شعب الإجازة الأساسية
        r"\bbmp\b", r"\bboe\b",
        # كودات الإجازة المهنية (مميزة ومحددة)
        r"\bgeomin\b",
        r"\bmiage\b", r"\bda2i\b",
        r"\bpepe\b", r"\bipg\b",
        r"\babc\b", r"\btser\b",
        r"\beea\b", r"\btpgm\b",
        # كودات الماستر
        r"\bbees\b", r"\bbmpb\b", r"\bbomvrh\b",
        r"\btassmq\b", r"\bisdr\b",
        r"ia[_\-](mlds|nlpcv)",
        r"ma[_\-]imcs",
        r"\bsdd\b",
        # تخصصات الدكتوراه والإجازة
        r"\bmath[eé]matiques?\b", r"\bmaths?\b",
        r"\binformatique\b",
        r"\bphysique\b",
        r"\bchimie\b",
        r"\bbiologie\b",
        r"\bg[eé]ologie\b",
        # العربية
        r"\bرياضيات\b", r"\bالرياضيات\b",
        r"\bمعلوماتية\b", r"إعلام\s+آلي",
        r"\bفيزياء\b", r"\bالفيزياء\b",
        r"\bكيمياء\b", r"\bالكيمياء\b",
        r"\bأحياء\b", r"علم\s+الحياة",
        r"\bجيولوجيا\b",
        r"concours\s+fst", r"\bكونكور\b",
    ],
}

# تجميع الأنماط مسبقًا
_COMPILED_FACULTY_REGEX: dict[str, list[re.Pattern]] = {
    fac: [re.compile(p, re.IGNORECASE | re.UNICODE) for p in patterns]
    for fac, patterns in _FACULTY_REGEX.items()
}

# ترتيب الأولوية عند تساوي النقاط (من الأكثر تخصصًا)
_FACULTY_PRIORITY_ORDER = ["FMPOS", "FSJP", "FEG", "FLSH", "FST"]
_PRIORITY_INDEX = {fac: i for i, fac in enumerate(_FACULTY_PRIORITY_ORDER)}


def detect_faculty(message: str) -> str | None:
    """
    اكتشاف الكلية الأم — نظام التسجيل (Scoring) مع الأولوية عند التعادل.
    يدعم: العربية، الفرنسية، الاختصارات، النصوص المختلطة.
    """
    if not message:
        return None

    normalized = normalize_text(message)

    scores: dict[str, int] = {}
    for fac, patterns in _COMPILED_FACULTY_REGEX.items():
        count = sum(1 for p in patterns if p.search(normalized))
        if count > 0:
            scores[fac] = count

    if not scores:
        return None

    return min(scores, key=lambda f: (-scores[f], _PRIORITY_INDEX[f]))


def migrate_unknown_to_chat_logs() -> None:
    """
    ترحيل الأسئلة غير المجابة القديمة إلى chat_logs
    يعمل مرة واحدة فقط إذا كانت chat_logs فارغة.
    """
    with get_db() as conn:
        if conn.execute("SELECT COUNT(*) FROM chat_logs").fetchone()[0] > 0:
            return
        rows = conn.execute(
            "SELECT question, sender_id, timestamp FROM unknown_questions"
        ).fetchall()
        if not rows:
            return
        for row in rows:
            conn.execute(
                "INSERT INTO chat_logs (message, sender_id, timestamp, faculty) VALUES (?,?,?,?)",
                (row["question"], row["sender_id"], row["timestamp"],
                 detect_faculty(row["question"]))
            )
        conn.commit()
        logger.info(f"[DB] ✓ تم ترحيل {len(rows)} سؤال من unknown_questions إلى chat_logs")


# ── تهيئة قاعدة البيانات عند بدء التشغيل ──
init_db()
migrate_from_json()
migrate_unknown_to_chat_logs()


# ══════════════════════════════════════════════════════════════
#  FALLBACK DETECTION — كشف ردود Rasa غير المفهومة
# ══════════════════════════════════════════════════════════════

# يمكن تخصيص هذه القائمة عبر متغير البيئة FALLBACK_KEYWORDS (مفصولة بـ |)
_DEFAULT_FALLBACK_KW = (
    "لم أفهم|لا أفهم|لا أعرف|عذراً لا أملك|لست متأكد|"
    "لا يمكنني الإجابة|غير متأكد|لا توجد معلومات|"
    "je ne comprends|désolé|je ne sais pas|je n'ai pas|"
    "I don't understand|I don't know"
)
_FALLBACK_KW = [
    k.strip().lower()
    for k in os.environ.get("FALLBACK_KEYWORDS", _DEFAULT_FALLBACK_KW).split("|")
    if k.strip()
]

def is_fallback_response(text: str) -> bool:
    """True إذا بدت استجابة Rasa غير مفهومة (fallback)."""
    stripped = text.strip()
    if stripped in ("...", "", "…"):
        return True
    t = stripped.lower()
    return any(kw in t for kw in _FALLBACK_KW)


def auto_save_unknown(question: str, sender_id: str) -> None:
    """حفظ سؤال غير مجاب تلقائياً — بدون تكرار حقيقي."""
    try:
        with get_db() as conn:
            existing = conn.execute(
                "SELECT id FROM unknown_questions WHERE question = ? AND admin_reply IS NULL LIMIT 1",
                (question,)
            ).fetchone()
            if existing:
                logger.info(f"[auto-save] سؤال موجود مسبقاً بدون رد: {question[:60]}")
                return
            conn.execute(
                """INSERT INTO unknown_questions (question, timestamp, sender_id)
                   VALUES (?, ?, ?)""",
                (question, datetime.utcnow().isoformat(), sender_id)
            )
            conn.commit()
        logger.info(f"[auto-save] سؤال غير مجاب تلقائياً: {question[:60]}")
    except Exception as exc:
        logger.error(f"[auto-save] خطأ: {exc}")


# ══════════════════════════════════════════════════════════════
#  HELPERS
# ══════════════════════════════════════════════════════════════

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
    now    = datetime.utcnow().timestamp()
    active = {k: v for k, v in _active_sessions.items()
              if now - v < SESSION_TIMEOUT}
    _active_sessions.clear()
    _active_sessions.update(active)
    return len(active)


# ══════════════════════════════════════════════════════════════
#  ROUTES — Général
# ══════════════════════════════════════════════════════════════

@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "service":  "UNA Chatbot API",
        "version":  "3.0.0",
        "status":   "running",
        "database": DB_PATH,
    })


@app.route("/health", methods=["GET"])
def health():
    with get_db() as conn:
        total    = conn.execute("SELECT COUNT(*) FROM unknown_questions").fetchone()[0]
        replied  = conn.execute(
            "SELECT COUNT(*) FROM unknown_questions WHERE admin_reply IS NOT NULL"
        ).fetchone()[0]
    return jsonify({
        "status":           "ok",
        "timestamp":        datetime.utcnow().isoformat(),
        "questions_count":  total,
        "replied_count":    replied,
        "unanswered_count": total - replied,
        "active_users":     get_active_count(),
        "database":         DB_PATH,
        "db_exists":        os.path.exists(DB_PATH),
    })


@app.route("/ping", methods=["POST"])
def ping():
    """
    تفعيل الحفاظ على الاتصال فقط — لا يسجل المستخدم كنشط.
    النشاط الفعلي يُسجل فقط عند /chat
    """
    return jsonify({
        "status":       "ok",
        "timestamp":    datetime.utcnow().isoformat(),
>>>>>>> 4a0ddd94e10f02748826847e6a01c62f10e47190
    })


@app.route("/active-users", methods=["GET"])
def active_users():
    return jsonify({
        "active_users": get_active_count(),
        "timestamp":    datetime.utcnow().isoformat(),
    })


# ══════════════════════════════════════════════════════════════
#  ROUTE — Chat
# ══════════════════════════════════════════════════════════════

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

    # ── تسجيل التفاعل في chat_logs (قبل إرسال الرد) ──────────
    faculty = detect_faculty(user_message)
    try:
        with get_db() as conn:
            conn.execute(
                "INSERT INTO chat_logs (message, sender_id, timestamp, faculty) VALUES (?,?,?,?)",
                (user_message, sender, datetime.utcnow().isoformat(), faculty)
            )
            conn.commit()
    except Exception as log_err:
        logger.warning(f"[chat_logs] خطأ في التسجيل: {log_err}")
    # ─────────────────────────────────────────────────────────

    try:
        reply = ask_rasa(user_message, sender)

        # ── كشف وحفظ تلقائي لأسئلة Rasa غير المفهومة ──────────
        fallback = is_fallback_response(reply)
        if fallback:
            auto_save_unknown(user_message, sender)
        # ────────────────────────────────────────────────────────

        return jsonify({
            "reply":        reply,
            "sender":       sender,
            "active_users": get_active_count(),
            "is_fallback":  fallback,
        })
    except requests.Timeout:
        auto_save_unknown(user_message, sender)
        return jsonify({"reply": "⏱ انتهت مهلة الاتصال، حاول مجدداً."}), 504
    except requests.ConnectionError:
        auto_save_unknown(user_message, sender)
        return jsonify({"reply": "⚠ تعذّر الاتصال بالخادم، يُرجى المحاولة لاحقاً."}), 503
    except Exception as e:
        logger.exception(e)
        return jsonify({"reply": f"⚠ خطأ: {str(e)}"}), 500


# ══════════════════════════════════════════════════════════════
#  ROUTES — Unknown Questions (CRUD + Reply)
# ══════════════════════════════════════════════════════════════

@app.route("/save-unknown-question", methods=["POST"])
def save_unknown_question():
    """حفظ سؤال غير مجاب — بدون تكرار حقيقي."""
    data      = request.get_json(silent=True) or {}
    question  = data.get("question", "").strip()
    sender_id = data.get("sender_id") or data.get("sender")

    if not question:
        return jsonify({"error": "question is required"}), 400

    with get_db() as conn:
        existing = conn.execute(
            "SELECT id FROM unknown_questions WHERE question = ? AND admin_reply IS NULL LIMIT 1",
            (question,)
        ).fetchone()
        if existing:
            total = conn.execute(
                "SELECT COUNT(*) FROM unknown_questions"
            ).fetchone()[0]
            return jsonify({"status": "duplicate", "count": total})

        cursor = conn.execute(
            """INSERT INTO unknown_questions (question, timestamp, sender_id)
               VALUES (?, ?, ?)""",
            (question, datetime.utcnow().isoformat(), sender_id)
        )
        conn.commit()
        new_id = cursor.lastrowid
        total  = conn.execute(
            "SELECT COUNT(*) FROM unknown_questions"
        ).fetchone()[0]

    logger.info(f"[save] سؤال جديد id={new_id}: {question[:60]}")
    return jsonify({"status": "saved", "id": new_id, "count": total})


@app.route("/unknown-questions", methods=["GET"])
def get_questions():
    """إرجاع جميع الأسئلة بترتيب زمني."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM unknown_questions ORDER BY timestamp ASC"
        ).fetchall()
    return jsonify([row_to_dict(r) for r in rows])


@app.route("/unknown-questions/grouped", methods=["GET"])
def get_questions_grouped():
    """إرجاع الأسئلة مجمّعةً حسب النص — مع عدد التكرارات."""
    with get_db() as conn:
        rows = conn.execute("""
            SELECT
                question,
                COUNT(*)        AS count,
                MIN(id)         AS first_id,
                MAX(id)         AS latest_id,
                MIN(timestamp)  AS first_seen,
                MAX(timestamp)  AS last_seen,
                MAX(admin_reply)  AS admin_reply,
                MAX(replied_at)   AS replied_at,
                MAX(sender_id)    AS sender_id
            FROM unknown_questions
            GROUP BY question
            ORDER BY MAX(timestamp) DESC
        """).fetchall()
    return jsonify([row_to_dict(r) for r in rows])


@app.route("/unknown-questions/stats", methods=["GET"])
def get_stats():
    """إحصائيات مفصلة لقاعدة البيانات."""
    with get_db() as conn:
        total   = conn.execute("SELECT COUNT(*) FROM unknown_questions").fetchone()[0]
        replied = conn.execute(
            "SELECT COUNT(*) FROM unknown_questions WHERE admin_reply IS NOT NULL"
        ).fetchone()[0]
        today   = conn.execute(
            "SELECT COUNT(*) FROM unknown_questions WHERE DATE(timestamp) = DATE('now')"
        ).fetchone()[0]
        week    = conn.execute(
            "SELECT COUNT(*) FROM unknown_questions WHERE timestamp >= datetime('now','-7 days')"
        ).fetchone()[0]
        # آخر 5 أسئلة
        recent  = conn.execute(
            "SELECT id, question, timestamp FROM unknown_questions ORDER BY id DESC LIMIT 5"
        ).fetchall()
    return jsonify({
        "total":          total,
        "replied":        replied,
        "unanswered":     total - replied,
        "today":          today,
        "last_7_days":    week,
        "reply_rate_pct": round((replied / total * 100) if total else 0, 1),
        "recent":         [row_to_dict(r) for r in recent],
    })


@app.route("/unknown-questions/reply", methods=["POST"])
def reply_question():
    """إضافة رد الأدمين على سؤال بواسطة ID."""
    data        = request.get_json(silent=True) or {}
    question_id = data.get("question_id")
    reply_text  = (data.get("reply") or "").strip()

    if not question_id:
        return jsonify({"error": "question_id is required"}), 400
    if not reply_text:
        return jsonify({"error": "reply is required"}), 400

    with get_db() as conn:
        row = conn.execute(
            "SELECT id FROM unknown_questions WHERE id = ?", (question_id,)
        ).fetchone()
        if not row:
            return jsonify({"error": f"Question {question_id} not found"}), 404

        conn.execute(
            """UPDATE unknown_questions
               SET admin_reply = ?, replied_at = ?
               WHERE id = ?""",
            (reply_text, datetime.utcnow().isoformat(), question_id)
        )
        conn.commit()

    logger.info(f"[reply] id={question_id} → {reply_text[:60]}")
    return jsonify({
        "status":      "replied",
        "id":          question_id,
        "admin_reply": reply_text,
        "replied_at":  datetime.utcnow().isoformat(),
    })


@app.route("/unknown-questions/by-question", methods=["DELETE"])
def delete_by_question():
    """حذف جميع نسخ سؤال معيّن (حسب نص السؤال)."""
    data     = request.get_json(silent=True) or {}
    question = data.get("question", "").strip()
    if not question:
        return jsonify({"error": "question is required"}), 400

    with get_db() as conn:
        count = conn.execute(
            "SELECT COUNT(*) FROM unknown_questions WHERE question = ?", (question,)
        ).fetchone()[0]
        if count == 0:
            return jsonify({"error": "Question not found"}), 404
        conn.execute("DELETE FROM unknown_questions WHERE question = ?", (question,))
        conn.commit()

    logger.info(f"[DELETE by-question] {count} نسخة محذوفة: {question[:60]}")
    return jsonify({"status": "deleted", "count": count, "question": question})


@app.route("/unknown-questions/<int:qid>", methods=["DELETE"])
def delete_question(qid: int):
    """حذف سؤال واحد بواسطة ID."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM unknown_questions WHERE id = ?", (qid,)
        ).fetchone()
        if not row:
            return jsonify({"error": f"Question {qid} not found"}), 404

        conn.execute("DELETE FROM unknown_questions WHERE id = ?", (qid,))
        conn.commit()

    logger.info(f"[DELETE] id={qid} حُذف")
    return jsonify({"status": "deleted", "id": qid, "question": row["question"]})


@app.route("/unknown-questions/all", methods=["DELETE"])
def delete_all():
    """حذف جميع الأسئلة."""
    with get_db() as conn:
        count = conn.execute("SELECT COUNT(*) FROM unknown_questions").fetchone()[0]
        conn.execute("DELETE FROM unknown_questions")
        conn.execute("DELETE FROM sqlite_sequence WHERE name='unknown_questions'")
        conn.commit()

    logger.info(f"[DELETE ALL] {count} أسئلة محذوفة — ID counter reset")
    return jsonify({"status": "deleted", "count": count})


@app.route("/unknown-questions/search", methods=["GET"])
def search_questions():
    """البحث في الأسئلة."""
    q        = request.args.get("q", "").strip()
    answered = request.args.get("answered")  # "true" / "false" / None

    query  = "SELECT * FROM unknown_questions WHERE 1=1"
    params = []

    if q:
        query  += " AND question LIKE ?"
        params.append(f"%{q}%")

    if answered == "true":
        query += " AND admin_reply IS NOT NULL"
    elif answered == "false":
        query += " AND admin_reply IS NULL"

    query += " ORDER BY timestamp DESC"

    with get_db() as conn:
        rows = conn.execute(query, params).fetchall()

    return jsonify([row_to_dict(r) for r in rows])


@app.route("/faculty-stats", methods=["GET"])
def faculty_stats():
    """إحصائيات نشاط الكليات — مبنية على جميع تفاعلات المستخدمين (chat_logs)."""
    colors = {
        "FST":   "#3b82f6",
        "FLSH":  "#10b981",
        "FMPOS": "#f97316",
        "FSJP":  "#8b5cf6",
        "FEG":   "#eab308",
    }
    with get_db() as conn:
        rows = conn.execute("""
            SELECT faculty, COUNT(*) AS count
            FROM chat_logs
            WHERE faculty IS NOT NULL
            GROUP BY faculty
        """).fetchall()

    counts = {f: 0 for f in colors}
    for row in rows:
        if row["faculty"] in counts:
            counts[row["faculty"]] = row["count"]

    result = sorted(
        [{"name": k, "count": v, "color": colors[k]} for k, v in counts.items()],
        key=lambda x: -x["count"]
    )
    return jsonify(result)


@app.route("/rasa-health", methods=["GET"])
def rasa_health():
    """التحقق من حالة خادم Rasa بشكل مستقل."""
    rasa_base = RASA_URL.split("/webhooks")[0]
    try:
        r = requests.get(rasa_base, timeout=3)
        ok = r.status_code < 500
    except Exception:
        ok = False
    return jsonify({"ok": ok, "url": rasa_base})


# ══════════════════════════════════════════════════════════════
#  ENTRY POINT
# ══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    logger.info(f"Flask على المنفذ :{port}")
    logger.info(f"قاعدة البيانات: {DB_PATH}")
    app.run(host="0.0.0.0", port=port, debug=False)
