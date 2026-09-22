(function () {
  "use strict";

  const stage = document.getElementById("spin-stage");
  const placeholder = document.getElementById("spin-placeholder");
  const hint = document.getElementById("spin-hint");
  const frameCounter = document.getElementById("frame-counter");
  const sceneBar = document.getElementById("scene-bar");
  const sceneLabel = document.getElementById("active-scene-label");
  const modsList = document.getElementById("mods-list");
  const igLink = document.getElementById("ig-link");
  const igHandle = document.getElementById("ig-handle");
  const truckName = document.getElementById("truck-name");
  const truckTagline = document.getElementById("truck-tagline");

  const state = {
    mods: [],
    modsById: {},
    hotspots: { totalFrames: 0, mods: {} },
    scenes: [],
    frameEls: [], // preloaded <img> per frame index (1-based, index 0 unused)
    currentFrame: 1,
    activeScene: null, // scene object or null when in spin mode
    framesAvailable: false,
    dragging: false,
    dragStartX: 0,
    dragStartFrame: 1,
    pxPerFrame: 12,
  };

  async function loadJSON(path) {
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) throw new Error("Failed to load " + path);
    return res.json();
  }

  function padFrame(n, pad) {
    return String(n).padStart(pad, "0");
  }

  function framePath(n) {
    const pad = state.hotspots.frameNumberPadding || 3;
    return state.hotspots.framePathPattern.replace("{n}", padFrame(n, pad));
  }

  function imageExists(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  async function preloadFrames() {
    const total = state.hotspots.totalFrames || 0;
    if (!total) return false;
    const first = await imageExists(framePath(1));
    if (!first) return false;
    state.frameEls[1] = first;
    // Preload the rest without blocking too long; sequential is fine for a build page.
    for (let i = 2; i <= total; i++) {
      const img = await imageExists(framePath(i));
      if (img) state.frameEls[i] = img;
    }
    return true;
  }

  function renderStageImage() {
    stage.querySelectorAll("img.spin-frame").forEach((el) => el.remove());
    const img = state.frameEls[state.currentFrame];
    if (!img) return;
    const clone = img.cloneNode();
    clone.className = "spin-frame";
    clone.draggable = false;
    stage.insertBefore(clone, stage.firstChild);
  }

  function interpolate(a, b, t) {
    return a + (b - a) * t;
  }

  function hotspotPositionForFrame(keyframes, frame) {
    if (!keyframes || !keyframes.length) return null;
    const sorted = [...keyframes].sort((x, y) => x.frame - y.frame);
    if (frame <= sorted[0].frame) {
      return frame === sorted[0].frame ? sorted[0] : null;
    }
    if (frame >= sorted[sorted.length - 1].frame) {
      const last = sorted[sorted.length - 1];
      return frame === last.frame ? last : null;
    }
    for (let i = 0; i < sorted.length - 1; i++) {
      const cur = sorted[i];
      const next = sorted[i + 1];
      if (frame >= cur.frame && frame <= next.frame) {
        const t = (frame - cur.frame) / (next.frame - cur.frame);
        return {
          frame,
          x: interpolate(cur.x, next.x, t),
          y: interpolate(cur.y, next.y, t),
        };
      }
    }
    return null;
  }

  function clearDots() {
    stage.querySelectorAll(".hotspot-dot, .hotspot-label").forEach((el) => el.remove());
  }

  function addDot(x, y, opts) {
    const dot = document.createElement("div");
    dot.className = "hotspot-dot" + (opts.scene ? " scene-dot" : "");
    dot.style.left = x + "%";
    dot.style.top = y + "%";
    dot.title = opts.label || "";
    dot.addEventListener("click", (e) => {
      e.stopPropagation();
      opts.onClick && opts.onClick();
    });
    stage.appendChild(dot);
    return dot;
  }

  function renderHotspotsForCurrentFrame() {
    clearDots();
    if (state.activeScene) {
      state.activeScene.hotspots.forEach((h) => {
        const mod = state.modsById[h.modId];
        addDot(h.x, h.y, {
          label: mod ? mod.name : h.modId,
          onClick: () => highlightMod(h.modId),
        });
      });
      return;
    }
    Object.keys(state.hotspots.mods).forEach((modId) => {
      const pos = hotspotPositionForFrame(state.hotspots.mods[modId], state.currentFrame);
      if (!pos) return;
      const mod = state.modsById[modId];
      addDot(pos.x, pos.y, {
        label: mod ? mod.name : modId,
        onClick: () => highlightMod(modId),
      });
    });
    // scene entry points that are reachable from spin frames
    state.scenes.forEach((scene) => {
      if (scene.triggerFrame === state.currentFrame) {
        addDot(scene.triggerX, scene.triggerY, {
          scene: true,
          label: "View: " + scene.label,
          onClick: () => enterScene(scene.id),
        });
      }
    });
  }

  function setFrame(n) {
    const total = state.hotspots.totalFrames;
    let f = ((n - 1) % total + total) % total + 1;
    state.currentFrame = f;
    renderStageImage();
    renderHotspotsForCurrentFrame();
    frameCounter.textContent = "Frame " + f + " / " + total;
  }

  function enterScene(sceneId) {
    const scene = state.scenes.find((s) => s.id === sceneId);
    if (!scene) return;
    state.activeScene = scene;
    stage.querySelectorAll("img.spin-frame").forEach((el) => el.remove());
    const img = document.createElement("img");
    img.className = "spin-frame";
    img.src = scene.image;
    img.draggable = false;
    stage.insertBefore(img, stage.firstChild);
    renderHotspotsForCurrentFrame();
    frameCounter.textContent = scene.label;
    sceneLabel.textContent = scene.label;
    highlightSceneChip(sceneId);
  }

  function exitScene() {
    state.activeScene = null;
    sceneLabel.textContent = "";
    highlightSceneChip(null);
    renderStageImage();
    renderHotspotsForCurrentFrame();
    frameCounter.textContent = "Frame " + state.currentFrame + " / " + state.hotspots.totalFrames;
  }

  function highlightSceneChip(sceneId) {
    sceneBar.querySelectorAll(".scene-chip").forEach((chip) => {
      chip.classList.toggle("active", chip.dataset.sceneId === sceneId);
    });
  }

  function buildSceneBar() {
    sceneBar.innerHTML = "";
    if (!state.scenes.length) return;
    const spinChip = document.createElement("button");
    spinChip.className = "scene-chip active";
    spinChip.textContent = "360° View";
    spinChip.addEventListener("click", exitScene);
    sceneBar.appendChild(spinChip);

    state.scenes.forEach((scene) => {
      const chip = document.createElement("button");
      chip.className = "scene-chip";
      chip.dataset.sceneId = scene.id;
      chip.textContent = scene.label;
      chip.addEventListener("click", () => enterScene(scene.id));
      sceneBar.appendChild(chip);
    });
  }

  function highlightMod(modId) {
    document.querySelectorAll(".mod-card").forEach((card) => {
      card.classList.toggle("highlighted", card.dataset.modId === modId);
    });
    const card = document.querySelector('.mod-card[data-mod-id="' + modId + '"]');
    if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest" });

    // jump the viewer to a frame/scene where this mod is visible, if not already
    if (!state.activeScene) {
      const kf = state.hotspots.mods[modId];
      if (kf && kf.length && !hotspotPositionForFrame(kf, state.currentFrame)) {
        setFrame(kf[0].frame);
      }
    }
  }

  function renderModsList() {
    modsList.innerHTML = "";
    const byCategory = {};
    state.mods.forEach((mod) => {
      const cat = mod.category || "Other";
      (byCategory[cat] = byCategory[cat] || []).push(mod);
    });
    Object.keys(byCategory).forEach((cat) => {
      const heading = document.createElement("div");
      heading.className = "mod-category";
      heading.textContent = cat;
      modsList.appendChild(heading);

      byCategory[cat].forEach((mod) => {
        const card = document.createElement("div");
        card.className = "mod-card";
        card.dataset.modId = mod.id;
        card.innerHTML =
          "<h3>" + escapeHtml(mod.name) + "</h3>" +
          (mod.brand ? '<div class="mod-brand">' + escapeHtml(mod.brand) + "</div>" : "") +
          (mod.description ? "<p>" + escapeHtml(mod.description) + "</p>" : "") +
          (mod.url
            ? '<a class="mod-link" href="' + encodeURI(mod.url) + '" target="_blank" rel="noopener">View product &rarr;</a>'
            : "");
        card.addEventListener("click", () => highlightMod(mod.id));
        modsList.appendChild(card);
      });
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function setupDrag() {
    stage.addEventListener("pointerdown", (e) => {
      if (!state.framesAvailable || state.activeScene) return;
      state.dragging = true;
      state.dragStartX = e.clientX;
      state.dragStartFrame = state.currentFrame;
      stage.classList.add("dragging");
      stage.setPointerCapture(e.pointerId);
      hint.style.opacity = "0";
    });

    stage.addEventListener("pointermove", (e) => {
      if (!state.dragging) return;
      const dx = e.clientX - state.dragStartX;
      const framesMoved = Math.round(-dx / state.pxPerFrame);
      setFrame(state.dragStartFrame + framesMoved);
    });

    function endDrag(e) {
      if (!state.dragging) return;
      state.dragging = false;
      stage.classList.remove("dragging");
      try { stage.releasePointerCapture(e.pointerId); } catch (err) {}
    }
    stage.addEventListener("pointerup", endDrag);
    stage.addEventListener("pointercancel", endDrag);
    stage.addEventListener("pointerleave", () => {
      if (state.dragging) hint.style.opacity = "0";
    });
  }

  async function init() {
    try {
      const [mods, hotspots, scenes] = await Promise.all([
        loadJSON("data/mods.json"),
        loadJSON("data/hotspots.json"),
        loadJSON("data/scenes.json").catch(() => ({ scenes: [] })),
      ]);

      state.mods = mods.mods || [];
      state.modsById = Object.fromEntries(state.mods.map((m) => [m.id, m]));
      state.hotspots = hotspots;
      state.scenes = scenes.scenes || [];

      if (mods.instagram) {
        igLink.href = mods.instagram.url || "#";
        igHandle.textContent = mods.instagram.handle || "";
      }
      if (mods.truck) {
        truckName.textContent = mods.truck.name || "My Truck";
        truckTagline.textContent = mods.truck.tagline || "";
      }

      renderModsList();
      buildSceneBar();

      state.framesAvailable = await preloadFrames();
      if (state.framesAvailable) {
        placeholder.style.display = "none";
        setFrame(1);
        setupDrag();
      } else {
        frameCounter.textContent = "No frames found";
      }
    } catch (err) {
      console.error(err);
      placeholder.textContent = "Failed to load site data: " + err.message;
    }
  }

  init();
})();
