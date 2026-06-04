/**
 * Shared site assistant widget.
 * Uses the Content Co-op brand system for a minimal public chat launcher.
 */
(function () {
  "use strict";

  var config = window.__CCO_CHATBOT_CONFIG__ || {};
  var domain = (config.domain || window.location.hostname || "contentco-op.com").toLowerCase();
  var apiUrl = config.apiUrl || "https://contentco-op.com/api/chat";
  var assistantName = typeof config.assistantName === "string" ? config.assistantName.trim() : "";
  var brandMarkUrl = typeof config.brandMarkUrl === "string" ? config.brandMarkUrl.trim() : "";
  var surface = config.surface || "website";
  var launcherLabel = typeof config.launcherLabel === "string" ? config.launcherLabel.trim() : "";
  var hintLabel = typeof config.hintLabel === "string" ? config.hintLabel.trim() : "Have a question?";
  var telegramBotUsername = typeof config.telegramBotUsername === "string"
    ? config.telegramBotUsername.replace(/^@+/, "").trim()
    : "";
  var telegramStartParam = typeof config.telegramStartParam === "string" && config.telegramStartParam.trim()
    ? config.telegramStartParam.trim()
    : "from_site";
  var telegramLabel = typeof config.telegramLabel === "string" && config.telegramLabel.trim()
    ? config.telegramLabel.trim()
    : "Open in Telegram";
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

  function telegramHref() {
    if (!telegramBotUsername) return "";
    var href = "https://t.me/" + telegramBotUsername;
    if (telegramStartParam) {
      href += "?start=" + encodeURIComponent(telegramStartParam);
    }
    return href;
  }

  function resolveProfile(host) {
    if (host.indexOf("astrocleanings.com") >= 0) {
      return {
        name: "Astro Assistant",
        meta: "Astro Cleaning",
        empty: "Ask about services, pricing, neighborhoods, or booking.",
        inputPlaceholder: "Ask about cleaning or booking...",
        ctaLabel: "Book a clean",
        ctaHref: "https://astrocleanings.com/book",
        accent: "#1f7a57",
        accentRgb: "31,122,87",
      };
    }

    if (isAlias(host, ["script.contentco-op.com", "co-script.contentco-op.com", "coscript.contentco-op.com"])) {
      return {
        name: "Co-Script",
        meta: "Pre-Production",
        empty: "Ask about briefs, scripting, scope, or pre-production.",
        inputPlaceholder: "Ask about briefs or pre-production...",
        ctaLabel: "Start a brief",
        ctaHref: "https://contentco-op.com/brief",
        accent: "#1e4d8c",
        accentRgb: "30,77,140",
      };
    }

    if (isAlias(host, ["cut.contentco-op.com", "co-cut.contentco-op.com"])) {
      return {
        name: "Co-Cut",
        meta: "Post-Production",
        empty: "Ask about revisions, captions, exports, or edit workflow.",
        inputPlaceholder: "Ask about revisions or exports...",
        ctaLabel: "Start a brief",
        ctaHref: "https://contentco-op.com/brief",
        accent: "#8a5a2d",
        accentRgb: "138,90,45",
      };
    }

    if (isAlias(host, ["deliver.contentco-op.com", "co-deliver.contentco-op.com", "codeliver.contentco-op.com", "coproof.contentco-op.com"])) {
      return {
        name: "Co-Deliver",
        meta: "Review and Delivery",
        empty: "Ask about approvals, review links, revisions, or delivery.",
        inputPlaceholder: "Ask about approvals or delivery...",
        ctaLabel: "Start a brief",
        ctaHref: "https://contentco-op.com/brief",
        accent: "#1f6f82",
        accentRgb: "31,111,130",
      };
    }

    return {
      name: "Agent CCO",
      meta: "Content Co-op",
      empty: "Ask about scope, timing, pricing, or the right next step.",
      inputPlaceholder: "Ask about your project...",
      ctaLabel: "Start a brief",
      ctaHref: "https://contentco-op.com/brief",
      accent: "#1e4d8c",
      accentRgb: "30,77,140",
    };
  }

  var profile = resolveProfile(domain);
  if (assistantName) {
    profile.name = assistantName;
  }

  var style = document.createElement("style");
  style.textContent = [
    ".cco-ext-root{position:fixed;right:1.25rem;bottom:1.25rem;z-index:9000;display:flex;flex-direction:column;align-items:flex-end;font-family:'Plus Jakarta Sans',system-ui,sans-serif;}",
    ".cco-ext-launcher{min-height:3.3rem;padding:0.38rem 0.78rem;border:1px solid #d8cfc0;border-radius:999px;display:inline-flex;align-items:center;gap:0.58rem;background:#f4eee2;box-shadow:0 18px 40px rgba(11,25,40,0.1);cursor:pointer;transition:transform 180ms ease,box-shadow 180ms ease,opacity 180ms ease,border-color 180ms ease;}",
    ".cco-ext-launcher:hover,.cco-ext-launcher:focus-visible{transform:translateY(-2px);box-shadow:0 24px 44px rgba(11,25,40,0.14);border-color:rgba(" + profile.accentRgb + ",0.32);outline:none;}",
    ".cco-ext-launcher:focus-visible{box-shadow:0 0 0 4px rgba(" + profile.accentRgb + ",0.12),0 24px 44px rgba(11,25,40,0.14);}",
    ".cco-ext-launcher--hidden{opacity:0;transform:translateY(0.6rem) scale(0.96);pointer-events:none;}",
    ".cco-ext-launcher-copy{display:inline-flex;align-items:center;color:#0b1928;font-size:0.82rem;font-weight:600;line-height:1;letter-spacing:0.01em;white-space:nowrap;}",
    ".cco-ext-launcher-markwrap{display:flex;align-items:center;justify-content:center;width:1.45rem;height:1.45rem;flex-shrink:0;}",
    ".cco-ext-launcher-mark{width:1.34rem;height:1.34rem;object-fit:contain;display:block;pointer-events:none;filter:none;transition:transform 220ms ease;}",
    ".cco-ext-launcher:hover .cco-ext-launcher-mark,.cco-ext-launcher:focus-visible .cco-ext-launcher-mark{animation:ccoExtLauncherBob 560ms cubic-bezier(0.34,1.56,0.64,1);}",
    ".cco-ext-launcher-icon{width:1.12rem;height:1.12rem;color:" + profile.accent + ";display:block;}",
    "@keyframes ccoExtLauncherBob{0%,100%{transform:translateY(0) rotate(0deg)}30%{transform:translateY(-5px) rotate(-4deg)}62%{transform:translateY(1px) rotate(4deg)}}",
    ".cco-ext-panel{position:relative;width:min(21.8rem,calc(100vw - 1rem));max-height:min(33rem,72vh);display:flex;flex-direction:column;overflow:hidden;border-radius:14px;border:1px solid #d8cfc0;background:rgba(250,246,239,0.985);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);box-shadow:0 18px 48px rgba(11,25,40,0.12);transform-origin:bottom right;transition:opacity 180ms ease,transform 180ms ease;}",
    ".cco-ext-panel::before{content:'';position:absolute;left:0;top:16px;bottom:16px;width:3px;background:linear-gradient(180deg,#1e4d8c,#b3c8f0,transparent);border-radius:999px;}",
    ".cco-ext-panel.cco-ext-hide{opacity:0;transform:translateY(0.6rem) scale(0.98);pointer-events:none;}",
    ".cco-ext-head{display:flex;align-items:center;justify-content:space-between;gap:0.8rem;padding:1rem 1rem 0.9rem 1.2rem;border-bottom:1px solid #d8cfc0;}",
    ".cco-ext-head-copy{display:flex;align-items:center;gap:0.62rem;min-width:0;}",
    ".cco-ext-head-mark{display:flex;align-items:center;justify-content:center;flex-shrink:0;}",
    ".cco-ext-head-mark .cco-ext-launcher-mark{width:1.08rem;height:1.08rem;filter:none;}",
    ".cco-ext-head-title-wrap{display:flex;flex-direction:column;gap:0.15rem;min-width:0;}",
    ".cco-ext-head-title{font-family:'Fraunces',Georgia,serif;font-size:1.12rem;line-height:1.02;font-weight:700;color:#0b1928;letter-spacing:-0.03em;}",
    ".cco-ext-head-meta{display:flex;align-items:center;gap:0.42rem;color:#485670;font-size:0.68rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;}",
    ".cco-ext-head-dot{width:0.46rem;height:0.46rem;border-radius:999px;background:" + profile.accent + ";box-shadow:0 0 0 0.22rem rgba(" + profile.accentRgb + ",0.12);}",
    ".cco-ext-close{width:2rem;height:2rem;border:none;border-radius:999px;background:rgba(11,25,40,0.04);color:#485670;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background 150ms ease,transform 150ms ease,color 150ms ease;}",
    ".cco-ext-close:hover{background:rgba(" + profile.accentRgb + ",0.08);color:" + profile.accent + ";transform:translateY(-1px);}",
    ".cco-ext-msgs{flex:1;overflow-y:auto;padding:0.95rem 1rem 0.9rem 1.2rem;display:flex;flex-direction:column;gap:0.7rem;min-height:10rem;}",
    ".cco-ext-empty{display:flex;flex-direction:column;gap:0.7rem;}",
    ".cco-ext-empty-card{background:#faf6ef;border:1px solid #d8cfc0;border-radius:14px;padding:0.95rem 1rem;color:#485670;font-size:0.8rem;line-height:1.58;}",
    ".cco-ext-actions{display:flex;flex-wrap:wrap;gap:0.5rem;}",
    ".cco-ext-action{display:inline-flex;align-items:center;justify-content:center;min-height:2.05rem;padding:0.48rem 0.98rem;border-radius:999px;text-decoration:none;font-size:0.78rem;font-weight:600;letter-spacing:0;transition:transform 150ms ease,filter 150ms ease,background 150ms ease,border-color 150ms ease,color 150ms ease;}",
    ".cco-ext-action:hover{transform:translateY(-1px);filter:brightness(1.02);}",
    ".cco-ext-action--primary{background:#1e4d8c;border:1px solid #1e4d8c;color:#fff;box-shadow:0 4px 16px rgba(30,77,140,0.16);}",
    ".cco-ext-action--primary:hover{background:#163d6e;border-color:#163d6e;}",
    ".cco-ext-action--secondary{background:transparent;border:1px solid #d8cfc0;color:#1e4d8c;}",
    ".cco-ext-action--secondary:hover{border-color:#1e4d8c;background:rgba(30,77,140,0.04);}",
    ".cco-ext-msg{max-width:86%;padding:0.78rem 0.9rem;border-radius:14px;font-size:0.8rem;line-height:1.58;word-break:break-word;white-space:pre-wrap;}",
    ".cco-ext-msg-user{align-self:flex-end;background:linear-gradient(180deg,#1e4d8c 0%,#163d6e 100%);color:#fff;border-bottom-right-radius:4px;}",
    ".cco-ext-msg-assistant{align-self:flex-start;background:#faf6ef;color:#485670;border:1px solid #d8cfc0;border-bottom-left-radius:4px;}",
    ".cco-ext-msg-assistant a{color:" + profile.accent + ";text-decoration:underline;text-decoration-thickness:1px;}",
    ".cco-ext-msg-assistant strong{color:#0b1928;font-weight:700;}",
    ".cco-ext-typing{display:flex;gap:0.25rem;padding:0.75rem 0.9rem;}",
    ".cco-ext-typing span{width:0.32rem;height:0.32rem;border-radius:999px;background:" + profile.accent + ";opacity:0.45;animation:ccoExtDot 1.2s ease infinite;}",
    ".cco-ext-typing span:nth-child(2){animation-delay:0.15s}.cco-ext-typing span:nth-child(3){animation-delay:0.3s}",
    "@keyframes ccoExtDot{0%,60%,100%{opacity:0.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-4px)}}",
    ".cco-ext-form-wrap{padding:0.9rem 1rem 1rem 1.2rem;border-top:1px solid #d8cfc0;background:rgba(250,246,239,0.96);}",
    ".cco-ext-form{display:flex;gap:0.55rem;align-items:flex-end;}",
    ".cco-ext-input{flex:1;min-height:2.95rem;padding:0.78rem 0.95rem;border:1px solid #d8cfc0;border-radius:14px;background:#fff;color:#0b1928;font:inherit;font-size:0.8rem;outline:none;transition:border-color 150ms ease,box-shadow 150ms ease,background 150ms ease;}",
    ".cco-ext-input:focus{border-color:" + profile.accent + ";box-shadow:0 0 0 4px rgba(" + profile.accentRgb + ",0.12);background:#fff;}",
    ".cco-ext-input::placeholder{color:#8a8578;}",
    ".cco-ext-send{width:2.95rem;height:2.95rem;border:none;border-radius:14px;background:#1e4d8c;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform 150ms ease,filter 150ms ease,opacity 150ms ease;box-shadow:0 4px 16px rgba(30,77,140,0.16);}",
    ".cco-ext-send:hover{transform:translateY(-1px);filter:brightness(1.03);}",
    ".cco-ext-send:disabled{opacity:0.35;cursor:not-allowed;transform:none;}",
    ".cco-ext-send svg{width:0.92rem;height:0.92rem;}",
    "@media(max-width:480px){.cco-ext-root{right:0.8rem;bottom:0.8rem}.cco-ext-panel{width:calc(100vw - 1rem);max-height:78vh}.cco-ext-head,.cco-ext-msgs,.cco-ext-form-wrap{padding-left:1rem}.cco-ext-panel::before{display:none}.cco-ext-launcher{min-height:3.15rem;padding:0.34rem 0.68rem}.cco-ext-launcher-copy{font-size:0.76rem}.cco-ext-launcher-markwrap{width:1.35rem;height:1.35rem}.cco-ext-launcher-mark{width:1.22rem;height:1.22rem}}",
  ].join("\n");
  document.head.appendChild(style);

  function el(tag, cls, html) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html !== undefined) node.innerHTML = html;
    return node;
  }

  function iconChat() {
    return '<svg class="cco-ext-launcher-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 15a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  var closeIcon = '<svg viewBox="0 0 24 24" fill="none" width="18" height="18" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var sendIcon = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M21.5 3.5 11 14m10.5-10.5-6.3 17-3.8-8.7-8.9-3.7 19-4.1Z" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var root = el("div", "cco-ext-root");
  var launcher = el("button", "cco-ext-launcher");
  launcher.type = "button";
  launcher.setAttribute("aria-label", launcherLabel || profile.name || "Open chat");
  launcher.innerHTML = [
    '<span class="cco-ext-launcher-markwrap">' + (
      brandMarkUrl
        ? '<img class="cco-ext-launcher-mark" src="' + escapeAttribute(brandMarkUrl) + '" alt="" />'
        : iconChat()
    ) + "</span>",
    '<span class="cco-ext-launcher-copy">' + escapeHtml(hintLabel) + "</span>",
  ].join("");
  launcher.addEventListener("click", toggle);

  var panel = el("div", "cco-ext-panel cco-ext-hide");
  var head = el("div", "cco-ext-head");
  var headCopy = el("div", "cco-ext-head-copy");
  headCopy.innerHTML = [
    '<div class="cco-ext-head-mark">' + (
      brandMarkUrl
        ? '<img class="cco-ext-launcher-mark" src="' + escapeAttribute(brandMarkUrl) + '" alt="" />'
        : iconChat()
    ) + "</div>",
    '<div class="cco-ext-head-title-wrap"><div class="cco-ext-head-title">' + escapeHtml(profile.name) + '</div><div class="cco-ext-head-meta"><span class="cco-ext-head-dot" aria-hidden="true"></span><span>' + escapeHtml(profile.meta) + "</span></div></div>",
  ].join("");

  var closeBtn = el("button", "cco-ext-close", closeIcon);
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Close chat");
  closeBtn.addEventListener("click", closePanel);
  head.appendChild(headCopy);
  head.appendChild(closeBtn);

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

  panel.appendChild(head);
  panel.appendChild(msgBox);
  panel.appendChild(formWrap);

  root.appendChild(panel);
  root.appendChild(launcher);
  document.body.appendChild(root);

  function openPanel() {
    if (isOpen) return;
    isOpen = true;
    panel.classList.remove("cco-ext-hide");
    launcher.classList.add("cco-ext-launcher--hidden");
    input.focus();
  }

  function closePanel() {
    if (!isOpen) return;
    isOpen = false;
    panel.classList.add("cco-ext-hide");
    launcher.classList.remove("cco-ext-launcher--hidden");
  }

  function toggle() {
    if (isOpen) {
      closePanel();
    } else {
      openPanel();
    }
  }

  function handleKeydown(event) {
    if (event.key === "Escape" && isOpen) {
      closePanel();
      launcher.focus();
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
      msgBox.appendChild(el("div", "cco-ext-msg cco-ext-msg-assistant cco-ext-typing", "<span></span><span></span><span></span>"));
    }
    msgBox.scrollTop = msgBox.scrollHeight;
  }

  function handleSend(event) {
    if (event) event.preventDefault();
    sendMessage(input.value.trim());
  }

  function buildEmptyState() {
    var emptyEl = el("div", "cco-ext-empty");
    var intro = el("div", "cco-ext-empty-card");
    intro.textContent = profile.empty;
    emptyEl.appendChild(intro);

    var actions = el("div", "cco-ext-actions");
    if (profile.ctaLabel && profile.ctaHref) {
      var primary = el("a", "cco-ext-action cco-ext-action--primary");
      primary.href = profile.ctaHref;
      primary.textContent = profile.ctaLabel;
      actions.appendChild(primary);
    }

    var tgHref = telegramHref();
    if (tgHref) {
      var secondary = el("a", "cco-ext-action cco-ext-action--secondary");
      secondary.href = tgHref;
      secondary.target = "_blank";
      secondary.rel = "noopener";
      secondary.textContent = telegramLabel;
      actions.appendChild(secondary);
    }

    if (actions.childNodes.length) {
      emptyEl.appendChild(actions);
    }
    return emptyEl;
  }

  function sendMessage(message) {
    if (!message || isLoading) return;

    openPanel();
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
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
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
