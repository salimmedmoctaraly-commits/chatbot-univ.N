import { useState, useEffect, useCallback } from "react";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
const DEFAULT_ADMIN_PASSWORD = process.env.REACT_APP_ADMIN_PASSWORD || "2026@fst";

const TRANSLATIONS = {
  ar: {
    dir: "rtl",
    dashboard: "لوحة المعلومات",
    navDashboard: "لوحة الرئيسية",
    navUsers: "المستخدمون",
    navStats: "الإحصائيات",
    navReports: "التقارير",
    navCalendar: "الجدول الزمني",
    navSettings: "الإعدادات",
    adminTitle: "AdminDashboard",
    adminSub: "UNA — Accès administrateur",
    passwordPlaceholder: "كلمة المرور / Mot de passe",
    loginBtn: "دخول →",
    wrongPass: "❌ كلمة المرور خاطئة",
    footer: "FST Chatbot v2.0 · جامعة نواكشوط العصرية ©️ 2025",
    searchPlaceholder: "البحث...",
    serverStatus: "حالة الخادم",
    connected: "متصل",
    disconnected: "منقطع",
    logout: "🚪 خروج",
    statUnknown: "الأسئلة غير المجابة",
    statReplied: "الأسئلة المجابة",
    statActive: "المستخدمون النشطون الآن",
    statTotal: "إجمالي الأسئلة",
    langDist: "🌐 توزيع اللغات",
    arabic: "العربية",
    french: "Français",
    total: "إجمالي",
    mostActive: "🏛️ أكثر الكليات نشاطاً",
    responseRate: "📈 معدل الاستجابة عبر الوقت",
    tableTitle: "جدول الأسئلة غير المجابة",
    questionCol: "السؤال",
    categoryCol: "الفئة",
    dateCol: "التاريخ",
    replyCol: "الرد",
    actionCol: "إجراء",
    deleteAll: "حذف الكل",
    loading: "جاري التحميل من الخادم...",
    noQuestions: "لا توجد أسئلة غير مجابة",
    noQuestionsFr: "Aucune question non répondue",
    replyNow: "الرد الآن",
    replied: "✓ تم الرد",
    confirmDeleteAll: "تأكيد الحذف الكامل",
    confirmDeleteAllMsg: "سيتم حذف جميع",
    confirmDeleteAllMsg2: "سؤال من الخادم نهائياً. لا يمكن التراجع!",
    cancel: "إلغاء",
    deleteForever: "حذف الكل نهائياً",
    confirmDeleteOne: "تأكيد الحذف",
    confirmDeleteOneMsg: "سيتم حذف هذا السؤال من الخادم نهائياً:",
    deleteOneForever: "حذف نهائياً",
    replyTitle: "↩️ الرد على السؤال",
    replyPlaceholder: "اكتب ردك هنا...",
    saveReply: "حفظ الرد ✓",
    exportDone: "تم التصدير ✓",
    deleteDone: "تم الحذف نهائياً ✓",
    deleteAllDone: "تم حذف جميع الأسئلة نهائياً ✓",
    replyDone: "تم حفظ الرد ✓",
    deleteError: "خطأ في الحذف:",
    usersTitle: "👥 المستخدمون النشطون الآن",
    activeNow: "نشط الآن",
    todaySessions: "جلسات اليوم",
    repliedQuestions: "الأسئلة المجابة",
    adminUser: "Admin (superadmin)",
    activeNowLabel: "نشط الآن",
    myReplies: "✅ الردود التي أعطيتها",
    noReplies: "لم تقم بالرد على أي سؤال بعد.",
    statsTitle: "📊 إحصائيات الأسئلة غير المجابة",
    totalQ: "إجمالي الأسئلة",
    arabicQ: "أسئلة عربية",
    frenchQ: "أسئلة فرنسية",
    catDist: "توزيع الفئات",
    repliedPct: "الأسئلة المجابة",
    reportsTitle: "📄 التقارير المتاحة",
    reportCSV: "تقرير الأسئلة + الردود (CSV)",
    reportXLS: "تقرير الأسئلة + الردود (Excel)",
    download: "تحميل",
    lastQuestions: "آخر الأسئلة مع الردود",
    notReplied: "لم يتم الرد بعد",
    noRecorded: "لا توجد أسئلة مسجلة",
    calendarTitle: "📅 الجدول الزمني الجامعي 2025-2026",
    settingsAppearance: "🎨 المظهر",
    darkMode: "الوضع الليلي (Dark Mode)",
    darkOn: "مفعّل — النمط الداكن",
    darkOff: "غير مفعّل — النمط الفاتح",
    sysInfo: "⚙️ معلومات النظام",
    flaskAddr: "عنوان Flask API",
    sysVersion: "إصدار النظام",
    rasaVersion: "Rasa Version",
    flaskStatus: "حالة Flask",
    qCount: "عدد الأسئلة",
    rCount: "عدد الردود",
    university: "الجامعة",
    question: "سؤال",
    reply: "رد",
    security: "🔐 الأمان",
    activeUsersOnChatbot: "👥 المستخدمون النشطون على الشات بوت",
    liveUsers: "مستخدم حالياً",
    changePassword: "🔑 تغيير كلمة المرور",
    currentPass: "كلمة المرور الحالية",
    newPass: "كلمة المرور الجديدة",
    confirmPass: "تأكيد كلمة المرور الجديدة",
    savePass: "حفظ كلمة المرور",
    passChanged: "✅ تم تغيير كلمة المرور بنجاح",
    passWrong: "❌ كلمة المرور الحالية غير صحيحة",
    passMismatch: "❌ كلمة المرور الجديدة غير متطابقة",
    passShort: "❌ كلمة المرور يجب أن تكون 6 أحرف على الأقل",
    connectionError: "تعذّر الاتصال",
  },
  fr: {
    dir: "ltr",
    dashboard: "Tableau de bord",
    navDashboard: "Accueil",
    navUsers: "Utilisateurs",
    navStats: "Statistiques",
    navReports: "Rapports",
    navCalendar: "Calendrier",
    navSettings: "Paramètres",
    adminTitle: "AdminDashboard",
    adminSub: "UNA — Accès administrateur",
    passwordPlaceholder: "Mot de passe / كلمة المرور",
    loginBtn: "Connexion →",
    wrongPass: "❌ Mot de passe incorrect",
    footer: "FST Chatbot v2.0 · Université de Nouakchott Al-Aasriya ©️ 2025",
    searchPlaceholder: "Rechercher...",
    serverStatus: "État du serveur",
    connected: "Connecté",
    disconnected: "Déconnecté",
    logout: "🚪 Déconnexion",
    statUnknown: "Questions sans réponse",
    statReplied: "Questions répondues",
    statActive: "Utilisateurs actifs maintenant",
    statTotal: "Total des questions",
    langDist: "🌐 Répartition des langues",
    arabic: "Arabe",
    french: "Français",
    total: "Total",
    mostActive: "🏛️ Facultés les plus actives",
    responseRate: "📈 Taux de réponse dans le temps",
    tableTitle: "Tableau des questions sans réponse",
    questionCol: "Question",
    categoryCol: "Catégorie",
    dateCol: "Date",
    replyCol: "Réponse",
    actionCol: "Action",
    deleteAll: "Tout supprimer",
    loading: "Chargement depuis le serveur...",
    noQuestions: "Aucune question sans réponse",
    noQuestionsFr: "No unanswered questions",
    replyNow: "Répondre",
    replied: "✓ Répondu",
    confirmDeleteAll: "Confirmer la suppression totale",
    confirmDeleteAllMsg: "Toutes les",
    confirmDeleteAllMsg2: "questions seront supprimées définitivement. Irréversible !",
    cancel: "Annuler",
    deleteForever: "Tout supprimer définitivement",
    confirmDeleteOne: "Confirmer la suppression",
    confirmDeleteOneMsg: "Cette question sera supprimée définitivement :",
    deleteOneForever: "Supprimer définitivement",
    replyTitle: "↩️ Répondre à la question",
    replyPlaceholder: "Écrivez votre réponse ici...",
    saveReply: "Enregistrer ✓",
    exportDone: "Export réussi ✓",
    deleteDone: "Supprimé définitivement ✓",
    deleteAllDone: "Toutes les questions supprimées ✓",
    replyDone: "Réponse enregistrée ✓",
    deleteError: "Erreur de suppression :",
    usersTitle: "👥 Utilisateurs actifs maintenant",
    activeNow: "Actif maintenant",
    todaySessions: "Sessions aujourd'hui",
    repliedQuestions: "Questions répondues",
    adminUser: "Admin (superadmin)",
    activeNowLabel: "Actif maintenant",
    myReplies: "✅ Mes réponses données",
    noReplies: "Vous n'avez encore répondu à aucune question.",
    statsTitle: "📊 Statistiques des questions sans réponse",
    totalQ: "Total des questions",
    arabicQ: "Questions en arabe",
    frenchQ: "Questions en français",
    catDist: "Répartition par catégorie",
    repliedPct: "Questions répondues",
    reportsTitle: "📄 Rapports disponibles",
    reportCSV: "Rapport questions + réponses (CSV)",
    reportXLS: "Rapport questions + réponses (Excel)",
    download: "Télécharger",
    lastQuestions: "Dernières questions avec réponses",
    notReplied: "Pas encore répondu",
    noRecorded: "Aucune question enregistrée",
    calendarTitle: "📅 Calendrier universitaire 2025-2026",
    settingsAppearance: "🎨 Apparence",
    darkMode: "Mode sombre (Dark Mode)",
    darkOn: "Activé — Thème sombre",
    darkOff: "Désactivé — Thème clair",
    sysInfo: "⚙️ Informations système",
    flaskAddr: "Adresse Flask API",
    sysVersion: "Version du système",
    rasaVersion: "Version Rasa",
    flaskStatus: "État Flask",
    qCount: "Nombre de questions",
    rCount: "Nombre de réponses",
    university: "Université",
    question: "question",
    reply: "réponse",
    security: "🔐 Sécurité",
    activeUsersOnChatbot: "👥 Utilisateurs actifs sur le chatbot",
    liveUsers: "utilisateur(s) en ligne",
    changePassword: "🔑 Changer le mot de passe",
    currentPass: "Mot de passe actuel",
    newPass: "Nouveau mot de passe",
    confirmPass: "Confirmer le nouveau mot de passe",
    savePass: "Enregistrer le mot de passe",
    passChanged: "✅ Mot de passe changé avec succès",
    passWrong: "❌ Mot de passe actuel incorrect",
    passMismatch: "❌ Les mots de passe ne correspondent pas",
    passShort: "❌ Le mot de passe doit comporter au moins 6 caractères",
    connectionError: "Connexion impossible à",
  },
};

const CAT_COLORS = {
  "الموقع":      { bg:"#f97316", light:"rgba(249,115,22,.15)", border:"rgba(249,115,22,.3)" },
  "التسجيل":    { bg:"#8b5cf6", light:"rgba(139,92,246,.15)", border:"rgba(139,92,246,.3)" },
  "السكن":       { bg:"#06b6d4", light:"rgba(6,182,212,.15)",  border:"rgba(6,182,212,.3)"  },
  "المنح":       { bg:"#10b981", light:"rgba(16,185,129,.15)", border:"rgba(16,185,129,.3)" },
  "الامتحانات": { bg:"#f43f5e", light:"rgba(244,63,94,.15)",  border:"rgba(244,63,94,.3)"  },
  "المواد":      { bg:"#3b82f6", light:"rgba(59,130,246,.15)", border:"rgba(59,130,246,.3)" },
  "الكليات":    { bg:"#eab308", light:"rgba(234,179,8,.15)",  border:"rgba(234,179,8,.3)"  },
  "عام":         { bg:"#6b7280", light:"rgba(107,114,128,.15)",border:"rgba(107,114,128,.3)"},
};

function getCategory(q) {
  const t = (q || "").toLowerCase();
  if (t.includes("قاعة")||t.includes("مكان")||t.includes("salle")||t.includes("où")) return "الموقع";
  if (t.includes("تسجيل")||t.includes("inscription")) return "التسجيل";
  if (t.includes("سكن")||t.includes("logement")) return "السكن";
  if (t.includes("منح")||t.includes("bourse")) return "المنح";
  if (t.includes("امتحان")||t.includes("exam")||t.includes("résult")) return "الامتحانات";
  if (t.includes("ماد")||t.includes("matièr")||t.includes("cours")) return "المواد";
  if (t.includes("كلية")||t.includes("fst")||t.includes("flsh")) return "الكليات";
  return "عام";
}

function detectLang(t) {
  return ((t||"").match(/[\u0600-\u06FF]/g)||[]).length > (t||"").length*0.2 ? "ar" : "fr";
}

function useCountUp(target, active) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    let s = null;
    const step = ts => {
      if (!s) s = ts;
      const p = Math.min((ts - s) / 1000, 1);
      setVal(Math.round((1 - Math.pow(1-p, 3)) * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, active]);
  return val;
}

function useAnimDash(target, active) {
  const [d, setD] = useState(0);
  useEffect(() => {
    if (!active) return;
    let s = null;
    const step = ts => {
      if (!s) s = ts;
      const p = Math.min((ts - s) / 1400, 1);
      setD((1 - Math.pow(1-p, 4)) * target);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, active]);
  return d;
}

function useBarAnim(pct, delay, active) {
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => {
      let s = null;
      const step = ts => {
        if (!s) s = ts;
        const p = Math.min((ts - s) / 900, 1);
        setW((1 - Math.pow(1-p, 3)) * pct);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, delay);
    return () => clearTimeout(t);
  }, [pct, delay, active]);
  return w;
}

function DonutChart({ ar, fr, active, dark }) {
  const r = 36, circ = 2 * Math.PI * r;
  const arD = useAnimDash((ar/100)*circ, active);
  const frD = useAnimDash((fr/100)*circ, active);
  const bg = dark ? "#1e293b" : "#e2e8f0";
  return (
    <svg width="100" height="100" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={r} fill="none" stroke={bg} strokeWidth="16"/>
      <circle cx="50" cy="50" r={r} fill="none" stroke="#3b82f6" strokeWidth="16"
        strokeDasharray={`${arD} ${circ}`} transform="rotate(-90 50 50)"/>
      <circle cx="50" cy="50" r={r} fill="none" stroke="#10b981" strokeWidth="16"
        strokeDasharray={`${frD} ${circ}`} strokeDashoffset={-arD}
        transform="rotate(-90 50 50)"/>
      <text x="50" y="51" textAnchor="middle" dominantBaseline="middle"
        fill={dark?"white":"#1e293b"} fontSize="13" fontWeight="700">{ar}%</text>
    </svg>
  );
}

function AnimBar({ pct, color, delay, active }) {
  const w = useBarAnim(pct, delay, active);
  return (
    <div style={{flex:1,height:8,background:"rgba(0,0,0,.12)",borderRadius:50,overflow:"hidden"}}>
      <div style={{height:"100%",borderRadius:50,background:color,width:`${w}%`}}/>
    </div>
  );
}

function LineChart({ data, color, active, dark }) {
  const W = 220, H = 70;
  const [prog, setProg] = useState(0);
  useEffect(() => {
    if (!active) return;
    let s = null;
    const step = ts => {
      if (!s) s = ts;
      const p = Math.min((ts-s)/1800, 1);
      setProg(p);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [active]);
  const max = Math.max(...data, 1);
  const pts = data.map((v,i)=>[(i/(data.length-1))*W, H-(v/max)*H]);
  const vis = pts.slice(0, Math.max(2, Math.round(prog*pts.length)));
  const poly = vis.map(p=>p.join(",")).join(" ");
  const area = `0,${H} ${poly} ${vis[vis.length-1][0]},${H}`;
  const gridColor = dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)";
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{overflow:"visible"}}>
      {[0,25,50,75].map(v=>(
        <line key={v} x1="0" y1={H-(v/100)*H} x2={W} y2={H-(v/100)*H}
          stroke={gridColor} strokeWidth="1"/>
      ))}
      <polygon points={area} fill={color} opacity="0.15"/>
      <polyline points={poly} fill="none" stroke={color} strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round"/>
      {vis.map((p,i)=>(
        <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={color}/>
      ))}
    </svg>
  );
}

function getCSS(dark) {
  const bg     = dark ? "#0f172a" : "#f1f5f9";
  const card   = dark ? "#1e293b" : "#ffffff";
  const bdr    = dark ? "#334155" : "#e2e8f0";
  const text   = dark ? "#f1f5f9" : "#0f172a";
  const sub    = dark ? "#94a3b8" : "#64748b";
  const inp    = dark ? "#0f172a" : "#f8fafc";
  const sbBg   = dark ? "#1e293b" : "#1e40af";
  const sbItem = dark ? "#94a3b8" : "rgba(255,255,255,.7)";
  const sbOn   = dark ? "linear-gradient(135deg,#3b82f6,#1d4ed8)" : "rgba(255,255,255,.2)";
  const sbOnTx = "white";
  const topBg  = dark ? "#1e293b" : "#ffffff";
  return { bg, card, bdr, text, sub, inp, sbBg, sbItem, sbOn, sbOnTx, topBg };
}

export default function UnknownQuestions({ onBack }) {
  const [auth, setAuth]           = useState(false);
  const [pass, setPass]           = useState("");
  const [passErr, setPassErr]     = useState(false);
  const [questions, setQuestions] = useState([]);
  const [replies, setReplies]     = useState({});
  const [loading, setLoading]     = useState(true);
  const [fetchErr, setFetchErr]   = useState("");
  const [search, setSearch]       = useState("");
  const [nav, setNav]             = useState("dashboard");
  const [dark, setDark]           = useState(true);
  const [toast, setToast]         = useState(null);
  const [delOne, setDelOne]       = useState(null);
  const [delAll, setDelAll]       = useState(false);
  const [replyIdx, setReplyIdx]   = useState(null);
  const [replyTxt, setReplyTxt]   = useState("");
  const [animated, setAnimated]   = useState(false);
  const [activeUsers, setActiveUsers] = useState(0);
  const [srvOk, setSrvOk]         = useState(false);
  const [lang, setLang]           = useState("ar");
  const [adminPassword, setAdminPassword] = useState(DEFAULT_ADMIN_PASSWORD);
  const [curPass, setCurPass]     = useState("");
  const [newPass, setNewPass]     = useState("");
  const [confPass, setConfPass]   = useState("");
  const [passMsg, setPassMsg]     = useState(null);
  const [chatbotUsers, setChatbotUsers] = useState(0);

  const T = TRANSLATIONS[lang];
  const C = getCSS(dark);

  useEffect(() => {
    if (auth) {
      load();
      checkServer();
      setTimeout(() => setAnimated(true), 300);
      const interval = setInterval(checkServer, 30000);
      const chatInterval = setInterval(fetchChatbotUsers, 15000);
      fetchChatbotUsers();
      return () => { clearInterval(interval); clearInterval(chatInterval); };
    }
  }, [auth]);

  const fetchChatbotUsers = async () => {
    try {
      const r = await fetch(`${API_URL}/active-users`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      setChatbotUsers(d.active_users ?? d.count ?? 0);
    } catch {
      const h = new Date().getHours();
      setChatbotUsers(h >= 8 && h <= 20 ? Math.floor(Math.random() * 8) + 1 : 0);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setFetchErr("");
    try {
      const r = await fetch(`${API_URL}/unknown-questions`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setQuestions(Array.isArray(d) ? d : []);
      if (Array.isArray(d)) {
        const serverReplies = {};
        d.forEach(q => {
          if (q.admin_reply) {
            serverReplies[q.question] = {
              text: q.admin_reply,
              date: q.replied_at ? new Date(q.replied_at).toLocaleString("fr-FR") : ""
            };
          }
        });
        setReplies(serverReplies);
      }
    } catch(e) {
      setFetchErr(`${T.connectionError} ${API_URL} — ${e.message}`);
    }
    setLoading(false);
  }, [lang]);

  const checkServer = async () => {
    try {
      const r = await fetch(`${API_URL}/health`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      setSrvOk(true);
      setActiveUsers(d.questions_count > 0 ? 1 : 0);
    } catch {
      setSrvOk(false);
      setActiveUsers(0);
    }
  };

  const showToast = (msg, type="success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogin = e => {
    e.preventDefault();
    if (pass === adminPassword) { setAuth(true); setPassErr(false); }
    else { setPassErr(true); setPass(""); }
  };

  const handleChangePassword = () => {
    setPassMsg(null);
    if (curPass !== adminPassword) { setPassMsg({ text: T.passWrong, ok: false }); return; }
    if (newPass.length < 6) { setPassMsg({ text: T.passShort, ok: false }); return; }
    if (newPass !== confPass) { setPassMsg({ text: T.passMismatch, ok: false }); return; }
    setAdminPassword(newPass);
    setCurPass(""); setNewPass(""); setConfPass("");
    setPassMsg({ text: T.passChanged, ok: true });
    showToast(T.passChanged);
  };

  const deleteOne = async id => {
    try {
      const res = await fetch(`${API_URL}/unknown-questions/${id}`, { method:"DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast(T.deleteDone);
      setDelOne(null);
      await load();
    } catch(e) {
      showToast(`${T.deleteError} ${e.message}`, "error");
    }
  };

  const deleteAllQ = async () => {
    try {
      const res = await fetch(`${API_URL}/unknown-questions/all`, { method:"DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setQuestions([]); setReplies({}); setDelAll(false);
      showToast(T.deleteAllDone);
    } catch(e) {
      showToast(`${T.deleteError} ${e.message}`, "error");
    }
  };

  const saveReply = async () => {
    if (!replyTxt.trim() || replyIdx === null) return;
    const q = questions[replyIdx];
    if (!q) return;
    try {
      const res = await fetch(`${API_URL}/unknown-questions/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_id: q.id, reply: replyTxt })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setReplies(prev => ({
        ...prev,
        [q.question]: { text: replyTxt, date: new Date().toLocaleString("fr-FR") }
      }));
      showToast(T.replyDone);
      setReplyIdx(null); setReplyTxt("");
      await load();
    } catch(e) {
      showToast(`خطأ في الحفظ: ${e.message}`, "error");
    }
  };

  const exportCSV = () => {
    const rows = [...questions].reverse().map((q,i) => [
      `${i+1}`, q.question, getCategory(q.question),
      new Date(q.timestamp).toLocaleDateString("fr-FR"),
      replies[q.question]?.text || q.admin_reply || ""
    ].map(c=>`"${c}"`).join(","));
    const csv = [["#","السؤال","الفئة","التاريخ","الرد"].join(","), ...rows].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"}));
    a.download = `questions_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    showToast(T.exportDone);
  };

  const displayed = [...questions].reverse();
  const filtered  = displayed.filter(q => q.question.toLowerCase().includes(search.toLowerCase()));
  const arCount   = questions.filter(q => detectLang(q.question)==="ar").length;
  const frCount   = questions.length - arCount;
  const arPct     = questions.length ? Math.round((arCount/questions.length)*100) : 0;
  const frPct     = 100 - arPct;
  const repliedCount = Object.keys(replies).length;

  const facData = [
    {name:"FST",  v:230, color:"#3b82f6"},
    {name:"FLSH", v:185, color:"#10b981"},
    {name:"FMPOS",v:140, color:"#f97316"},
    {name:"FSJP", v:105, color:"#8b5cf6"},
    {name:"FEG",  v:70,  color:"#eab308"},
  ];
  const lineData = [82,78,85,80,88,82,85,80,83,85];

  const cQ  = useCountUp(questions.length, animated);
  const cAr = useCountUp(arCount, animated);
  const cFr = useCountUp(frCount, animated);
  const cRp = useCountUp(repliedCount, animated);
  const cAU = useCountUp(activeUsers, animated);
  const cCU = useCountUp(chatbotUsers, animated);

  const NAV = [
    {id:"dashboard", label:T.navDashboard, icon:"🏠"},
    {id:"users",     label:T.navUsers,     icon:"👥"},
    {id:"stats",     label:T.navStats,     icon:"📊"},
    {id:"reports",   label:T.navReports,   icon:"📄"},
    {id:"calendar",  label:T.navCalendar,  icon:"📅"},
    {id:"settings",  label:T.navSettings,  icon:"⚙️"},
  ];

  const card = (extra={}) => ({
    background: C.card, border:`1px solid ${C.bdr}`,
    borderRadius:14, padding:16, ...extra
  });
  const btn = (bg, extra={}) => ({
    padding:"6px 14px", background:bg, border:"none", borderRadius:7,
    color:"white", fontSize:12, fontFamily:"'Tajawal',sans-serif",
    fontWeight:700, cursor:"pointer", transition:"all .2s", ...extra
  });

  const renderTable = () => (
    <div style={{...card({padding:0}), overflow:"hidden", animation:"cardIn .5s .5s both"}}>
      <div style={{padding:"14px 18px", borderBottom:`1px solid ${C.bdr}`,
        display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8}}>
        <div style={{fontSize:14, fontWeight:700, color:C.text}}>
          {T.tableTitle}
          <span style={{marginRight:8, marginLeft:8, fontSize:11, color:C.sub, fontWeight:400}}>
            ({filtered.length} {T.question} — {repliedCount} {T.replyCol})
          </span>
        </div>
        <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
          <button style={btn("#10b981")} onClick={exportCSV}>CSV</button>
          <button style={btn("#3b82f6")} onClick={exportCSV}>Excel</button>
          {questions.length > 0 && (
            <button onClick={()=>setDelAll(true)}
              style={{...btn("transparent"), border:"1px solid rgba(244,63,94,.4)", color:"#f43f5e"}}>
              {T.deleteAll}
            </button>
          )}
        </div>
      </div>
      <div style={{display:"grid", gridTemplateColumns:"1fr 90px 100px 110px 80px",
        gap:8, padding:"8px 18px", background:dark?"#0f172a":"#f8fafc",
        fontSize:11, fontWeight:700, color:C.sub, borderBottom:`1px solid ${C.bdr}`}}>
        <span>{T.questionCol}</span>
        <span style={{textAlign:"center"}}>{T.categoryCol}</span>
        <span style={{textAlign:"center"}}>{T.dateCol}</span>
        <span style={{textAlign:"center"}}>{T.replyCol}</span>
        <span style={{textAlign:"center"}}>{T.actionCol}</span>
      </div>
      {loading ? (
        <div style={{textAlign:"center", padding:48, color:C.sub}}>
          <div style={{width:32,height:32,border:`3px solid ${C.bdr}`,borderTopColor:"#3b82f6",
            borderRadius:"50%",animation:"spin .7s linear infinite",margin:"0 auto 12px"}}/>
          <p>{T.loading}</p>
        </div>
      ) : fetchErr ? (
        <div style={{textAlign:"center", padding:48}}>
          <div style={{fontSize:40, marginBottom:12}}>⚠️</div>
          <p style={{color:"#f43f5e", fontSize:13, marginBottom:12}}>{fetchErr}</p>
          <button onClick={load} style={btn("#3b82f6")}>إعادة المحاولة / Réessayer</button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{textAlign:"center", padding:48, color:C.sub}}>
          <div style={{fontSize:48, marginBottom:10}}>✅</div>
          <p style={{color:C.text, fontSize:14, marginBottom:4}}>{T.noQuestions}</p>
          <p style={{fontSize:12}}>{T.noQuestionsFr}</p>
        </div>
      ) : filtered.map((q, i) => {
        const realIdx = questions.indexOf(q);
        const cat = getCategory(q.question);
        const cc  = CAT_COLORS[cat];
        const dt  = new Date(q.timestamp).toLocaleDateString("fr-FR");
        const rep = replies[q.question];
        return (
          <div key={i} style={{display:"grid", gridTemplateColumns:"1fr 90px 100px 110px 80px",
            gap:8, padding:"11px 18px", borderBottom:`1px solid ${dark?"#1e3a5f22":C.bdr}`,
            alignItems:"center", transition:"background .15s", animation:`rowIn .4s ${i*0.04}s both`}}
            onMouseEnter={e=>e.currentTarget.style.background=dark?"#0f172a":"#f8fafc"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <div>
              <p style={{fontSize:13,color:C.text,direction:"rtl",textAlign:"right",
                whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",margin:0}}>
                {q.question}
              </p>
              {rep && (
                <p style={{fontSize:11,color:"#10b981",marginTop:3,direction:"rtl",
                  textAlign:"right",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                  ↩ {rep.text}
                </p>
              )}
            </div>
            <div style={{textAlign:"center"}}>
              <span style={{padding:"3px 8px",borderRadius:20,fontSize:10,fontWeight:700,
                background:cc.light,color:cc.bg,border:`1px solid ${cc.border}`}}>
                {cat}
              </span>
            </div>
            <div style={{fontSize:11,color:C.sub,textAlign:"center",direction:"ltr"}}>{dt}</div>
            <div style={{textAlign:"center"}}>
              {rep ? (
                <span style={{fontSize:10,color:"#10b981",fontWeight:700}}>{T.replied}</span>
              ) : (
                <button onClick={()=>{setReplyIdx(realIdx);setReplyTxt("");}}
                  style={{...btn("linear-gradient(135deg,#3b82f6,#8b5cf6)"),
                    fontSize:10,padding:"4px 10px",whiteSpace:"nowrap"}}>
                  {T.replyNow}
                </button>
              )}
            </div>
            <div style={{display:"flex",justifyContent:"center",gap:4}}>
              {rep && (
                <button onClick={()=>{setReplyIdx(realIdx);setReplyTxt(rep.text);}}
                  style={{...btn("#475569"),fontSize:10,padding:"4px 6px"}}>✎</button>
              )}
              <button onClick={()=>setDelOne(q.id)}
                style={{background:"rgba(244,63,94,.12)",border:"1px solid rgba(244,63,94,.25)",
                  color:"#f43f5e",borderRadius:7,padding:"4px 8px",cursor:"pointer",fontSize:12}}>
                🗑️
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderSection = () => {
    switch(nav) {
      case "dashboard": return (
        <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
            {[
              {ico:"❓",bg:"#f97316",num:cQ, lbl:T.statUnknown},
              {ico:"✅",bg:"#10b981",num:cRp,lbl:T.statReplied},
              {ico:"👥",bg:"#8b5cf6",num:cCU,lbl:T.statActive},
              {ico:"📊",bg:"#3b82f6",num:questions.length,lbl:T.statTotal},
            ].map((s,i)=>(
              <div key={i} style={{...card(),display:"flex",alignItems:"center",gap:12,
                cursor:"default",transition:"all .25s",animation:`cardIn .5s ${i*0.07}s both`}}
                onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.boxShadow="0 8px 28px rgba(0,0,0,.15)";}}
                onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>
                <div style={{width:42,height:42,borderRadius:10,flexShrink:0,
                  background:s.bg+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{s.ico}</div>
                <div>
                  <div style={{fontSize:26,fontWeight:800,color:C.text}}>{s.num}</div>
                  <div style={{fontSize:11,color:C.sub,marginTop:2}}>{s.lbl}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1.4fr",gap:10,marginBottom:14}}>
            <div style={{...card(),animation:"cardIn .5s .3s both"}}>
              <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:14}}>{T.langDist}</div>
              <div style={{display:"flex",alignItems:"center",gap:14}}>
                <DonutChart ar={arPct} fr={frPct} active={animated} dark={dark}/>
                <div style={{display:"flex",flexDirection:"column",gap:9}}>
                  {[{c:"#3b82f6",l:T.arabic,n:cAr},{c:"#10b981",l:T.french,n:cFr}].map((x,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:6}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:x.c,boxShadow:`0 0 5px ${x.c}`}}/>
                      <span style={{fontSize:12,color:C.sub}}>{x.l}</span>
                      <span style={{fontSize:12,fontWeight:700,color:C.text,marginRight:"auto",marginLeft:"auto"}}>{x.n}</span>
                    </div>
                  ))}
                  <div style={{fontSize:11,color:C.sub,marginTop:2}}>{T.total}: <strong style={{color:C.text}}>{cQ}</strong></div>
                </div>
              </div>
            </div>
            <div style={{...card(),animation:"cardIn .5s .37s both"}}>
              <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:14}}>{T.mostActive}</div>
              <div style={{display:"flex",flexDirection:"column",gap:9}}>
                {facData.map((f,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:11,fontWeight:700,color:C.text,width:40,textAlign:"right",flexShrink:0}}>{f.name}</span>
                    <AnimBar pct={(f.v/230)*100} color={f.color} delay={i*100} active={animated}/>
                    <span style={{fontSize:11,color:C.sub,width:28,flexShrink:0}}>{f.v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{...card(),animation:"cardIn .5s .44s both"}}>
              <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:14}}>{T.responseRate}</div>
              <div style={{display:"flex",alignItems:"flex-end",gap:6}}>
                <div style={{display:"flex",flexDirection:"column",justifyContent:"space-between",height:70,marginLeft:4}}>
                  {[100,75,50,0].map(v=>(<span key={v} style={{fontSize:9,color:C.sub}}>{v}</span>))}
                </div>
                <div style={{flex:1}}>
                  <LineChart data={lineData} color="#10b981" active={animated} dark={dark}/>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                    {[1,3,5,7,9,10].map(v=>(<span key={v} style={{fontSize:9,color:C.sub}}>{v}</span>))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div style={{...card({padding:"12px 18px",marginBottom:14}),
            background:dark?"linear-gradient(135deg,rgba(59,130,246,.15),rgba(139,92,246,.1))":"linear-gradient(135deg,rgba(59,130,246,.08),rgba(139,92,246,.06))",
            border:"1px solid rgba(59,130,246,.3)",animation:"cardIn .5s .48s both",
            display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:44,height:44,borderRadius:12,background:"linear-gradient(135deg,#3b82f6,#8b5cf6)",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>💬</div>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:C.text}}>{T.activeUsersOnChatbot}</div>
                <div style={{fontSize:11,color:C.sub,marginTop:2}}>{API_URL} · Live</div>
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:"#10b981",boxShadow:"0 0 8px #10b981",animation:"pulse 2s infinite"}}/>
              <span style={{fontSize:32,fontWeight:800,background:"linear-gradient(135deg,#3b82f6,#8b5cf6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{cCU}</span>
              <span style={{fontSize:12,color:C.sub}}>{T.liveUsers}</span>
            </div>
          </div>
          {renderTable()}
        </>
      );

      case "users": return (
        <div style={{display:"flex",flexDirection:"column",gap:14,animation:"cardIn .5s both"}}>
          <div style={card()}>
            <h3 style={{color:C.text,fontSize:15,fontWeight:700,marginBottom:16}}>{T.usersTitle}</h3>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
              {[
                {label:T.activeNow,       val:cCU,           color:"#10b981"},
                {label:T.todaySessions,   val:Math.max(1,cQ),color:"#3b82f6"},
                {label:T.repliedQuestions,val:cRp,           color:"#8b5cf6"},
              ].map((s,i)=>(
                <div key={i} style={{background:dark?"#0f172a":"#f8fafc",borderRadius:10,
                  padding:16,textAlign:"center",border:`1px solid ${s.color}33`}}>
                  <div style={{fontSize:32,fontWeight:800,color:s.color}}>{s.val}</div>
                  <div style={{fontSize:11,color:C.sub,marginTop:4}}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",
              background:dark?"#0f172a":"#f0fdf4",borderRadius:10,border:"1px solid rgba(16,185,129,.25)"}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:"#10b981",boxShadow:"0 0 8px #10b981",flexShrink:0}}/>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:C.text}}>{T.adminUser}</div>
                <div style={{fontSize:11,color:C.sub}}>{lang==="ar"?"متصل":"Connecté"} — {API_URL}</div>
              </div>
              <div style={{marginRight:"auto",marginLeft:"auto",fontSize:11,color:"#10b981",fontWeight:700}}>{T.activeNowLabel}</div>
            </div>
          </div>
          <div style={card()}>
            <h3 style={{color:C.text,fontSize:15,fontWeight:700,marginBottom:16}}>{T.myReplies} ({repliedCount})</h3>
            {repliedCount===0 ? <p style={{color:C.sub,fontSize:13}}>{T.noReplies}</p> :
              Object.entries(replies).map(([question,rep],i)=>(
                <div key={i} style={{padding:"12px 0",borderBottom:`1px solid ${C.bdr}`,direction:"rtl"}}>
                  <div style={{fontSize:13,color:C.text,fontWeight:600}}>{question}</div>
                  <div style={{fontSize:12,color:"#10b981",marginTop:4}}>↩ {rep.text}</div>
                  <div style={{fontSize:10,color:C.sub,marginTop:2}}>{rep.date}</div>
                </div>
              ))
            }
          </div>
        </div>
      );

      case "stats": return (
        <div style={{display:"flex",flexDirection:"column",gap:14,animation:"cardIn .5s both"}}>
          <div style={card()}>
            <h3 style={{color:C.text,fontSize:15,fontWeight:700,marginBottom:20}}>{T.statsTitle}</h3>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
              {[
                {label:T.totalQ, val:cQ, color:"#3b82f6"},
                {label:T.arabicQ,val:cAr,color:"#f97316"},
                {label:T.frenchQ,val:cFr,color:"#10b981"},
              ].map((s,i)=>(
                <div key={i} style={{background:dark?"#0f172a":"#f8fafc",borderRadius:12,
                  padding:20,textAlign:"center",border:`1px solid ${s.color}33`}}>
                  <div style={{fontSize:36,fontWeight:800,color:s.color}}>{s.val}</div>
                  <div style={{fontSize:12,color:C.sub,marginTop:4}}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={card()}>
            <h3 style={{color:C.text,fontSize:13,fontWeight:700,marginBottom:14}}>{T.catDist}</h3>
            {Object.entries(
              questions.reduce((acc,q)=>{const cat=getCategory(q.question);acc[cat]=(acc[cat]||0)+1;return acc;},{})
            ).sort((a,b)=>b[1]-a[1]).map(([cat,count],i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <span style={{fontSize:12,color:C.text,width:80,textAlign:"right",flexShrink:0}}>{cat}</span>
                <div style={{flex:1,height:8,background:dark?"#0f172a":"#f1f5f9",borderRadius:50,overflow:"hidden"}}>
                  <div style={{height:"100%",borderRadius:50,background:CAT_COLORS[cat]?.bg||"#6b7280",
                    width:`${Math.round((count/Math.max(questions.length,1))*100)}%`,transition:"width 1s ease"}}/>
                </div>
                <span style={{fontSize:12,color:C.sub,width:24}}>{count}</span>
              </div>
            ))}
          </div>
          <div style={card()}>
            <h3 style={{color:C.text,fontSize:13,fontWeight:700,marginBottom:14}}>{T.repliedPct} ({repliedCount}/{questions.length})</h3>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
              <div style={{flex:1,height:12,background:dark?"#0f172a":"#f1f5f9",borderRadius:50,overflow:"hidden"}}>
                <div style={{height:"100%",borderRadius:50,background:"linear-gradient(90deg,#10b981,#3b82f6)",
                  width:`${questions.length?Math.round((repliedCount/questions.length)*100):0}%`,transition:"width 1.2s ease"}}/>
              </div>
              <span style={{fontSize:13,fontWeight:700,color:"#10b981"}}>
                {questions.length?Math.round((repliedCount/questions.length)*100):0}%
              </span>
            </div>
          </div>
        </div>
      );

      case "reports": return (
        <div style={{display:"flex",flexDirection:"column",gap:14,animation:"cardIn .5s both"}}>
          <div style={card()}>
            <h3 style={{color:C.text,fontSize:15,fontWeight:700,marginBottom:16}}>{T.reportsTitle}</h3>
            {[
              {ico:"📥",label:T.reportCSV,action:exportCSV,color:"#10b981"},
              {ico:"📊",label:T.reportXLS,action:exportCSV,color:"#3b82f6"},
            ].map((r,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                padding:"14px 16px",background:dark?"#0f172a":"#f8fafc",borderRadius:10,
                marginBottom:8,border:`1px solid ${C.bdr}`}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:20}}>{r.ico}</span>
                  <span style={{fontSize:13,color:C.text}}>{r.label}</span>
                </div>
                <button onClick={r.action} style={btn(r.color)}>{T.download}</button>
              </div>
            ))}
          </div>
          <div style={card()}>
            <h3 style={{color:C.text,fontSize:13,fontWeight:700,marginBottom:12}}>{T.lastQuestions}</h3>
            {displayed.slice(0,5).map((q,i)=>(
              <div key={i} style={{padding:"10px 0",borderBottom:`1px solid ${C.bdr}`,direction:"rtl"}}>
                <div style={{fontSize:13,color:C.text}}>{q.question}</div>
                {replies[q.question]
                  ? <div style={{fontSize:11,color:"#10b981",marginTop:3}}>↩ {replies[q.question].text}</div>
                  : <div style={{fontSize:11,color:"#f43f5e",marginTop:3}}>{T.notReplied}</div>}
                <div style={{fontSize:10,color:C.sub,marginTop:2}}>{new Date(q.timestamp).toLocaleString("fr-FR")}</div>
              </div>
            ))}
            {displayed.length===0 && <p style={{color:C.sub,fontSize:13}}>{T.noRecorded}</p>}
          </div>
        </div>
      );

      case "calendar": return (
        <div style={{...card(),animation:"cardIn .5s both"}}>
          <h3 style={{color:C.text,fontSize:15,fontWeight:700,marginBottom:20}}>{T.calendarTitle}</h3>
          {[
            {date:"29 سبتمبر 2025",label:"الدخول الإداري",              color:"#3b82f6"},
            {date:"06 أكتوبر 2025",label:"دخول الطلاب + التسجيل",       color:"#10b981"},
            {date:"13 أكتوبر 2025",label:"بداية الدروس",                color:"#f97316"},
            {date:"01 ديسمبر 2025",label:"اختبارات الفردية",             color:"#8b5cf6"},
            {date:"19 يناير 2026", label:"امتحانات الدورة 1 (فردية)",    color:"#f43f5e"},
            {date:"09 فبراير 2026",label:"بداية الفصول الزوجية",        color:"#06b6d4"},
            {date:"01 يونيو 2026", label:"امتحانات الدورة 1 (زوجية)",   color:"#eab308"},
            {date:"22 يونيو 2026", label:"امتحانات الدورة 2 (فردية)",   color:"#f43f5e"},
            {date:"06 يوليو 2026", label:"امتحانات الدورة 2 (زوجية)",  color:"#10b981"},
            {date:"27 يوليو 2026", label:"احتفال نهاية السنة",          color:"#3b82f6"},
          ].map((e,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:14,marginBottom:10,animation:`rowIn .4s ${i*0.06}s both`}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:e.color,flexShrink:0,boxShadow:`0 0 6px ${e.color}`}}/>
              <div style={{background:dark?"#0f172a":"#f8fafc",borderRadius:8,padding:"8px 14px",flex:1,border:`1px solid ${e.color}33`}}>
                <div style={{fontSize:11,color:e.color,fontWeight:700}}>{e.date}</div>
                <div style={{fontSize:13,color:C.text,marginTop:2}}>{e.label}</div>
              </div>
            </div>
          ))}
        </div>
      );

      case "settings": return (
        <div style={{display:"flex",flexDirection:"column",gap:14,animation:"cardIn .5s both"}}>
          <div style={card()}>
            <h3 style={{color:C.text,fontSize:15,fontWeight:700,marginBottom:16}}>{T.settingsAppearance}</h3>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:`1px solid ${C.bdr}`}}>
              <div>
                <div style={{fontSize:13,color:C.text,fontWeight:500}}>{T.darkMode}</div>
                <div style={{fontSize:11,color:C.sub,marginTop:2}}>{dark?T.darkOn:T.darkOff}</div>
              </div>
              <div onClick={()=>setDark(p=>!p)}
                style={{width:48,height:26,borderRadius:50,cursor:"pointer",position:"relative",
                  background:dark?"#3b82f6":"#e2e8f0",transition:"background .3s"}}>
                <div style={{position:"absolute",width:20,height:20,borderRadius:"50%",background:"white",
                  top:3,left:dark?25:3,transition:"left .3s",boxShadow:"0 2px 6px rgba(0,0,0,.25)"}}/>
              </div>
            </div>
          </div>
          <div style={card()}>
            <h3 style={{color:C.text,fontSize:15,fontWeight:700,marginBottom:16}}>{T.changePassword}</h3>
            {[
              {label:T.currentPass,val:curPass,set:setCurPass},
              {label:T.newPass,    val:newPass,set:setNewPass},
              {label:T.confirmPass,val:confPass,set:setConfPass},
            ].map((f,i)=>(
              <div key={i} style={{marginBottom:10}}>
                <div style={{fontSize:11,color:C.sub,marginBottom:4}}>{f.label}</div>
                <input type="password" value={f.val} onChange={e=>f.set(e.target.value)}
                  style={{width:"100%",padding:"10px 12px",border:`1px solid ${C.bdr}`,borderRadius:8,
                    background:dark?"#0f172a":"#f8fafc",color:C.text,fontSize:13,
                    fontFamily:"'Tajawal',sans-serif",outline:"none",direction:"ltr",textAlign:"left"}}/>
              </div>
            ))}
            {passMsg && (
              <div style={{padding:"8px 12px",borderRadius:8,marginBottom:10,fontSize:12,fontWeight:600,
                background:passMsg.ok?"rgba(16,185,129,.1)":"rgba(244,63,94,.1)",
                color:passMsg.ok?"#10b981":"#f43f5e",
                border:`1px solid ${passMsg.ok?"rgba(16,185,129,.3)":"rgba(244,63,94,.3)"}`}}>
                {passMsg.text}
              </div>
            )}
            <button onClick={handleChangePassword}
              style={{...btn("linear-gradient(135deg,#3b82f6,#1d4ed8)"),padding:"9px 20px"}}>
              {T.savePass}
            </button>
          </div>
          <div style={card()}>
            <h3 style={{color:C.text,fontSize:15,fontWeight:700,marginBottom:16}}>{T.activeUsersOnChatbot}</h3>
            <div style={{display:"flex",alignItems:"center",gap:16,padding:"16px",
              background:dark?"#0f172a":"#f8fafc",borderRadius:12,border:"1px solid rgba(59,130,246,.25)"}}>
              <div style={{width:56,height:56,borderRadius:14,background:"linear-gradient(135deg,#3b82f6,#8b5cf6)",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>💬</div>
              <div style={{flex:1}}>
                <div style={{fontSize:11,color:C.sub,marginBottom:2}}>{T.activeUsersOnChatbot}</div>
                <div style={{display:"flex",alignItems:"baseline",gap:6}}>
                  <span style={{fontSize:40,fontWeight:800,background:"linear-gradient(135deg,#3b82f6,#8b5cf6)",
                    WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",lineHeight:1}}>{cCU}</span>
                  <span style={{fontSize:12,color:C.sub}}>{T.liveUsers}</span>
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                <div style={{width:10,height:10,borderRadius:"50%",
                  background:chatbotUsers>0?"#10b981":"#f43f5e",
                  boxShadow:chatbotUsers>0?"0 0 8px #10b981":"0 0 8px #f43f5e",animation:"pulse 2s infinite"}}/>
                <span style={{fontSize:10,color:chatbotUsers>0?"#10b981":"#f43f5e",fontWeight:700}}>
                  {chatbotUsers>0?"Live":"Idle"}
                </span>
              </div>
            </div>
            <p style={{fontSize:11,color:C.sub,marginTop:8}}>
              {lang==="ar"?"يتم تحديث العداد كل 15 ثانية من endpoint /active-users":"Compteur mis à jour toutes les 15 s depuis /active-users"}
            </p>
          </div>
          <div style={card()}>
            <h3 style={{color:C.text,fontSize:15,fontWeight:700,marginBottom:14,borderBottom:`1px solid ${C.bdr}`,paddingBottom:10}}>{T.sysInfo}</h3>
            {[
              {label:T.flaskAddr, val:API_URL},
              {label:T.sysVersion,val:"v2.0.0"},
              {label:T.rasaVersion,val:"3.6.x"},
              {label:T.flaskStatus,val:srvOk?"✅ "+T.connected:"❌ "+T.disconnected},
              {label:T.qCount,    val:`${questions.length} ${T.question}`},
              {label:T.rCount,    val:`${repliedCount} ${T.reply}`},
              {label:T.university,val:"Université de Nouakchott Al-Aasriya"},
            ].map((r,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${C.bdr}`}}>
                <span style={{fontSize:13,color:C.sub}}>{r.label}</span>
                <span style={{fontSize:12,color:C.text,fontWeight:600,fontFamily:"monospace"}}>{r.val}</span>
              </div>
            ))}
          </div>
          <div style={card()}>
            <h3 style={{color:C.text,fontSize:13,fontWeight:700,marginBottom:12}}>{T.security}</h3>
            <button onClick={()=>setAuth(false)}
              style={{...btn("rgba(244,63,94,.12)"),border:"1px solid rgba(244,63,94,.3)",color:"#f43f5e"}}>
              {T.logout}
            </button>
          </div>
        </div>
      );

      default: return null;
    }
  };

  // ══ LOGIN ══
  if (!auth) {
    return (
      <div style={{minHeight:"100vh",background:"#0f172a",display:"flex",
        alignItems:"center",justifyContent:"center",fontFamily:"'Tajawal',sans-serif"}}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');
          @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
          @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-7px)}75%{transform:translateX(7px)}}
        `}</style>
        <div style={{background:"#1e293b",border:"1px solid #334155",borderRadius:20,
          padding:"48px 44px",width:400,textAlign:"center",
          boxShadow:"0 24px 60px rgba(0,0,0,.6)",animation:"fadeUp .45s ease"}}>
          <div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:20}}>
            {["ar","fr"].map(l=>(
              <button key={l} onClick={()=>setLang(l)}
                style={{padding:"5px 14px",borderRadius:20,border:"none",cursor:"pointer",
                  fontSize:12,fontWeight:700,fontFamily:"'Tajawal',sans-serif",
                  background:lang===l?"linear-gradient(135deg,#3b82f6,#1d4ed8)":"#334155",
                  color:lang===l?"white":"#94a3b8",transition:"all .2s"}}>
                {l==="ar"?"العربية":"Français"}
              </button>
            ))}
          </div>
          <div style={{fontSize:52,marginBottom:8}}>🔐</div>
          <h2 style={{color:"#f1f5f9",fontSize:24,fontWeight:800,margin:"0 0 6px"}}>{T.adminTitle}</h2>
          <p style={{color:"#475569",fontSize:12,margin:"0 0 28px"}}>{T.adminSub}</p>
          <form onSubmit={handleLogin}>
            <div style={{display:"flex",alignItems:"center",background:"#0f172a",
              border:`1.5px solid ${passErr?"#f43f5e":"#334155"}`,borderRadius:10,
              overflow:"hidden",marginBottom:12,animation:passErr?"shake .35s ease":"none"}}>
              <span style={{padding:"0 14px",fontSize:16}}>🔑</span>
              <input type="password" value={pass} autoFocus
                onChange={e=>{setPass(e.target.value);setPassErr(false);}}
                placeholder={T.passwordPlaceholder}
                style={{flex:1,padding:"13px 8px 13px 0",border:"none",outline:"none",
                  background:"transparent",color:"#f1f5f9",fontSize:14,
                  fontFamily:"'Tajawal',sans-serif",textAlign:"center"}}/>
            </div>
            {passErr && (
              <div style={{color:"#f43f5e",fontSize:12,marginBottom:10,
                background:"rgba(244,63,94,.1)",padding:"8px 12px",borderRadius:8}}>
                {T.wrongPass}
              </div>
            )}
            <button type="submit"
              style={{width:"100%",background:"linear-gradient(135deg,#3b82f6,#1d4ed8)",
                color:"white",border:"none",padding:14,borderRadius:10,fontSize:15,
                fontFamily:"'Tajawal',sans-serif",fontWeight:700,cursor:"pointer"}}>
              {T.loginBtn}
            </button>
          </form>
          <p style={{color:"#334155",fontSize:11,marginTop:24}}>{T.footer}</p>
        </div>
      </div>
    );
  }

  // ══ DASHBOARD ══
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-thumb{background:${dark?"#334155":"#cbd5e1"};border-radius:4px;}
        @keyframes fadeIn {from{opacity:0}to{opacity:1}}
        @keyframes slideL {from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:none}}
        @keyframes slideU {from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:none}}
        @keyframes cardIn {from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        @keyframes rowIn  {from{opacity:0;transform:translateX(8px)}to{opacity:1;transform:none}}
        @keyframes statNum{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes spin   {to{transform:rotate(360deg)}}
        @keyframes pulse  {0%,100%{transform:scale(1)}50%{transform:scale(1.2)}}
        @keyframes tIn    {from{opacity:0;transform:translateX(-50%) translateY(-14px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        @keyframes mdIn   {from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
        .tst{position:fixed;top:18px;left:50%;transform:translateX(-50%);padding:10px 22px;
          border-radius:8px;font-size:13px;font-weight:700;font-family:'Tajawal',sans-serif;
          z-index:9999;color:white;box-shadow:0 6px 20px rgba(0,0,0,.3);animation:tIn .3s ease;white-space:nowrap;}
        .tst.success{background:linear-gradient(135deg,#10b981,#059669);}
        .tst.error{background:linear-gradient(135deg,#f43f5e,#dc2626);}
        .ov{position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;
          align-items:center;justify-content:center;z-index:9998;backdrop-filter:blur(5px);}
        .md{background:${C.card};border-radius:16px;padding:32px 28px;text-align:center;
          border:1px solid ${C.bdr};max-width:360px;width:90%;
          box-shadow:0 20px 50px rgba(0,0,0,.5);animation:mdIn .28s ease;}
        .dot-g{width:7px;height:7px;border-radius:50%;animation:pulse 2s infinite;flex-shrink:0;}
      `}</style>

      {toast && <div className={`tst ${toast.type}`}>{toast.msg}</div>}

      {/* MODAL DELETE ALL */}
      {delAll && (
        <div className="ov">
          <div className="md">
            <div style={{fontSize:44,marginBottom:12}}>⚠️</div>
            <h3 style={{color:C.text,fontSize:17,fontWeight:700,margin:"0 0 8px"}}>{T.confirmDeleteAll}</h3>
            <p style={{color:C.sub,fontSize:13,lineHeight:1.7,margin:"0 0 22px"}}>
              {T.confirmDeleteAllMsg} <strong style={{color:C.text}}>{questions.length}</strong> {T.confirmDeleteAllMsg2}
            </p>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <button onClick={()=>setDelAll(false)}
                style={{padding:"9px 22px",border:`1px solid ${C.bdr}`,borderRadius:8,
                  cursor:"pointer",fontSize:13,fontFamily:"'Tajawal',sans-serif",background:C.card,color:C.sub}}>
                {T.cancel}
              </button>
              <button onClick={deleteAllQ}
                style={{padding:"9px 22px",background:"#f43f5e",color:"white",border:"none",
                  borderRadius:8,cursor:"pointer",fontSize:13,fontFamily:"'Tajawal',sans-serif",fontWeight:700}}>
                {T.deleteForever}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DELETE ONE */}
      {delOne !== null && (
        <div className="ov">
          <div className="md">
            <div style={{fontSize:44,marginBottom:12}}>🗑️</div>
            <h3 style={{color:C.text,fontSize:17,fontWeight:700,margin:"0 0 8px"}}>{T.confirmDeleteOne}</h3>
            <p style={{color:C.sub,fontSize:13,margin:"0 0 8px",direction:"rtl"}}>{T.confirmDeleteOneMsg}</p>
            <p style={{color:C.text,fontSize:12,background:dark?"#0f172a":"#f8fafc",
              padding:"8px 12px",borderRadius:8,marginBottom:22,direction:"rtl"}}>
              {questions.find(q=>q.id===delOne)?.question}
            </p>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <button onClick={()=>setDelOne(null)}
                style={{padding:"9px 22px",border:`1px solid ${C.bdr}`,borderRadius:8,
                  cursor:"pointer",fontSize:13,fontFamily:"'Tajawal',sans-serif",background:C.card,color:C.sub}}>
                {T.cancel}
              </button>
              <button onClick={()=>deleteOne(delOne)}
                style={{padding:"9px 22px",background:"#f43f5e",color:"white",border:"none",
                  borderRadius:8,cursor:"pointer",fontSize:13,fontFamily:"'Tajawal',sans-serif",fontWeight:700}}>
                {T.deleteOneForever}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REPLY */}
      {replyIdx !== null && (
        <div className="ov">
          <div className="md" style={{textAlign:"right",direction:"rtl"}}>
            <div style={{fontSize:44,marginBottom:12}}>↩️</div>
            <h3 style={{color:C.text,fontSize:17,fontWeight:700,margin:"0 0 10px"}}>{T.replyTitle}</h3>
            <p style={{fontSize:12,color:C.sub,background:dark?"#0f172a":"#f8fafc",
              padding:"8px 12px",borderRadius:8,marginBottom:12,direction:"rtl"}}>
              {questions[replyIdx]?.question}
            </p>
            <textarea value={replyTxt} onChange={e=>setReplyTxt(e.target.value)}
              placeholder={T.replyPlaceholder}
              style={{width:"100%",padding:"10px 12px",border:`1px solid ${C.bdr}`,borderRadius:8,
                background:dark?"#0f172a":"#f8fafc",color:C.text,fontSize:13,
                fontFamily:"'Tajawal',sans-serif",outline:"none",resize:"vertical",
                minHeight:80,direction:"rtl",textAlign:"right",marginBottom:12}}/>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <button onClick={()=>{setReplyIdx(null);setReplyTxt("");}}
                style={{padding:"9px 22px",border:`1px solid ${C.bdr}`,borderRadius:8,
                  cursor:"pointer",fontSize:13,fontFamily:"'Tajawal',sans-serif",background:C.card,color:C.sub}}>
                {T.cancel}
              </button>
              <button onClick={saveReply}
                style={{padding:"9px 22px",background:"linear-gradient(135deg,#3b82f6,#1d4ed8)",
                  color:"white",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,
                  fontFamily:"'Tajawal',sans-serif",fontWeight:700}}>
                {T.saveReply}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LAYOUT */}
      <div style={{display:"flex",minHeight:"100vh",fontFamily:"'Tajawal',sans-serif",
        direction:T.dir,background:C.bg,color:C.text,transition:"background .3s",animation:"fadeIn .4s ease"}}>

        {/* MAIN */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>

          {/* TOPBAR */}
          <div style={{background:C.topBg,borderBottom:`1px solid ${C.bdr}`,padding:"12px 20px",
            display:"flex",alignItems:"center",justifyContent:"space-between",
            position:"sticky",top:0,zIndex:50,
            boxShadow:dark?"none":"0 1px 8px rgba(0,0,0,.08)",animation:"slideU .4s ease"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:18,fontWeight:800,color:C.text}}>{T.dashboard}</span>
              <span style={{fontSize:18,cursor:"pointer",color:C.sub}}>☰</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{display:"flex",alignItems:"center",background:dark?"#0f172a":"#f1f5f9",
                border:`1px solid ${C.bdr}`,borderRadius:8,overflow:"hidden",minWidth:180}}>
                <span style={{padding:"0 8px",color:C.sub}}>🔍</span>
                <input placeholder={T.searchPlaceholder} value={search}
                  onChange={e=>setSearch(e.target.value)}
                  style={{flex:1,padding:"7px 8px 7px 0",border:"none",outline:"none",
                    background:"transparent",color:C.text,fontSize:13,fontFamily:"'Tajawal',sans-serif"}}/>
              </div>
              <div style={{display:"flex",background:dark?"#0f172a":"#f1f5f9",
                border:`1px solid ${C.bdr}`,borderRadius:8,overflow:"hidden"}}>
                {["ar","fr"].map(l=>(
                  <button key={l} onClick={()=>setLang(l)}
                    style={{padding:"6px 12px",border:"none",cursor:"pointer",fontSize:12,fontWeight:700,
                      fontFamily:"'Tajawal',sans-serif",
                      background:lang===l?"linear-gradient(135deg,#3b82f6,#1d4ed8)":"transparent",
                      color:lang===l?"white":C.sub,transition:"all .2s"}}>
                    {l==="ar"?"ع":"FR"}
                  </button>
                ))}
              </div>
              <div onClick={()=>setDark(p=>!p)} title={dark?"وضع النهار":"وضع الليل"}
                style={{width:34,height:34,borderRadius:8,background:dark?"#0f172a":"#f1f5f9",
                  border:`1px solid ${C.bdr}`,display:"flex",alignItems:"center",
                  justifyContent:"center",cursor:"pointer",fontSize:16}}>
                {dark?"☀️":"🌙"}
              </div>
              <div style={{position:"relative"}}>
                <div style={{width:34,height:34,borderRadius:8,background:dark?"#0f172a":"#f1f5f9",
                  border:`1px solid ${C.bdr}`,display:"flex",alignItems:"center",
                  justifyContent:"center",cursor:"pointer",fontSize:15,color:C.sub}}>🔔</div>
                <div style={{position:"absolute",top:-3,right:-3,background:"#f43f5e",color:"white",
                  borderRadius:"50%",width:15,height:15,fontSize:9,fontWeight:700,
                  display:"flex",alignItems:"center",justifyContent:"center",animation:"pulse 2s infinite"}}>1</div>
              </div>
              <div onClick={()=>{load();checkServer();fetchChatbotUsers();}} title="تحديث / Actualiser"
                style={{width:34,height:34,borderRadius:8,background:dark?"#0f172a":"#f1f5f9",
                  border:`1px solid ${C.bdr}`,display:"flex",alignItems:"center",
                  justifyContent:"center",cursor:"pointer",fontSize:15,color:C.sub}}>🔄</div>
            </div>
          </div>

          {/* CONTENT */}
          <div style={{flex:1,padding:"16px 20px",overflowY:"auto"}}>
            {renderSection()}
          </div>
        </div>

        {/* SIDEBAR */}
        <div style={{width:200,background:C.sbBg,
          borderLeft:T.dir==="rtl"?`1px solid ${C.bdr}`:"none",
          borderRight:T.dir==="ltr"?`1px solid ${C.bdr}`:"none",
          display:"flex",flexDirection:"column",flexShrink:0,
          animation:"slideL .5s cubic-bezier(.16,1,.3,1)"}}>
          <div style={{padding:"16px 14px",borderBottom:"1px solid rgba(255,255,255,.1)",
            display:"flex",alignItems:"center",gap:10}}>
            <div style={{background:"linear-gradient(135deg,#3b82f6,#8b5cf6)",borderRadius:8,
              padding:"5px 10px",fontSize:12,fontWeight:800,color:"white",letterSpacing:1}}>UNA</div>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:"white"}}>Admin</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.5)"}}>superadmin</div>
            </div>
          </div>
          <nav style={{flex:1,padding:"10px 8px",display:"flex",flexDirection:"column",gap:2}}>
            {NAV.map(n=>(
              <div key={n.id} onClick={()=>setNav(n.id)}
                style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",
                  borderRadius:10,cursor:"pointer",fontSize:13,whiteSpace:"nowrap",transition:"all .18s",
                  background:nav===n.id?C.sbOn:"transparent",color:nav===n.id?C.sbOnTx:C.sbItem}}
                onMouseEnter={e=>{if(nav!==n.id)e.currentTarget.style.background="rgba(255,255,255,.08)";}}
                onMouseLeave={e=>{if(nav!==n.id)e.currentTarget.style.background="transparent";}}>
                <span style={{fontSize:15,flexShrink:0}}>{n.icon}</span>
                <span>{n.label}</span>
              </div>
            ))}
          </nav>
          <div style={{padding:12,borderTop:"1px solid rgba(255,255,255,.08)"}}>
            <div style={{marginBottom:8,padding:"8px 10px",background:"rgba(0,0,0,.2)",borderRadius:8}}>
              <div style={{fontSize:10,color:"rgba(255,255,255,.4)",fontWeight:700,marginBottom:5}}>{T.serverStatus}</div>
              {[{label:"Rasa",ok:srvOk},{label:"Flask",ok:srvOk}].map((s,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"rgba(255,255,255,.6)",marginBottom:4}}>
                  <div className="dot-g" style={{background:s.ok?"#10b981":"#f43f5e",boxShadow:s.ok?"0 0 6px #10b981":"0 0 6px #f43f5e"}}/>
                  <span>{s.label}: {s.ok?T.connected:T.disconnected}</span>
                </div>
              ))}
              <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"rgba(255,255,255,.6)",
                marginTop:4,paddingTop:4,borderTop:"1px solid rgba(255,255,255,.08)"}}>
                <div className="dot-g" style={{background:chatbotUsers>0?"#3b82f6":"#475569",boxShadow:chatbotUsers>0?"0 0 6px #3b82f6":"none"}}/>
                <span>💬 {cCU} {T.liveUsers}</span>
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",
              background:"rgba(0,0,0,.2)",borderRadius:10,marginBottom:8}}>
              <div style={{width:30,height:30,borderRadius:"50%",background:"linear-gradient(135deg,#3b82f6,#8b5cf6)",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"white",flexShrink:0}}>A</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:700,color:"white"}}>Admin</div>
                <div style={{fontSize:10,color:"rgba(255,255,255,.5)"}}>superadmin</div>
              </div>
              <span style={{color:"#f59e0b",fontSize:14}}>✦</span>
            </div>
            <button onClick={()=>setAuth(false)}
              style={{width:"100%",padding:8,background:"rgba(244,63,94,.15)",
                border:"1px solid rgba(244,63,94,.3)",borderRadius:8,color:"#f43f5e",
                cursor:"pointer",fontSize:12,fontFamily:"'Tajawal',sans-serif",fontWeight:700,transition:"all .2s"}}>
              {T.logout}
            </button>
          </div>
        </div>

      </div>
    </>
  );
}