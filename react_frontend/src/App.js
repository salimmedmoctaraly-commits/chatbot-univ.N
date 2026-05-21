import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import "./App.css";
import logo from "./logo.png";
import UnknownQuestions from "./UnknownQuestions";
import {
  RefreshCw,
  Moon,
  Sun,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Check,
  ChevronDown,
  Send,
} from "lucide-react";

const FLASK_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

function detectLang(t) {
  return ((t || "").match(/[\u0600-\u06FF]/g) || []).length > (t || "").length * 0.2 ? "ar" : "fr";
}

function generateSenderId() {
  return `user_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
}

function playNotifSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 520; o.type = "sine";
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.35);
  } catch {}
}

function formatTime(date) {
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

const QUICK_SUGGESTIONS = [
  { ar: "ل.م.د",     fr: "LMD"         },
  { ar: "النتائج",    fr: "Résultats"    },
  { ar: "المنح",      fr: "Bourses"     },
  { ar: "الكليات",    fr: "Facultés"    },
];

function App() {
  const [input, setInput]                 = useState("");
  const [messages, setMessages]           = useState([]);
  const [isTyping, setIsTyping]           = useState(false);
  const [page, setPage]                   = useState(
    window.location.pathname === "/dashboard" ? "admin" : "chat"
  );
  const [dark, setDark]                   = useState(false);
  const [online, setOnline]               = useState(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [ratings, setRatings]             = useState({});
  const [copied, setCopied]               = useState(null);
  const [headerAnim, setHeaderAnim]       = useState(false);

  const messagesEndRef = useRef(null);
  const messagesWinRef = useRef(null);
  const [senderId]     = useState(() => generateSenderId());

  useEffect(() => { setTimeout(() => setHeaderAnim(true), 100); }, []);

  useEffect(() => {
    axios.post(`${FLASK_URL}/ping`, { sender: senderId }).catch(() => {});
    const iv = setInterval(() => {
      axios.post(`${FLASK_URL}/ping`, { sender: senderId }).catch(() => {});
    }, 60_000);
    return () => clearInterval(iv);
  }, [senderId]);

  useEffect(() => {
    const check = async () => {
      try { await axios.get(`${FLASK_URL}/health`, { timeout: 4000 }); setOnline(true); }
      catch { setOnline(false); }
    };
    check();
    const iv = setInterval(check, 20000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    window.history.pushState({}, "", page === "admin" ? "/dashboard" : "/");
  }, [page]);

  useEffect(() => {
    const fn = () => setPage(window.location.pathname === "/dashboard" ? "admin" : "chat");
    window.addEventListener("popstate", fn);
    return () => window.removeEventListener("popstate", fn);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, isTyping, scrollToBottom]);

  const handleScroll = () => {
    const el = messagesWinRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
  };

  const copyText = (text, idx) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(idx);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const rateMessage = (idx, val) => setRatings(r => ({ ...r, [idx]: val }));

  const sendMessage = async (e, forcedText = null) => {
    if (e) e.preventDefault();
    const text = forcedText ?? input;
    if (!text.trim()) return;
    const userMsg = { text, sender: "user", lang: detectLang(text), time: formatTime(new Date()) };
    const current = [...messages, userMsg];
    setMessages(current);
    setInput("");
    setIsTyping(true);
    try {
      const res = await axios.post(`${FLASK_URL}/chat`, { message: text, sender: senderId });
      setIsTyping(false);
      playNotifSound();
      setMessages([...current, {
        text: res.data.reply, sender: "bot",
        lang: detectLang(res.data.reply),
        time: formatTime(new Date()),
      }]);
    } catch (error) {
      setIsTyping(false);
      let errorMsg = "⚠ خطأ في الاتصال بالسيرفر";
      if (error.response)     errorMsg = `⚠ Erreur serveur (${error.response.status})`;
      else if (error.request) errorMsg = "⚠ تعذّر الاتصال بالخادم";
      setMessages([...current, { text: errorMsg, sender: "bot", lang: "ar", time: formatTime(new Date()) }]);
    }
  };

  const resetConversation = () => { setMessages([]); setRatings({}); };

  // ── اتجاه حقل الإدخال بحسب اللغة المكتوبة ──
  const inputDir  = input.trim() ? (detectLang(input) === "ar" ? "rtl" : "ltr") : "rtl";
  const inputAlign = inputDir === "rtl" ? "right" : "left";
  const inputPlaceholder = inputDir === "ltr"
    ? "Écrivez votre question..."
    : "اكتب سؤالك هنا...";

  const C = {
    bg:       dark ? "#0f172a" : "#f0f4f0",
    card:     dark ? "#1e293b" : "#ffffff",
    header:   dark ? "#14532d" : "#1a5c35",
    userBg:   dark ? "#166534" : "#1a5c35",
    botBg:    dark ? "#1e293b" : "#ffffff",
    text:     dark ? "#f1f5f9" : "#1e293b",
    sub:      dark ? "#94a3b8" : "#64748b",
    inputBg:  dark ? "#0f172a" : "#f8faf8",
    inputBdr: dark ? "#334155" : "#d1d5db",
    bdr:      dark ? "#334155" : "#e5e7eb",
  };

  if (page === "admin") return <UnknownQuestions onBack={() => setPage("chat")} />;

  return (
    <div style={{
      minHeight: "100dvh",
      background: C.bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Tajawal','Segoe UI',sans-serif",
      transition: "background .3s",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; overflow: hidden; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: #1a5c35; border-radius: 4px; }
        @keyframes slideDown { from{opacity:0;transform:translateY(-28px)} to{opacity:1;transform:none} }
        @keyframes fadeUp    { from{opacity:0;transform:translateY(14px)}  to{opacity:1;transform:none} }
        @keyframes popIn     { from{opacity:0;transform:scale(.9)}         to{opacity:1;transform:scale(1)} }
        @keyframes blink     { 0%,100%{opacity:1} 50%{opacity:.3} }
        .msg-row   { animation: fadeUp .3s ease both; }
        .quick-btn { transition: all .2s; font-family: 'Tajawal',sans-serif; }
        .quick-btn:hover { background: #1a5c35 !important; color: white !important; transform: translateY(-2px); }
        .send-btn-main { transition: all .2s; font-family: 'Tajawal',sans-serif; }
        .send-btn-main:hover:not(:disabled) { background: #14532d !important; }
        .send-btn-main:disabled { opacity: .45; cursor: not-allowed; }
        .icon-btn { transition: all .2s; }
        .icon-btn:hover { opacity: .75; transform: scale(1.1); }
        .rating-btn { transition: transform .15s; }
        .rating-btn:hover { transform: scale(1.25); }
        .dot1 { display:inline-block;width:7px;height:7px;border-radius:50%;
          background:#1a5c35;margin:0 2px;animation:blink 1.2s infinite; }
        .dot2 { animation-delay:.2s !important; }
        .dot3 { animation-delay:.4s !important; }
        .chat-card { width:100%; height:100vh; height:100dvh; border-radius:0; }
        @media (min-width: 600px) {
          .chat-card { width:90%; max-width:600px; height:88vh; max-height:800px; border-radius:20px; }
        }
        @media (min-width: 1024px) {
          .chat-card { width:520px; height:88vh; max-height:740px; border-radius:20px; }
        }
        .messages-win { flex:1; overflow-y:auto; -webkit-overflow-scrolling:touch; }
        .input-area { flex-shrink:0; position:sticky; bottom:0; }
        @media (max-width: 599px) {
          .send-btn-main { padding: 12px 16px !important; font-size: 14px !important; }
          .quick-btn     { padding: 8px 14px !important; font-size: 13px !important; }
        }
      `}</style>

      <div className="chat-card" style={{
        background: C.card,
        overflow: "hidden",
        boxShadow: dark ? "0 24px 60px rgba(0,0,0,.6)" : "0 8px 40px rgba(26,92,53,.18)",
        display: "flex", flexDirection: "column",
        animation: "popIn .4s ease",
        position: "relative",
      }}>

        {/* ── HEADER ── */}
        <div style={{
          background: C.header, padding: "12px 14px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
          animation: headerAnim ? "slideDown .5s ease" : "none",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src={logo} alt="UNA" style={{
              width: 46, height: 46, borderRadius: "50%",
              border: "2px solid rgba(255,255,255,.35)",
              objectFit: "cover", flexShrink: 0,
            }}/>
            <div>
              <h2 style={{ color:"white", fontSize:15, fontWeight:700, margin:0 }}>
                مساعد الطالب الجامعي
              </h2>
              <p style={{ color:"rgba(255,255,255,.75)", fontSize:11, margin:"1px 0 0" }}>
                Université de Nouakchott Al-Aasriya
              </p>
              <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:2 }}>
                <div style={{
                  width:7, height:7, borderRadius:"50%",
                  background: online===null?"#fbbf24":online?"#4ade80":"#f87171",
                  boxShadow: `0 0 5px ${online===null?"#fbbf24":online?"#4ade80":"#f87171"}`,
                }}/>
                <span style={{ color:"rgba(255,255,255,.7)", fontSize:10 }}>
                  {online===null?"...":online?"متصل · Connecté":"غير متصل · Déconnecté"}
                </span>
              </div>
            </div>
          </div>

          {/* أزرار الهيدر — Lucide */}
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            {/* زر الوضع الليلي/النهاري */}
            <button onClick={() => setDark(d => !d)} className="icon-btn"
              title={dark ? "Wضع النهار" : "Wضع الليل"}
              style={{
                background:"rgba(255,255,255,.15)", border:"none", borderRadius:8,
                width:34, height:34, cursor:"pointer",
                display:"flex", alignItems:"center", justifyContent:"center",
                color:"white",
              }}>
              {dark
                ? <Sun size={17} strokeWidth={2}/>
                : <Moon size={17} strokeWidth={2}/>
              }
            </button>

            {/* زر إعادة المحادثة */}
            {messages.length > 0 && (
              <button onClick={resetConversation} className="icon-btn"
                title="إعادة المحادثة"
                style={{
                  background:"rgba(255,255,255,.15)", border:"none", borderRadius:8,
                  width:34, height:34, cursor:"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  color:"white",
                }}>
                <RefreshCw size={17} strokeWidth={2}/>
              </button>
            )}
          </div>
        </div>

        {/* ── MESSAGES ── */}
        <div className="messages-win" ref={messagesWinRef} onScroll={handleScroll}
          style={{ padding:"14px", display:"flex", flexDirection:"column",
            gap:10, background: dark?"#0f172a":"#f8faf8" }}>

          {messages.length === 0 && (
            <div style={{ textAlign:"center", padding:"18px 8px", animation:"fadeUp .5s ease" }}>
              <div style={{ fontSize:42, marginBottom:8 }}>👋</div>
              <p style={{ color:C.text, fontSize:15, fontWeight:600, marginBottom:4 }}>
                أهلاً بك! كيف يمكنني مساعدتك؟
              </p>
              <p style={{ color:C.sub, fontSize:13, marginBottom:18 }}>
                Bonjour! Comment puis-je vous aider?
              </p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"center" }}>
                {QUICK_SUGGESTIONS.map((s, i) => (
                  <button key={i} className="quick-btn"
                    onClick={() => sendMessage(null, s.ar)}
                    style={{ padding:"7px 13px",
                      background: dark?"#1e293b":"#f0fdf4",
                      border:`1px solid ${dark?"#334155":"#bbf7d0"}`,
                      borderRadius:20, color: dark?"#4ade80":"#15803d",
                      fontSize:12, fontWeight:600, cursor:"pointer" }}>
                    {s.ar} · {s.fr}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            const isUser = msg.sender === "user";
            const isRTL  = msg.lang === "ar";
            return (
              <div key={i} className="msg-row"
                style={{ display:"flex", flexDirection: isUser?"row-reverse":"row",
                  alignItems:"flex-end", gap:7,
                  animationDelay:`${Math.min(i,5)*0.03}s` }}>
                {!isUser && (
                  <img src={logo} alt="bot" style={{
                    width:28, height:28, borderRadius:"50%",
                    border:"2px solid #1a5c35",
                    objectFit:"cover", flexShrink:0,
                  }}/>
                )}
                <div style={{ maxWidth:"76%", display:"flex", flexDirection:"column",
                  alignItems: isUser?"flex-end":"flex-start" }}>
                  <div
                    className={isRTL ? "bubble bubble-ar" : "bubble bubble-fr"}
                    style={{
                    background: isUser?C.userBg:C.botBg,
                    color: isUser?"white":C.text,
                    padding:"9px 13px",
                    borderRadius: isUser?"16px 16px 4px 16px":"16px 16px 16px 4px",
                    fontSize:14, lineHeight:1.65,
                    direction: isRTL?"rtl":"ltr",
                    textAlign: isRTL?"right":"left",
                    boxShadow:"0 2px 6px rgba(0,0,0,.08)",
                    border: !isUser?`1px solid ${C.bdr}`:"none",
                    wordBreak:"break-word",
                  }}>
                    {!isUser
                      ? msg.text.split("\n").map((l,j) => <span key={j}>{l}<br/></span>)
                      : msg.text}
                  </div>
                  <span style={{ fontSize:10, color:C.sub, marginTop:2, direction:"ltr" }}>
                    {msg.time}
                  </span>

                  {/* أزرار التقييم والنسخ — Lucide */}
                  {!isUser && (
                    <div style={{ display:"flex", gap:4, marginTop:3, alignItems:"center" }}>

                      {/* نسخ */}
                      <button className="icon-btn" onClick={() => copyText(msg.text, i)}
                        title="Copier"
                        style={{ background:"none", border:"none", cursor:"pointer",
                          padding:4, borderRadius:6, color:C.sub,
                          display:"flex", alignItems:"center", justifyContent:"center",
                          minWidth:26, minHeight:26 }}>
                        {copied === i
                          ? <Check size={14} strokeWidth={2.5} color="#10b981"/>
                          : <Copy size={14} strokeWidth={2}/>
                        }
                      </button>

                      {/* تقييم */}
                      {ratings[i] ? (
                        <span style={{ fontSize:10, color:"#10b981", padding:"0 2px" }}>
                          {ratings[i]==="up" ? "Merci !" : "Noté"}
                        </span>
                      ) : (
                        <>
                          <button className="rating-btn" onClick={() => rateMessage(i,"up")}
                            title="Utile"
                            style={{ background:"none", border:"none", cursor:"pointer",
                              padding:4, borderRadius:6, color:C.sub,
                              display:"flex", alignItems:"center", justifyContent:"center",
                              minWidth:26, minHeight:26 }}>
                            <ThumbsUp size={14} strokeWidth={2}/>
                          </button>
                          <button className="rating-btn" onClick={() => rateMessage(i,"down")}
                            title="Pas utile"
                            style={{ background:"none", border:"none", cursor:"pointer",
                              padding:4, borderRadius:6, color:C.sub,
                              display:"flex", alignItems:"center", justifyContent:"center",
                              minWidth:26, minHeight:26 }}>
                            <ThumbsDown size={14} strokeWidth={2}/>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isTyping && (
            <div style={{ display:"flex", alignItems:"flex-end", gap:7 }}>
              <img src={logo} alt="bot" style={{
                width:28, height:28, borderRadius:"50%",
                border:"2px solid #1a5c35", objectFit:"cover",
              }}/>
              <div style={{ background:C.botBg, border:`1px solid ${C.bdr}`,
                borderRadius:"16px 16px 16px 4px", padding:"11px 15px",
                boxShadow:"0 2px 6px rgba(0,0,0,.08)" }}>
                <span className="dot1"/>
                <span className="dot1 dot2"/>
                <span className="dot1 dot3"/>
              </div>
            </div>
          )}
          <div ref={messagesEndRef}/>
        </div>

        {/* زر التمرير للأسفل — Lucide */}
        {showScrollBtn && (
          <button onClick={scrollToBottom}
            style={{
              position:"absolute", bottom:74, right:14,
              width:34, height:34, borderRadius:"50%",
              background:"#1a5c35", color:"white", border:"none",
              cursor:"pointer",
              boxShadow:"0 4px 12px rgba(26,92,53,.4)",
              display:"flex", alignItems:"center", justifyContent:"center",
              zIndex:10, animation:"popIn .2s ease",
            }}>
            <ChevronDown size={18} strokeWidth={2.5}/>
          </button>
        )}

        {/* ── INPUT ── */}
        <form onSubmit={sendMessage} className="input-area" style={{
          padding:"10px 12px", borderTop:`1px solid ${C.bdr}`,
          background:C.card, display:"flex", gap:8, alignItems:"center",
        }}>
          <input type="text" value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={inputPlaceholder}
            style={{ flex:1, padding:"11px 15px",
              border:`1.5px solid ${C.inputBdr}`, borderRadius:24,
              background:C.inputBg, color:C.text, fontSize:14,
              fontFamily:"'Tajawal',sans-serif", outline:"none",
              direction: inputDir,
              textAlign: inputAlign,
              transition:"border-color .2s",
              WebkitTextSizeAdjust:"100%",
            }}
            onFocus={e => e.target.style.borderColor="#1a5c35"}
            onBlur={e => e.target.style.borderColor=C.inputBdr}
          />
          {/* زر الإرسال — Lucide */}
          <button type="submit" disabled={!input.trim()} className="send-btn-main"
            style={{ background:"#1a5c35", color:"white", border:"none",
              borderRadius:24, padding:"11px 18px", fontSize:13, fontWeight:700,
              cursor:"pointer", whiteSpace:"nowrap", flexShrink:0, minHeight:44,
              display:"flex", alignItems:"center", gap:6,
            }}>
            <Send size={15} strokeWidth={2.5}/>
            <span>إرسال</span>
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;