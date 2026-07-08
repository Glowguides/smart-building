/* ═══════════════════════════════════════════════════════════════════════════
   BUILDING ASSISTANT — in-site Claude chatbot widget (self-contained)
   Injects its own styles + DOM. Talks to the Cloudflare Worker proxy.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ⚠️ After deploying the Worker (see chatbot/README.md), paste its URL here: */
const WORKER_URL = "https://smart-building-chatbot.glowguides.workers.dev";

(function () {
  if (window.__buildingAssistantLoaded) return;
  window.__buildingAssistantLoaded = true;

  const history = []; // {role, content}

  /* ── Styles ───────────────────────────────────────────────────────────── */
  const css = `
  .ba-fab {
    position: fixed; bottom: 24px; right: 24px; z-index: 9998;
    width: 60px; height: 60px; border-radius: 50%; border: none; cursor: pointer;
    background: linear-gradient(135deg, #6366f1, #06b6d4);
    box-shadow: 0 8px 30px rgba(99,102,241,.45); color: #fff;
    display: flex; align-items: center; justify-content: center;
    transition: transform .25s cubic-bezier(.34,1.56,.64,1), box-shadow .25s;
  }
  .ba-fab:hover { transform: translateY(-3px) scale(1.05); box-shadow: 0 12px 40px rgba(99,102,241,.6); }
  .ba-fab svg { width: 26px; height: 26px; }
  .ba-fab .ba-dot { position:absolute; top:12px; right:12px; width:9px; height:9px; border-radius:50%;
    background:#34d399; box-shadow:0 0 8px #34d399; }

  .ba-panel {
    position: fixed; bottom: 96px; right: 24px; z-index: 9999;
    width: 380px; max-width: calc(100vw - 32px); height: 560px; max-height: calc(100vh - 130px);
    background: rgba(10,15,28,.85); backdrop-filter: blur(22px); -webkit-backdrop-filter: blur(22px);
    border: 1px solid rgba(148,163,184,.14); border-radius: 18px;
    box-shadow: 0 24px 70px rgba(0,0,0,.55), 0 0 0 1px rgba(99,102,241,.1);
    display: flex; flex-direction: column; overflow: hidden;
    opacity: 0; transform: translateY(20px) scale(.97); pointer-events: none;
    transition: opacity .28s, transform .28s cubic-bezier(.34,1.56,.64,1);
    font-family: 'Inter', system-ui, sans-serif;
  }
  .ba-panel.open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }

  .ba-head { display:flex; align-items:center; gap:.7rem; padding: 1rem 1.1rem;
    border-bottom: 1px solid rgba(148,163,184,.1); }
  .ba-head-icon { width:36px; height:36px; border-radius:10px; flex-shrink:0;
    background: linear-gradient(135deg,#6366f1,#06b6d4); display:flex; align-items:center; justify-content:center; }
  .ba-head-icon svg { width:19px; height:19px; color:#fff; }
  .ba-head-title { font-weight:800; font-size:.95rem; color:#f1f5f9; letter-spacing:-.01em; }
  .ba-head-sub { font-size:.68rem; color:#64748b; font-family:'JetBrains Mono',monospace; }
  .ba-close { margin-left:auto; background:none; border:none; color:#64748b; cursor:pointer; padding:6px; border-radius:8px; }
  .ba-close:hover { color:#f1f5f9; background:rgba(148,163,184,.08); }
  .ba-close svg { width:18px; height:18px; }

  .ba-body { flex:1; overflow-y:auto; padding: 1.1rem; display:flex; flex-direction:column; gap:.9rem; }
  .ba-body::-webkit-scrollbar { width:5px; }
  .ba-body::-webkit-scrollbar-thumb { background:rgba(99,102,241,.4); border-radius:3px; }

  .ba-msg { max-width: 85%; padding:.7rem .9rem; border-radius:14px; font-size:.86rem; line-height:1.5; white-space:pre-wrap; word-wrap:break-word; }
  .ba-msg.user { align-self:flex-end; background:linear-gradient(135deg,#6366f1,#4f46e5); color:#fff; border-bottom-right-radius:4px; }
  .ba-msg.bot  { align-self:flex-start; background:rgba(30,41,59,.7); color:#e2e8f0; border:1px solid rgba(148,163,184,.1); border-bottom-left-radius:4px; }
  .ba-msg.bot a { color:#67e8f9; text-decoration:underline; }
  .ba-msg.err { align-self:flex-start; background:rgba(244,63,94,.12); color:#fda4af; border:1px solid rgba(244,63,94,.2); font-size:.82rem; }

  .ba-chips { display:flex; flex-wrap:wrap; gap:.4rem; }
  .ba-chip { font-size:.74rem; color:#a5b4fc; background:rgba(99,102,241,.1); border:1px solid rgba(99,102,241,.22);
    border-radius:99px; padding:.35rem .7rem; cursor:pointer; transition:background .15s,border-color .15s; }
  .ba-chip:hover { background:rgba(99,102,241,.2); border-color:rgba(99,102,241,.5); }

  .ba-typing { align-self:flex-start; display:flex; gap:4px; padding:.8rem .9rem; background:rgba(30,41,59,.7);
    border:1px solid rgba(148,163,184,.1); border-radius:14px; border-bottom-left-radius:4px; }
  .ba-typing span { width:7px; height:7px; border-radius:50%; background:#64748b; animation:ba-bounce 1.2s infinite ease-in-out; }
  .ba-typing span:nth-child(2){ animation-delay:.15s } .ba-typing span:nth-child(3){ animation-delay:.3s }
  @keyframes ba-bounce { 0%,60%,100%{ transform:translateY(0); opacity:.5 } 30%{ transform:translateY(-5px); opacity:1 } }

  .ba-foot { padding:.8rem; border-top:1px solid rgba(148,163,184,.1); display:flex; gap:.5rem; }
  .ba-input { flex:1; background:rgba(15,23,42,.8); border:1px solid rgba(148,163,184,.14); border-radius:11px;
    padding:.65rem .85rem; color:#f1f5f9; font-size:.86rem; outline:none; font-family:inherit; resize:none; max-height:90px; }
  .ba-input:focus { border-color:rgba(99,102,241,.5); }
  .ba-input::placeholder { color:#475569; }
  .ba-send { border:none; border-radius:11px; width:42px; flex-shrink:0; cursor:pointer; color:#fff;
    background:linear-gradient(135deg,#6366f1,#06b6d4); display:flex; align-items:center; justify-content:center; transition:opacity .2s; }
  .ba-send:disabled { opacity:.4; cursor:not-allowed; }
  .ba-send svg { width:18px; height:18px; }
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  /* ── DOM ──────────────────────────────────────────────────────────────── */
  const fab = document.createElement("button");
  fab.className = "ba-fab";
  fab.title = "Ask the Building Assistant";
  fab.innerHTML = `<span class="ba-dot"></span>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;

  const panel = document.createElement("div");
  panel.className = "ba-panel";
  panel.innerHTML = `
    <div class="ba-head">
      <div class="ba-head-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M2 14h2M20 14h2M15 13v2M9 13v2"/></svg></div>
      <div>
        <div class="ba-head-title">Watt · Building Assistant</div>
        <div class="ba-head-sub">AI energy sidekick</div>
      </div>
      <button class="ba-close" title="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
    <div class="ba-body" id="ba-body"></div>
    <div class="ba-foot">
      <textarea class="ba-input" id="ba-input" rows="1" placeholder="Ask about energy, solar, your building…"></textarea>
      <button class="ba-send" id="ba-send" title="Send"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
    </div>`;

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  const body = panel.querySelector("#ba-body");
  const input = panel.querySelector("#ba-input");
  const sendBtn = panel.querySelector("#ba-send");

  /* ── Helpers ──────────────────────────────────────────────────────────── */
  function pageName() {
    const f = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    return f || "index.html";
  }
  function scrollDown() { body.scrollTop = body.scrollHeight; }

  function linkify(text) {
    const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    // link bare *.html page references
    return esc.replace(/\b([a-z]+\.html)\b/g, '<a href="$1">$1</a>')
              .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  }

  function addMsg(role, text) {
    const el = document.createElement("div");
    el.className = "ba-msg " + role;
    if (role === "bot") el.innerHTML = linkify(text);
    else el.textContent = text;
    body.appendChild(el);
    scrollDown();
    return el;
  }

  function addTyping() {
    const t = document.createElement("div");
    t.className = "ba-typing";
    t.innerHTML = "<span></span><span></span><span></span>";
    body.appendChild(t);
    scrollDown();
    return t;
  }

  function addChips() {
    const wrap = document.createElement("div");
    wrap.className = "ba-chips";
    const chips = [
      "Is solar worth it for a 60m² roof in Marrakech?",
      "What's the current building load?",
      "Best energy source for Casablanca?",
      "Estimate heat loss for a 150m² office",
    ];
    chips.forEach((c) => {
      const b = document.createElement("button");
      b.className = "ba-chip";
      b.textContent = c;
      b.onclick = () => { input.value = c; send(); };
      wrap.appendChild(b);
    });
    body.appendChild(wrap);
  }

  /* ── Send ─────────────────────────────────────────────────────────────── */
  let busy = false;
  async function send() {
    const text = input.value.trim();
    if (!text || busy) return;
    if (WORKER_URL.includes("YOUR-SUBDOMAIN")) {
      addMsg("err", "⚙️ The assistant isn't connected yet. Deploy the Worker (see chatbot/README.md) and set WORKER_URL in js/chatbot.js.");
      return;
    }
    busy = true; sendBtn.disabled = true;
    input.value = ""; input.style.height = "auto";
    addMsg("user", text);
    history.push({ role: "user", content: text });

    const typing = addTyping();
    try {
      const res = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, context: { page: pageName() } }),
      });
      const data = await res.json();
      typing.remove();
      if (data.reply) {
        addMsg("bot", data.reply);
        history.push({ role: "assistant", content: data.reply });
      } else {
        addMsg("err", data.error ? `Error: ${data.error}` : "Sorry, something went wrong.");
      }
    } catch (e) {
      typing.remove();
      addMsg("err", "Network error reaching the assistant. Check your connection or the Worker URL.");
    } finally {
      busy = false; sendBtn.disabled = false; input.focus();
    }
  }

  /* ── Events ───────────────────────────────────────────────────────────── */
  let opened = false;
  function toggle() {
    panel.classList.toggle("open");
    if (panel.classList.contains("open") && !opened) {
      opened = true;
      addMsg("bot", "Hey, I'm Watt ⚡ — your building energy sidekick.\nI run real solar & thermal calcs, find the best energy source for any spot on Earth, read the live dashboard, and generally know my stuff (memes included). Throw me something:");
      addChips();
      setTimeout(() => input.focus(), 300);
    } else if (panel.classList.contains("open")) {
      setTimeout(() => input.focus(), 300);
    }
  }

  fab.onclick = toggle;
  panel.querySelector(".ba-close").onclick = () => panel.classList.remove("open");
  sendBtn.onclick = send;
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  });
  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 90) + "px";
  });
})();
