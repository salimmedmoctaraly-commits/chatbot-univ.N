"""
db_manager.py — أداة إدارة قاعدة بيانات الأسئلة الغير مجابة
الاستخدام:
    python db_manager.py show          # عرض كل الأسئلة
    python db_manager.py stats         # إحصائيات
    python db_manager.py search <نص>   # بحث
    python db_manager.py export <file> # تصدير CSV
    python db_manager.py reset         # حذف الكل (مع تأكيد)
"""

import sqlite3
import csv
import sys
import os
from datetime import datetime

# ── مسار قاعدة البيانات ──────────────────────────────────────
def get_db_path() -> str:
    if os.environ.get("DB_FILE"):
        return os.environ["DB_FILE"]
    if os.path.exists("/data"):
        return "/data/chatbot.db"
    base   = os.path.dirname(os.path.abspath(__file__))
    shared = os.path.join(base, "shared")
    return os.path.join(shared, "chatbot.db")

DB_PATH = get_db_path()


def get_db() -> sqlite3.Connection:
    if not os.path.exists(DB_PATH):
        print(f"❌ قاعدة البيانات غير موجودة: {DB_PATH}")
        print("   شغّل Flask أولاً لإنشائها تلقائياً.")
        sys.exit(1)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def cmd_show(args):
    """عرض الأسئلة."""
    limit  = int(args[0]) if args else 50
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM unknown_questions ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
    if not rows:
        print("لا توجد أسئلة في قاعدة البيانات.")
        return
    print(f"\n{'ID':>4}  {'التاريخ':<22}  {'الرد':^8}  {'السؤال'}")
    print("─" * 80)
    for r in rows:
        replied = "✓" if r["admin_reply"] else "✗"
        ts = r["timestamp"][:19] if r["timestamp"] else "—"
        print(f"{r['id']:>4}  {ts:<22}  {replied:^8}  {r['question'][:50]}")
    print(f"\n{len(rows)} سؤال معروض (الأحدث أولاً)")


def cmd_stats(args):
    """عرض الإحصائيات."""
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
        oldest  = conn.execute(
            "SELECT timestamp FROM unknown_questions ORDER BY id ASC LIMIT 1"
        ).fetchone()
        newest  = conn.execute(
            "SELECT timestamp FROM unknown_questions ORDER BY id DESC LIMIT 1"
        ).fetchone()
    rate = round(replied / total * 100, 1) if total else 0
    print(f"""
╔══════════════════════════════════════╗
║   إحصائيات قاعدة البيانات            ║
╠══════════════════════════════════════╣
║  إجمالي الأسئلة   : {total:<16}║
║  أسئلة مُجابة     : {replied:<16}║
║  أسئلة غير مُجابة : {total-replied:<16}║
║  معدل الإجابة     : {str(rate)+' %':<16}║
╠══════════════════════════════════════╣
║  اليوم            : {today:<16}║
║  آخر 7 أيام      : {week:<16}║
╠══════════════════════════════════════╣
║  أقدم سؤال       : {(oldest[0][:10] if oldest else '—'):<16}║
║  أحدث سؤال       : {(newest[0][:10] if newest else '—'):<16}║
╚══════════════════════════════════════╝
الملف: {DB_PATH}
""")


def cmd_search(args):
    """بحث في الأسئلة."""
    if not args:
        print("الاستخدام: python db_manager.py search <كلمة>")
        return
    keyword = " ".join(args)
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM unknown_questions WHERE question LIKE ? ORDER BY id DESC",
            (f"%{keyword}%",)
        ).fetchall()
    if not rows:
        print(f"لا نتائج لـ '{keyword}'")
        return
    print(f"\n{len(rows)} نتيجة لـ '{keyword}':\n")
    for r in rows:
        ts      = r["timestamp"][:16] if r["timestamp"] else "—"
        replied = "✓ " + r["admin_reply"][:40] if r["admin_reply"] else "✗ بدون رد"
        print(f"[{r['id']}] {ts}  {r['question'][:60]}")
        print(f"       → {replied}\n")


def cmd_export(args):
    """تصدير إلى CSV."""
    filename = args[0] if args else f"questions_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM unknown_questions ORDER BY id ASC"
        ).fetchall()
    if not rows:
        print("لا توجد بيانات للتصدير.")
        return
    with open(filename, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(["ID", "السؤال", "التاريخ", "sender_id", "الرد", "تاريخ الرد"])
        for r in rows:
            writer.writerow([
                r["id"], r["question"], r["timestamp"],
                r["sender_id"] or "",
                r["admin_reply"] or "",
                r["replied_at"] or ""
            ])
    print(f"✓ تم التصدير إلى {filename} ({len(rows)} صف)")


def cmd_reset(args):
    """حذف جميع الأسئلة."""
    with get_db() as conn:
        count = conn.execute("SELECT COUNT(*) FROM unknown_questions").fetchone()[0]
    print(f"⚠ سيتم حذف {count} سؤال نهائياً من قاعدة البيانات.")
    confirm = input("اكتب YES للتأكيد: ").strip()
    if confirm != "YES":
        print("تم الإلغاء.")
        return
    with get_db() as conn:
        conn.execute("DELETE FROM unknown_questions")
        conn.execute("DELETE FROM sqlite_sequence WHERE name='unknown_questions'")
        conn.commit()
    print(f"✓ تم حذف {count} سؤال وإعادة تعيين الـ ID.")


def cmd_help():
    print(__doc__)


# ── Main ─────────────────────────────────────────────────────
COMMANDS = {
    "show":   cmd_show,
    "stats":  cmd_stats,
    "search": cmd_search,
    "export": cmd_export,
    "reset":  cmd_reset,
    "help":   lambda _: cmd_help(),
}

if __name__ == "__main__":
    argv = sys.argv[1:]
    if not argv:
        cmd_help()
        sys.exit(0)

    cmd  = argv[0].lower()
    rest = argv[1:]

    if cmd in COMMANDS:
        COMMANDS[cmd](rest)
    else:
        print(f"أمر غير معروف: '{cmd}'")
        cmd_help()
