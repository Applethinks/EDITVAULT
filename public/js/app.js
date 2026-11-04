(() => {
  "use strict";

  const categories = [
    { id: "home", label: "Overview", icon: "⌂", href: "index.html" },
    { id: "music", label: "Music", icon: "♫", href: "pages/music.html" },
    { id: "sfx", label: "Sound effects", icon: "◖))", href: "pages/sfx.html" },
    { id: "images", label: "Images", icon: "▧", href: "pages/images.html" },
    { id: "gifs", label: "GIFs", icon: "GIF", href: "pages/gifs.html" },
    { id: "overlays", label: "Overlays", icon: "▦", href: "pages/overlays.html" },
    { id: "luts", label: "LUTs & color", icon: "◒", href: "pages/luts.html" },
    { id: "templates", label: "Templates", icon: "▤", href: "pages/templates.html" },
    { id: "fonts", label: "Fonts", icon: "Aa", href: "pages/fonts.html" },
    { id: "saved", label: "Saved assets", icon: "♡", href: "pages/saved.html" }
  ];

  const page = document.body.dataset.page || "home";
  const isSubpage = window.location.pathname.includes("/pages/");
  const prefix = isSubpage ? "../" : "";
  const config = window.EDITVAULT_CONFIG || { apiBase: "" };
  const savedKey = "editvault-saved-assets-v1";
  const memoryResults = new Map();

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));

  function setupNavigation() {
    const nav = document.querySelector("[data-nav]");
    if (!nav) return;
    nav.innerHTML = categories.map(item => {
      const href = prefix + item.href;
      const active = item.id === page ? " active" : "";
      return `<a class="nav-link${active}" href="${href}"><span class="nav-icon">${item.icon}</span><span>${item.label}</span></a>`;
    }).join("");
  }

  function setupTheme() {
    const root = document.documentElement;
    const button = document.querySelector("[data-theme-toggle]");
    const setTheme = theme => {
      root.dataset.theme = theme;
      try { localStorage.setItem("editvault-theme", theme); } catch (_) {}
      if (button) button.textContent = theme === "dark" ? "☀ Light mode" : "☾ Dark mode";
    };
    setTheme(root.dataset.theme || "dark");
    button?.addEventListener("click", () => setTheme(root.dataset.theme === "dark" ? "light" : "dark"));
  }

  function setupMobileMenu() {
    const toggle = document.querySelector("[data-menu-toggle]");
    const sidebar = document.querySelector("[data-sidebar]");
    if (!toggle || !sidebar) return;
    toggle.addEventListener("click", () => {
      const open = sidebar.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? "×" : "☰";
    });
    sidebar.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
      sidebar.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.textContent = "☰";
    }));
  }

  function getSaved() {
    try {
      const value = JSON.parse(localStorage.getItem(savedKey) || "[]");
      return Array.isArray(value) ? value : [];
    } catch (_) { return []; }
  }

  function setSaved(items) {
    try { localStorage.setItem(savedKey, JSON.stringify(items)); } catch (_) {}
  }

  function safeExternalUrl(value) {
    try {
      const url = new URL(value, window.location.href);
      return ["https:", "http:"].includes(url.protocol) ? url.href : "";
    } catch (_) { return ""; }
  }

  function resultCard(item, index, savedMode = false) {
    const preview = safeExternalUrl(item.preview);
    const source = safeExternalUrl(item.sourceUrl || item.url);
    const license = item.license || "License information not provided";
    const provider = item.provider || "Resource";
    const id = String(item.id || `${provider}-${index}`);
    memoryResults.set(id, item);
    const img = preview
      ? `<img src="${escapeHtml(preview)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
      : `<div class="no-preview">EDITVAULT</div>`;
    const openButton = source
      ? `<button class="button primary" type="button" data-open-source="${escapeHtml(id)}">Open source ↗</button>`
      : "";
    const savedButton = savedMode
      ? `<button class="button" type="button" data-remove-saved="${escapeHtml(id)}">Remove</button>`
      : `<button class="button" type="button" data-save-asset="${escapeHtml(id)}">♡ Save</button>`;
    return `<article class="asset-card ${savedMode ? "saved-card" : ""}">
      <div class="asset-preview">${img}</div>
      <div class="asset-info">
        <span class="provider-label">${escapeHtml(provider)}</span>
        <h3>${escapeHtml(item.title || "Untitled resource")}</h3>
        <p>By ${escapeHtml(item.creator || "Creator not listed")}</p>
        <p class="asset-license">${escapeHtml(license)}</p>
        <div class="asset-actions">${savedButton}${openButton}</div>
      </div>
    </article>`;
  }

  function attachCardActions(container) {
    container.querySelectorAll("[data-open-source]").forEach(button => {
      button.addEventListener("click", () => {
        const item = memoryResults.get(button.dataset.openSource);
        const url = safeExternalUrl(item?.sourceUrl || item?.url);
        if (!url) return;
        const status = item?.licenseStatus;
        if (status !== "permitted") {
          const proceed = window.confirm("License notice\n\nEDITVAULT could not verify that this asset is free to use. It may be copyrighted or have restrictions. Check the provider's terms before using it. Continue to the original source?");
          if (!proceed) return;
        }
        window.open(url, "_blank", "noopener,noreferrer");
      });
    });

    container.querySelectorAll("[data-save-asset]").forEach(button => {
      button.addEventListener("click", () => {
        const item = memoryResults.get(button.dataset.saveAsset);
        if (!item) return;
        const saved = getSaved();
        const identity = `${item.provider || ""}:${item.id || item.sourceUrl || item.title}`;
        if (!saved.some(entry => entry.identity === identity)) {
          saved.unshift({ ...item, identity, savedAt: Date.now() });
          setSaved(saved.slice(0, 200));
        }
        button.textContent = "✓ Saved";
        button.disabled = true;
      });
    });

    container.querySelectorAll("[data-remove-saved]").forEach(button => {
      button.addEventListener("click", () => {
        const id = button.dataset.removeSaved;
        const item = memoryResults.get(id);
        const identity = item?.identity || `${item?.provider || ""}:${item?.id || item?.sourceUrl || item?.title}`;
        setSaved(getSaved().filter(entry => entry.identity !== identity));
        renderSavedPage();
      });
    });
  }

  function showMessage(container, message, error = false) {
    container.innerHTML = `<div class="notice${error ? " error" : ""}">${escapeHtml(message)}</div>`;
  }

  async function runSearch(query, category, container) {
    const homeResults = document.querySelector("[data-home-results]");
    if (homeResults) homeResults.hidden = false;
    container.innerHTML = `<div class="notice">Searching supported sources…</div>`;
    const base = String(config.apiBase || "").replace(/\/$/, "");
    const endpoint = `${base}${prefix}api/search`;
    const url = `${endpoint}?q=${encodeURIComponent(query)}&category=${encodeURIComponent(category || "all")}`;
    try {
      const response = await fetch(url, { headers: { "Accept": "application/json" } });
      if (!response.ok) {
        let detail = "Search service is not available yet.";
        try { const body = await response.json(); detail = body.error || detail; } catch (_) {}
        throw new Error(detail);
      }
      const data = await response.json();
      const items = Array.isArray(data.results) ? data.results : [];
      if (!items.length) {
        showMessage(container, "No results came back. Try a broader search, or check whether provider API keys are configured on the backend.");
        return;
      }
      container.innerHTML = items.map((item, index) => resultCard(item, index)).join("");
      attachCardActions(container);
    } catch (error) {
      showMessage(container, "The website is loading, but live search needs the EDITVAULT Node backend. GitHub Pages only hosts the frontend. Once the backend is deployed and its API address is configured, searches will work here. (" + error.message + ")", true);
    }
  }

  function setupSearch() {
    document.querySelectorAll("[data-search-form]").forEach(form => {
      form.addEventListener("submit", event => {
        event.preventDefault();
        const input = form.querySelector('input[name="q"], input[type="search"]');
        const query = input?.value.trim() || "";
        if (query.length < 2) return;
        const container = document.querySelector("[data-results]");
        if (!container) return;
        runSearch(query, form.dataset.category || "all", container);
      });
    });
    document.querySelectorAll("[data-query]").forEach(button => {
      button.addEventListener("click", () => {
        const query = button.dataset.query || "";
        const input = document.querySelector('[data-search-form] input[type="search"]');
        if (input) {
          input.value = query;
          input.closest("form").requestSubmit();
        }
      });
    });
    document.querySelector("[data-clear-results]")?.addEventListener("click", () => {
      const section = document.querySelector("[data-home-results]");
      const container = document.querySelector("[data-results]");
      if (section) section.hidden = true;
      if (container) container.innerHTML = "";
    });
  }

  function renderSavedPage() {
    const container = document.querySelector("[data-saved-list]");
    if (!container) return;
    const saved = getSaved();
    if (!saved.length) {
      container.innerHTML = `<div class="empty-panel"><span class="empty-icon">♡</span><h3>No saved assets yet.</h3><p>Search a category and tap Save on a resource to keep it here.</p></div>`;
      return;
    }
    memoryResults.clear();
    container.innerHTML = saved.map((item, index) => resultCard(item, index, true)).join("");
    attachCardActions(container);
  }

  function setupSavedPage() {
    renderSavedPage();
    document.querySelector("[data-clear-saved]")?.addEventListener("click", () => {
      if (!getSaved().length) return;
      if (window.confirm("Clear all locally saved assets from this device?")) {
        setSaved([]);
        renderSavedPage();
      }
    });
  }

  setupNavigation();
  setupTheme();
  setupMobileMenu();
  setupSearch();
  setupSavedPage();
})();
 
