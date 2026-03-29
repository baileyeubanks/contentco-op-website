/**
 * Content Co-op — Dify Chat Widget
 *
 * Renders a floating chat bubble on any CCO/Co-App page.
 * When opened, shows the Dify chatbot UI inside an iframe.
 *
 * Configure before loading the script (optional):
 *   window.__DIFY_CHAT_CONFIG__ = {
 *     baseUrl : 'https://dify.yourdomain.com',  // Dify instance URL
 *     token   : 'your-app-token',               // Dify public chatbot token
 *     // Optional overrides:
 *     domain        : 'script.contentco-op.com', // force a brand theme
 *     assistantName : 'Custom Name',
 *   };
 *
 * Served at: contentco-op.com/chat-widget.js
 * Embed via: <script src="https://contentco-op.com/chat-widget.js" defer></script>
 */
(function () {
  "use strict";

  var cfg = window.__DIFY_CHAT_CONFIG__ || {};

  // ── Dify connection ──
  // baseUrl: where Dify is deployed (NAS or external domain)
  // token  : public chatbot app token from Dify → App → "Embedded" tab
  var DIFY_BASE_URL = (cfg.baseUrl || "").replace(/\/$/, "");
  var DIFY_TOKEN    = cfg.token || "";

  // Build the iframe src — Dify public chatbot endpoint
  // ?mode=fullscreen hides Dify's own header chrome for a cleaner embed
  function buildChatUrl() {
    if (!DIFY_BASE_URL || !DIFY_TOKEN) return "";
    return DIFY_BASE_URL + "/chat/" + DIFY_TOKEN + "?mode=fullscreen";
  }

  // ── Brand / theme resolution ──
  var domain = (cfg.domain || window.location.hostname || "").toLowerCase();

  function resolveProfile(host) {
    if (host.indexOf("astrocleanings.com") >= 0) {
      return {
        name: "Astro Cleaning",
        status: "Cleaning AI",
        accent: "#6fd28f",
        accentBorder: "rgba(111,210,143,0.22)",
        bg: "#071611",
        panelBg: "#0b1d17",
        userBubble: "#1e6a47",
      };
    }
    if (host.indexOf("script.") >= 0 || host.indexOf("coscript") >= 0) {
      return {
        name: "Co-Script",
        status: "Pre-Production AI",
        accent: "#7eb5ff",
        accentBorder: "rgba(126,181,255,0.18)",
        bg: "#09111d",
        panelBg: "#0b1525",
        userBubble: "#2a5aa0",
      };
    }
    if (host.indexOf("cut.") >= 0 || host.indexOf("cocut") >= 0) {
      return {
        name: "Co-Cut",
        status: "Editing AI",
        accent: "#c4722a",
        accentBorder: "rgba(196,114,42,0.18)",
        bg: "#0b1928",
        panelBg: "#0d1a2a",
        userBubble: "#8b5a2b",
      };
    }
    if (host.indexOf("deliver.") >= 0 || host.indexOf("codeliver") >= 0 || host.indexOf("coproof") >= 0) {
      return {
        name: "Co-Deliver",
        status: "Review & Delivery AI",
        accent: "#8fe1e5",
        accentBorder: "rgba(143,225,229,0.18)",
        bg: "#08111d",
        panelBg: "#0a1422",
        userBubble: "#2a7a7e",
      };
    }
    return {
      name: "Content Co-op",
      status: "AI Assistant",
      accent: "#7eb5ff",
      accentBorder: "rgba(179,200,240,0.18)",
      bg: "#0c1322",
      panelBg: "#0c1322",
      userBubble: "#1e4d8c",
    };
  }

  var p = resolveProfile(domain);
  if (typeof cfg.assistantName === "string" && cfg.assistantName.trim()) {
    p.name = cfg.assistantName.trim();
  }

  // ── Styles ──
  var style = document.createElement("style");
  style.textContent = [
    /* FAB button */
    ".cco-fab{position:fixed;bottom:1.5rem;right:1.5rem;z-index:9000;",
    "width:52px;height:52px;border-radius:50%;",
    "border:1px solid " + p.accentBorder + ";",
    "background:" + p.bg + ";color:" + p.accent + ";",
    "display:flex;align-items:center;justify-content:center;cursor:pointer;",
    "box-shadow:0 8px 28px rgba(4,8,16,0.45);transition:transform 200ms,box-shadow 200ms;",
    "font-family:'Plus Jakarta Sans',system-ui,sans-serif;}",
    ".cco-fab:hover{transform:scale(1.08);box-shadow:0 12px 36px rgba(4,8,16,0.55);}",

    /* Panel */
    ".cco-panel{position:fixed;bottom:5rem;right:1.5rem;z-index:8999;",
    "width:400px;height:600px;border-radius:16px;",
    "border:1px solid " + p.accentBorder + ";",
    "background:" + p.panelBg + ";",
    "box-shadow:0 24px 64px rgba(4,8,16,0.6);",
    "display:flex;flex-direction:column;overflow:hidden;",
    "animation:ccoPanelIn 240ms ease;",
    "font-family:'Plus Jakarta Sans',system-ui,sans-serif;}",
    ".cco-panel-hide{display:none!important;}",
    "@keyframes ccoPanelIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}",

    /* Panel header */
    ".cco-hdr{display:flex;align-items:baseline;justify-content:space-between;",
    "padding:0.85rem 1rem;border-bottom:1px solid " + p.accentBorder + ";",
    "background:" + p.bg + ";}",
    ".cco-hdr-left{display:flex;align-items:baseline;gap:0.45rem;}",
    ".cco-hdr-name{font-size:0.85rem;font-weight:700;color:#edf4ff;letter-spacing:-0.01em;}",
    ".cco-hdr-status{font-size:0.6rem;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;",
    "color:" + p.accent + ";opacity:0.6;}",
    ".cco-hdr-close{background:none;border:none;color:" + p.accent + ";opacity:0.55;cursor:pointer;",
    "padding:0;display:flex;align-items:center;transition:opacity 150ms;}",
    ".cco-hdr-close:hover{opacity:1;}",

    /* iframe */
    ".cco-iframe{flex:1;border:none;width:100%;background:" + p.panelBg + ";}",

    /* No-config fallback */
    ".cco-placeholder{flex:1;display:flex;align-items:center;justify-content:center;",
    "color:rgba(180,200,230,0.4);font-size:0.82rem;text-align:center;padding:1.5rem;}",

    /* Responsive */
    "@media(max-width:480px){",
    ".cco-panel{width:calc(100vw - 1.2rem);right:0.6rem;bottom:4.5rem;height:75vh;}",
    ".cco-fab{bottom:1rem;right:1rem;width:46px;height:46px;}}",
  ].join("");
  document.head.appendChild(style);

  // ── Icons ──
  var ICON_CHAT  = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>';
  var ICON_CLOSE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  // ── DOM ──
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  }

  var fab = el("button", "cco-fab", ICON_CHAT);
  fab.setAttribute("aria-label", "Chat with us");
  fab.setAttribute("aria-expanded", "false");

  var panel = el("div", "cco-panel cco-panel-hide");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", p.name + " chat");

  // Header
  var hdr = el("div", "cco-hdr");
  var hdrLeft = el("div", "cco-hdr-left");
  hdrLeft.innerHTML =
    '<span class="cco-hdr-name">' + p.name + '</span>' +
    '<span class="cco-hdr-status">' + p.status + '</span>';
  var closeBtn = el("button", "cco-hdr-close", ICON_CLOSE);
  closeBtn.setAttribute("aria-label", "Close chat");
  hdr.appendChild(hdrLeft);
  hdr.appendChild(closeBtn);
  panel.appendChild(hdr);

  // Content: iframe or placeholder
  var chatUrl = buildChatUrl();
  if (chatUrl) {
    var iframe = el("iframe", "cco-iframe");
    iframe.setAttribute("allow", "microphone");
    iframe.setAttribute("title", p.name);
    // src is set lazily on first open so there is no wasted request on page load
    iframe._src = chatUrl;
    panel.appendChild(iframe);
  } else {
    var placeholder = el("div", "cco-placeholder",
      "Chat is not configured yet.<br>Set <code>window.__DIFY_CHAT_CONFIG__</code> with <em>baseUrl</em> and <em>token</em>."
    );
    panel.appendChild(placeholder);
  }

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  // ── State ──
  var isOpen = false;

  function open() {
    isOpen = true;
    panel.classList.remove("cco-panel-hide");
    fab.innerHTML = ICON_CLOSE;
    fab.setAttribute("aria-label", "Close chat");
    fab.setAttribute("aria-expanded", "true");
    // Lazy-load the iframe src on first open
    if (iframe && iframe._src && !iframe.src) {
      iframe.src = iframe._src;
    }
  }

  function close() {
    isOpen = false;
    panel.classList.add("cco-panel-hide");
    fab.innerHTML = ICON_CHAT;
    fab.setAttribute("aria-label", "Chat with us");
    fab.setAttribute("aria-expanded", "false");
  }

  fab.addEventListener("click", function () {
    isOpen ? close() : open();
  });
  closeBtn.addEventListener("click", close);

  // Close on Escape
  document.addEventListener("keydown", function (e) {
    if (isOpen && (e.key === "Escape" || e.keyCode === 27)) close();
  });
})();
