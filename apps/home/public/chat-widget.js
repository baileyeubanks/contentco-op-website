/**
 * Shared Site Assistant widget for Content Co-op, Co-Apps, and Astro Cleaning Services.
 * The backend stays centralized at the Content Co-op assistant route, while behavior
 * and theme adapt to the active domain or explicit loader config.
 */
(function () {
  "use strict";

  var config = window.__CCO_CHATBOT_CONFIG__ || {};
  var domain = (config.domain || window.location.hostname || "contentco-op.com").toLowerCase();
  var apiUrl = config.apiUrl || "https://contentco-op.com/api/chat";
  var assistantName = typeof config.assistantName === "string" ? config.assistantName.trim() : "";
  var surface = config.surface || "website";
  var storagePrefix = domain.replace(/[^a-z0-9]+/gi, "_");
  var conversationId = "";
  var userId = "";

  try {
    conversationId = sessionStorage.getItem(storagePrefix + "_chat_cid") || "";
    userId = sessionStorage.getItem(storagePrefix + "_chat_uid") || "";
    if (!userId) {
      userId = "web-" + (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : Date.now());
      sessionStorage.setItem(storagePrefix + "_chat_uid", userId);
    }
  } catch (e) {
    userId = "web-" + Date.now();
  }

  var messages = [];
  var isOpen = false;
  var isLoading = false;

  function isAlias(host, aliases) {
    return aliases.indexOf(host) >= 0;
  }

  function resolveProfile(host) {
    if (host.indexOf("astrocleanings.com") >= 0) {
      return {
        name: "Astro Cleaning",
        status: "Cleaning AI",
        subtitle: "Fast answers on service scope, pricing, and booking.",
        introTitle: "Ready to book a clean?",
        accent: "#6fd28f",
        accentRgb: "111,210,143",
        accentDim: "rgba(111,210,143,0.14)",
        accentBorder: "rgba(111,210,143,0.18)",
        bg: "#071611",
        panelBg: "#0b1d17",
        userBubble: "#1e6a47",
        inputBg: "rgba(11,29,23,0.84)",
        empty: "Ask about services, pricing, neighborhoods we serve, or the fastest way to book.",
        inputPlaceholder: "Ask about services, pricing, or booking...",
        prompts: ["What services do you offer?", "How much does a deep clean cost?", "What areas do you serve?"],
        ctaLabel: "Book a clean",
        ctaHref: "https://astrocleanings.com/book",
        secondaryLabel: "Email Astro",
        secondaryHref: "mailto:hello@astrocleanings.com",
      };
    }

    if (isAlias(host, ["script.contentco-op.com", "co-script.contentco-op.com", "coscript.contentco-op.com"])) {
      return {
        name: "Co-Script",
        status: "Pre-Production AI",
        subtitle: "Script, scope, and pre-production clarity without the back-and-forth.",
        introTitle: "Plan the production clearly.",
        accent: "#7eb5ff",
        accentRgb: "126,181,255",
        accentDim: "rgba(126,181,255,0.12)",
        accentBorder: "rgba(126,181,255,0.14)",
        bg: "#09111d",
        panelBg: "#0b1525",
        userBubble: "#2a5aa0",
        inputBg: "rgba(12,22,38,0.8)",
        empty: "Ask about scripting, storyboard direction, production planning, or what is live versus planned.",
        inputPlaceholder: "Ask about briefs, scope, or pre-production...",
        prompts: ["What does Co-Script do?", "How do you handle pre-production?", "What should be in a brief?"],
        ctaLabel: "Start a brief",
        ctaHref: "https://contentco-op.com/brief",
        secondaryLabel: "Email Bailey",
        secondaryHref: "mailto:bailey@contentco-op.com",
      };
    }

    if (isAlias(host, ["cut.contentco-op.com", "co-cut.contentco-op.com"])) {
      return {
        name: "Co-Cut",
        status: "Editing AI",
        subtitle: "Transcript-first editing, revisions, and delivery planning.",
        introTitle: "Shape the edit faster.",
        accent: "#c4722a",
        accentRgb: "196,114,42",
        accentDim: "rgba(196,114,42,0.12)",
        accentBorder: "rgba(196,114,42,0.14)",
        bg: "#0b1928",
        panelBg: "#0d1a2a",
        userBubble: "#8b5a2b",
        inputBg: "rgba(12,24,40,0.8)",
        empty: "Ask about transcript-first editing, captions, export variants, or support with your workflow.",
        inputPlaceholder: "Ask about revisions, captions, or delivery...",
        prompts: ["How does review and revision work?", "What export variants can you deliver?", "What is the edit workflow?"],
        ctaLabel: "Plan delivery",
        ctaHref: "https://contentco-op.com/brief",
        secondaryLabel: "Email Bailey",
        secondaryHref: "mailto:bailey@contentco-op.com",
      };
    }

    if (isAlias(host, ["deliver.contentco-op.com", "co-deliver.contentco-op.com", "codeliver.contentco-op.com", "coproof.contentco-op.com"])) {
      return {
        name: "Co-Deliver",
        status: "Review and Delivery AI",
        subtitle: "Approvals, feedback loops, and final delivery without the chaos.",
        introTitle: "Keep approvals moving.",
        accent: "#8fe1e5",
        accentRgb: "143,225,229",
        accentDim: "rgba(143,225,229,0.12)",
        accentBorder: "rgba(143,225,229,0.14)",
        bg: "#08111d",
        panelBg: "#0a1422",
        userBubble: "#2a7a7e",
        inputBg: "rgba(10,20,34,0.8)",
        empty: "Ask about review links, approvals, revisions, or final delivery workflows.",
        inputPlaceholder: "Ask about approvals, revisions, or handoff...",
        prompts: ["How do approvals work?", "Can you manage revisions?", "How do final deliveries get organized?"],
        ctaLabel: "Start a brief",
        ctaHref: "https://contentco-op.com/brief",
        secondaryLabel: "Email Bailey",
        secondaryHref: "mailto:bailey@contentco-op.com",
      };
    }

    return {
      name: "Content Co-op",
      status: "Production AI",
      subtitle: "Brief to pre-production, production, post, and delivery.",
      introTitle: "Plan the next production.",
      accent: "#4ade80",
      accentRgb: "74,222,128",
      accentDim: "rgba(74,222,128,0.12)",
      accentBorder: "rgba(74,222,128,0.18)",
      bg: "#0c1322",
      panelBg: "#0c1322",
      userBubble: "#1b6a42",
      inputBg: "rgba(15,25,40,0.8)",
      empty: "Ask about production services, the Co-App suite, timelines, pricing, or the right next step.",
      inputPlaceholder: "Ask about production, timing, or next steps...",
      prompts: ["What do you actually do?", "How fast can you crew a shoot?", "What should a creative brief include?"],
      ctaLabel: "Start a brief",
      ctaHref: "https://contentco-op.com/brief",
      secondaryLabel: "Email Bailey",
      secondaryHref: "mailto:bailey@contentco-op.com",
    };
  }

  var profile = resolveProfile(domain);
  if (assistantName) {
    profile.name = assistantName;
  }

  var style = document.createElement("style");
  style.textContent = [
    ".cco-ext-fab{position:fixed;bottom:1.5rem;right:1.5rem;z-index:9000;height:52px;min-width:52px;padding:0 0.95rem;border-radius:999px;",
    "border:1px solid " + profile.accentBorder + ";background:linear-gradient(180deg,rgba(8,16,29,0.92),rgba(6,12,22,0.9));color:" + profile.accent + ";",
    "display:flex;align-items:center;justify-content:center;gap:0.55rem;cursor:pointer;",
    "backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);",
    "box-shadow:0 18px 40px rgba(4,8,16,0.48);transition:transform 180ms,box-shadow 180ms,border-color 180ms;",
    "font-family:'Plus Jakarta Sans',system-ui,sans-serif;animation:ccoFabPulse 3.4s ease infinite;}",
    ".cco-ext-fab:hover{transform:translateY(-1px);box-shadow:0 22px 44px rgba(4,8,16,0.56);border-color:" + profile.accent + ";}",
    ".cco-ext-fab--active{animation:none;}",
    ".cco-ext-fab-icon{display:flex;align-items:center;justify-content:center;line-height:0;}",
    ".cco-ext-fab-label{font-size:0.76rem;font-weight:700;letter-spacing:0.02em;color:#edf4ff;white-space:nowrap;}",
    "@keyframes ccoFabPulse{0%,100%{box-shadow:0 18px 40px rgba(4,8,16,0.48),0 0 0 0 rgba(" + profile.accentRgb + ",0)}45%{box-shadow:0 18px 40px rgba(4,8,16,0.52),0 0 0 9px rgba(" + profile.accentRgb + ",0)}50%{box-shadow:0 18px 40px rgba(4,8,16,0.52),0 0 0 1px rgba(" + profile.accentRgb + ",0.28)}}",
    ".cco-ext-panel{position:fixed;bottom:5.3rem;right:1.5rem;z-index:8999;width:min(396px,calc(100vw - 1.5rem));max-height:min(620px,72vh);",
    "border-radius:24px;border:1px solid " + profile.accentBorder + ";background:linear-gradient(180deg,rgba(10,17,31,0.9),rgba(7,13,24,0.96));",
    "backdrop-filter:blur(26px);-webkit-backdrop-filter:blur(26px);",
    "box-shadow:0 26px 80px rgba(4,8,16,0.62);display:flex;flex-direction:column;overflow:hidden;",
    "animation:ccoExtSlide 250ms ease;font-family:'Plus Jakarta Sans',system-ui,sans-serif;}",
    ".cco-ext-panel:before{content:'';position:absolute;inset:0 0 auto 0;height:1px;background:linear-gradient(90deg,transparent," + profile.accent + ",transparent);opacity:0.8;}",
    ".cco-ext-hide{display:none!important;}",
    "@keyframes ccoExtSlide{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}",
    ".cco-ext-hdr{padding:1rem 1rem 0.85rem;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:flex-start;justify-content:space-between;gap:0.75rem;}",
    ".cco-ext-lockup{display:flex;flex-direction:column;gap:0.3rem;min-width:0;}",
    ".cco-ext-hdr-top{display:flex;align-items:center;gap:0.45rem;min-width:0;}",
    ".cco-ext-hdr-name{font-size:0.98rem;font-weight:700;color:#edf4ff;letter-spacing:-0.03em;font-family:'Fraunces',Georgia,serif;}",
    ".cco-ext-hdr-status{font-size:0.62rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:" + profile.accent + ";opacity:0.8;}",
    ".cco-ext-hdr-copy{font-size:0.73rem;line-height:1.45;color:rgba(210,224,245,0.68);max-width:28ch;}",
    ".cco-ext-close{width:34px;height:34px;border:none;border-radius:999px;background:rgba(255,255,255,0.04);color:rgba(230,240,255,0.82);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:background 150ms,color 150ms;}",
    ".cco-ext-close:hover{background:rgba(255,255,255,0.08);color:#fff;}",
    ".cco-ext-msgs{flex:1;overflow-y:auto;padding:0.95rem 1rem 0.4rem;display:flex;flex-direction:column;gap:0.65rem;min-height:210px;max-height:360px;}",
    ".cco-ext-empty{display:flex;flex-direction:column;gap:0.9rem;padding:0.25rem 0 0.5rem;}",
    ".cco-ext-intro{padding:1rem;border-radius:18px;background:linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02));border:1px solid rgba(255,255,255,0.06);}",
    ".cco-ext-intro-kicker{font-size:0.64rem;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:" + profile.accent + ";opacity:0.85;margin-bottom:0.45rem;}",
    ".cco-ext-intro-title{font-size:1.02rem;font-weight:700;line-height:1.18;color:#edf4ff;letter-spacing:-0.03em;margin-bottom:0.4rem;font-family:'Fraunces',Georgia,serif;}",
    ".cco-ext-intro-copy{color:rgba(214,227,245,0.72);font-size:0.8rem;line-height:1.6;}",
    ".cco-ext-prompts{display:flex;flex-wrap:wrap;gap:0.45rem;}",
    ".cco-ext-prompt{border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:#edf4ff;border-radius:999px;padding:0.5rem 0.72rem;font:inherit;font-size:0.72rem;line-height:1.2;cursor:pointer;transition:border-color 150ms,transform 150ms,background 150ms;}",
    ".cco-ext-prompt:hover{border-color:" + profile.accent + ";background:" + profile.accentDim + ";transform:translateY(-1px);}",
    ".cco-ext-links{display:flex;flex-wrap:wrap;gap:0.65rem;align-items:center;padding:0.1rem 0 0.2rem;}",
    ".cco-ext-link{font-size:0.72rem;font-weight:700;letter-spacing:0.02em;text-decoration:none;transition:transform 150ms,filter 150ms,opacity 150ms;}",
    ".cco-ext-link--primary{display:inline-flex;align-items:center;justify-content:center;min-height:36px;padding:0.55rem 0.85rem;border-radius:999px;background:linear-gradient(180deg," + profile.userBubble + "," + profile.accent + ");color:#edf4ff;box-shadow:0 12px 24px rgba(0,0,0,0.2);}",
    ".cco-ext-link--primary:hover{text-decoration:none;transform:translateY(-1px);filter:brightness(1.04);}",
    ".cco-ext-link--secondary{color:" + profile.accent + ";opacity:0.92;}",
    ".cco-ext-link--secondary:hover{text-decoration:underline;}",
    ".cco-ext-msg{max-width:86%;padding:0.7rem 0.82rem;border-radius:16px;font-size:0.8rem;line-height:1.58;word-break:break-word;white-space:pre-wrap;}",
    ".cco-ext-msg-user{align-self:flex-end;background:" + profile.userBubble + ";color:#edf4ff;border-bottom-right-radius:4px;}",
    ".cco-ext-msg-assistant{align-self:flex-start;background:linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025));color:rgba(226,237,252,0.9);border:1px solid " + profile.accentBorder + ";border-bottom-left-radius:4px;}",
    ".cco-ext-msg-assistant a{color:" + profile.accent + ";text-decoration:underline;text-decoration-thickness:1px;}",
    ".cco-ext-msg-assistant strong{color:#fff;font-weight:700;}",
    ".cco-ext-typing{display:flex;gap:4px;padding:0.7rem 0.9rem;}",
    ".cco-ext-typing span{width:5px;height:5px;border-radius:50%;background:" + profile.accent + ";opacity:0.5;animation:ccoExtDot 1.2s ease infinite;}",
    ".cco-ext-typing span:nth-child(2){animation-delay:0.15s;}.cco-ext-typing span:nth-child(3){animation-delay:0.3s;}",
    "@keyframes ccoExtDot{0%,60%,100%{opacity:0.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-4px)}}",
    ".cco-ext-form-wrap{padding:0.85rem 1rem 1rem;border-top:1px solid rgba(255,255,255,0.06);background:linear-gradient(180deg,rgba(7,13,24,0.28),rgba(4,9,18,0.56));}",
    ".cco-ext-form{display:flex;gap:0.45rem;align-items:flex-end;}",
    ".cco-ext-input{flex:1;border:1px solid rgba(255,255,255,0.08);border-radius:14px;background:" + profile.inputBg + ";",
    "color:#edf4ff;padding:0.78rem 0.9rem;font-size:0.82rem;font-family:inherit;outline:none;transition:border-color 150ms,box-shadow 150ms,background 150ms;min-height:46px;}",
    ".cco-ext-input:focus{border-color:" + profile.accent + ";box-shadow:0 0 0 4px rgba(" + profile.accentRgb + ",0.12);background:rgba(15,25,40,0.94);}",
    ".cco-ext-input::placeholder{color:" + profile.accent + ";opacity:0.35;}",
    ".cco-ext-send{width:46px;height:46px;border-radius:14px;border:none;background:linear-gradient(180deg," + profile.userBubble + "," + profile.accent + ");color:#edf4ff;",
    "display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform 150ms,opacity 150ms,filter 150ms;flex-shrink:0;box-shadow:0 14px 28px rgba(0,0,0,0.22);}",
    ".cco-ext-send:hover{transform:translateY(-1px);filter:brightness(1.05);}",
    ".cco-ext-send:disabled{opacity:0.35;cursor:not-allowed;}",
    ".cco-ext-footnote{padding-top:0.45rem;color:rgba(188,204,228,0.46);font-size:0.66rem;line-height:1.4;}",
    ".cco-ext-footnote a{color:" + profile.accent + ";text-decoration:none;font-weight:700;}",
    ".cco-ext-footnote a:hover{text-decoration:underline;}",
    "@media(max-width:480px){.cco-ext-panel{width:calc(100vw - 1rem);right:0.5rem;bottom:4.5rem;max-height:78vh;border-radius:22px;}",
    ".cco-ext-fab{bottom:1rem;right:1rem;height:46px;padding:0 0.82rem;}.cco-ext-fab-label{display:none;}.cco-ext-msgs{max-height:44vh;}.cco-ext-hdr-copy{max-width:none;}}"
  ].join("\n");
  document.head.appendChild(style);

  function el(tag, cls, html) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html !== undefined) node.innerHTML = html;
    return node;
  }

  var chatIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>';
  var closeIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';
  var sendIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';

  var fab = el("button", "cco-ext-fab");
  fab.innerHTML = '<span class="cco-ext-fab-icon">' + chatIcon + '</span><span class="cco-ext-fab-label">Ask ' + profile.name + "</span>";
  fab.setAttribute("aria-label", "Chat with us");
  fab.addEventListener("click", toggle);

  var panel = el("div", "cco-ext-panel cco-ext-hide");
  var hdr = el("div", "cco-ext-hdr");
  var lockup = el("div", "cco-ext-lockup");
  lockup.innerHTML = [
    '<div class="cco-ext-hdr-top"><span class="cco-ext-hdr-name">' + profile.name + '</span><span class="cco-ext-hdr-status">' + profile.status + "</span></div>",
    '<div class="cco-ext-hdr-copy">' + profile.subtitle + "</div>",
  ].join("");
  var closeBtn = el("button", "cco-ext-close", closeIcon);
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Close chat");
  closeBtn.addEventListener("click", toggle);
  hdr.appendChild(lockup);
  hdr.appendChild(closeBtn);
  var msgBox = el("div", "cco-ext-msgs");
  msgBox.appendChild(buildEmptyState());

  var formWrap = el("div", "cco-ext-form-wrap");
  var form = el("form", "cco-ext-form");
  var input = el("input", "cco-ext-input");
  input.type = "text";
  input.placeholder = profile.inputPlaceholder || "Ask a question...";
  input.autocomplete = "off";
  var sendBtn = el("button", "cco-ext-send", sendIcon);
  sendBtn.type = "submit";
  form.appendChild(input);
  form.appendChild(sendBtn);
  form.addEventListener("submit", handleSend);
  formWrap.appendChild(form);
  var footnote = el("div", "cco-ext-footnote");
  footnote.innerHTML = profile.secondaryLabel && profile.secondaryHref
    ? 'Live answers first. Prefer a human? <a href="' + profile.secondaryHref + '">' + profile.secondaryLabel + '</a>.'
    : "Live answers first.";
  formWrap.appendChild(footnote);

  panel.appendChild(hdr);
  panel.appendChild(msgBox);
  panel.appendChild(formWrap);

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  function toggle() {
    isOpen = !isOpen;
    panel.classList.toggle("cco-ext-hide", !isOpen);
    fab.classList.toggle("cco-ext-fab--active", isOpen);
    fab.innerHTML = isOpen
      ? '<span class="cco-ext-fab-icon">' + closeIcon + "</span>"
      : '<span class="cco-ext-fab-icon">' + chatIcon + '</span><span class="cco-ext-fab-label">Ask ' + profile.name + "</span>";
    fab.setAttribute("aria-label", isOpen ? "Close chat" : "Chat with us");
    if (isOpen) input.focus();
  }

  function handleKeydown(event) {
    if (event.key === "Escape" && isOpen) {
      toggle();
      fab.focus();
    }
  }

  document.addEventListener("keydown", handleKeydown);

  function render() {
    msgBox.innerHTML = "";
    if (!messages.length) {
      msgBox.appendChild(buildEmptyState());
      return;
    }
    messages.forEach(function (message) {
      var bubble = el("div", "cco-ext-msg cco-ext-msg-" + message.role);
      if (message.role === "assistant") {
        bubble.innerHTML = formatAssistantMessage(message.content);
      } else {
        bubble.textContent = message.content;
      }
      msgBox.appendChild(bubble);
    });
    if (isLoading) {
      var dots = el("div", "cco-ext-msg cco-ext-msg-assistant cco-ext-typing", "<span></span><span></span><span></span>");
      msgBox.appendChild(dots);
    }
    msgBox.scrollTop = msgBox.scrollHeight;
  }

  function handleSend(event) {
    if (event) event.preventDefault();
    sendMessage(input.value.trim());
  }

  function buildEmptyState() {
    var emptyEl = el("div", "cco-ext-empty");
    var introCard = el("div", "cco-ext-intro");
    introCard.innerHTML = [
      '<div class="cco-ext-intro-kicker">' + profile.status + "</div>",
      '<div class="cco-ext-intro-title">' + (profile.introTitle || "Start with the right question.") + "</div>",
      '<div class="cco-ext-intro-copy">' + profile.empty + "</div>",
    ].join("");

    var promptRail = el("div", "cco-ext-prompts");
    (profile.prompts || []).forEach(function (prompt) {
      var promptBtn = el("button", "cco-ext-prompt");
      promptBtn.type = "button";
      promptBtn.textContent = prompt;
      promptBtn.addEventListener("click", function () {
        sendMessage(prompt);
      });
      promptRail.appendChild(promptBtn);
    });

    var linksRow = el("div", "cco-ext-links");
    if (profile.ctaLabel && profile.ctaHref) {
      var ctaLink = el("a", "cco-ext-link cco-ext-link--primary");
      ctaLink.href = profile.ctaHref;
      ctaLink.textContent = profile.ctaLabel;
      linksRow.appendChild(ctaLink);
    }
    if (profile.secondaryLabel && profile.secondaryHref) {
      var secondaryLink = el("a", "cco-ext-link cco-ext-link--secondary");
      secondaryLink.href = profile.secondaryHref;
      secondaryLink.textContent = profile.secondaryLabel;
      linksRow.appendChild(secondaryLink);
    }

    emptyEl.appendChild(introCard);
    if (promptRail.childNodes.length) emptyEl.appendChild(promptRail);
    if (linksRow.childNodes.length) emptyEl.appendChild(linksRow);
    return emptyEl;
  }

  function sendMessage(message) {
    if (!message || isLoading) return;

    input.value = "";
    messages.push({ role: "user", content: message });
    isLoading = true;
    sendBtn.disabled = true;
    render();

    fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: message,
        conversationId: conversationId,
        domain: domain,
        pathname: window.location.pathname,
        surface: surface,
        userId: userId,
      }),
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        if (data.conversation_id) {
          conversationId = data.conversation_id;
          try {
            sessionStorage.setItem(storagePrefix + "_chat_cid", conversationId);
          } catch (e) {}
        }
        messages.push({
          role: "assistant",
          content: data.answer || "Sorry, I could not generate a response.",
        });
      })
      .catch(function () {
        messages.push({
          role: "assistant",
          content: "Something went wrong. Please try again in a moment.",
        });
      })
      .finally(function () {
        isLoading = false;
        sendBtn.disabled = false;
        render();
      });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatAssistantMessage(value) {
    var html = escapeHtml(value);
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
    html = html.replace(
      /((?:https?:\/\/|mailto:)[^\s<]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<]*)?)/gi,
      function (match) {
        var href = match;
        if (!/^https?:\/\//i.test(href) && !/^mailto:/i.test(href)) {
          href = href.indexOf("@") >= 0 ? "mailto:" + href : "https://" + href;
        }
        return '<a href="' + href + '" target="_blank" rel="noopener">' + match + "</a>";
      }
    );
    return html.replace(/\n/g, "<br>");
  }
})();
