(function () {
  "use strict";

  const stage = document.getElementById("spin-stage");
  const placeholder = document.getElementById("spin-placeholder");
  const frameCounter = document.getElementById("frame-counter");
  const modeSelect = document.getElementById("mode-select");
  const modSelect = document.getElementById("mod-select");
  const modSelectWrap = document.getElementById("mod-select-wrap");
  const sceneSelect = document.getElementById("scene-select");
  const sceneSelectWrap = document.getElementById("scene-select-wrap");
  const keyframeList = document.getElementById("keyframe-list");
  const editorHint = document.getElementById("editor-hint");

  const state = {
    mods: [],
    hotspots: { totalFrames: 0, framePathPattern: "", frameNumberPadding: 3, mods: {} },
    scenes: [],
    frameEls: [],
    currentFrame: 1,
    framesAvailable: false,
    dragging: false,
    dragMoved: false,
    dragStartX: 0,
    dragStartFrame: 1,
    pxPerFrame: 12,
    mode: "spin",
  };

  async function loadJSON(path, fallback) {
    try {
      const res = await fetch(path, { cache: "no-cache" });
      if (!res.ok) throw new Error("missing");
      return await res.json();
    } catch (e) {
      return fallback;
    }
  }

  function padFrame(n, pad) { return String(n).padStart(pad, "0"); }
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
    for (let i = 2; i <= total; i++) {
      const img = await imageExists(framePath(i));
      if (img) state.frameEls[i] = img;
    }
    return true;
  }

  function currentModId() { return modSelect.value; }
  function currentSceneId() { return sceneSelect.value; }
  function currentScene() { return state.scenes.find((s) => s.id === currentSceneId()); }

  function clearStageContent() {
    stage.querySelectorAll("img.spin-frame, .hotspot-dot").forEach((el) => el.remove());
  }

  function renderStage() {
    clearStageContent();
    if (state.mode === "scene-hotspot") {
      const scene = currentScene();
      if (!scene) return;
      const img = document.createElement("img");
      img.className = "spin-frame";
      img.src = scene.image;
      img.draggable = false;
      stage.insertBefore(img, stage.firstChild);
      frameCounter.textContent = scene.label;
      (scene.hotspots || []).forEach((h) => {
        addDot(h.x, h.y, modLabel(h.modId));
      });
      return;
    }

    const img = state.frameEls[state.currentFrame];
    if (img) {
      const clone = img.cloneNode();
      clone.className = "spin-frame";
      clone.draggable = false;
      stage.insertBefore(clone, stage.firstChild);
    }
    frameCounter.textContent = "Frame " + state.currentFrame + " / " + state.hotspots.totalFrames;

    if (state.mode === "spin") {
      const kf = (state.hotspots.mods[currentModId()] || []).find((k) => k.frame === state.currentFrame);
      if (kf) addDot(kf.x, kf.y, "this mod");
      // faint dots for other mods on this frame, for context
      Object.keys(state.hotspots.mods).forEach((id) => {
        if (id === currentModId()) return;
        const other = (state.hotspots.mods[id] || []).find((k) => k.frame === state.currentFrame);
        if (other) addDot(other.x, other.y, modLabel(id), true);
      });
    } else if (state.mode === "scene-trigger") {
      state.scenes.forEach((scene) => {
        if (scene.triggerFrame === state.currentFrame) {
          addDot(scene.triggerX, scene.triggerY, "→ " + scene.label);
        }
      });
    }
  }

  function modLabel(id) {
    const m = state.mods.find((m) => m.id === id);
    return m ? m.name : id;
  }

  function addDot(x, y, label, faint) {
    const dot = document.createElement("div");
    dot.className = "hotspot-dot";
    if (faint) dot.style.opacity = "0.35";
    dot.style.left = x + "%";
    dot.style.top = y + "%";
    dot.title = label || "";
    stage.appendChild(dot);
    return dot;
  }

  function renderKeyframeList() {
    keyframeList.innerHTML = "";
    if (state.mode === "spin") {
      const kfs = (state.hotspots.mods[currentModId()] || []).slice().sort((a, b) => a.frame - b.frame);
      if (!kfs.length) {
        keyframeList.innerHTML = '<p class="editor-note">No points yet for this mod. Click the truck on a few frames where it\'s visible.</p>';
        return;
      }
      kfs.forEach((kf) => {
        const row = document.createElement("div");
        row.className = "keyframe-row";
        row.innerHTML = "<span>Frame " + kf.frame + " &middot; " + kf.x.toFixed(1) + "%, " + kf.y.toFixed(1) + "%</span>";
        const btns = document.createElement("span");
        const jumpBtn = document.createElement("button");
        jumpBtn.textContent = "Go";
        jumpBtn.addEventListener("click", () => setFrame(kf.frame));
        const delBtn = document.createElement("button");
        delBtn.textContent = "Delete";
        delBtn.style.marginLeft = "6px";
        delBtn.addEventListener("click", () => {
          state.hotspots.mods[currentModId()] = state.hotspots.mods[currentModId()].filter((k) => k.frame !== kf.frame);
          renderStage();
          renderKeyframeList();
        });
        btns.appendChild(jumpBtn);
        btns.appendChild(delBtn);
        row.appendChild(btns);
        keyframeList.appendChild(row);
      });
    } else if (state.mode === "scene-trigger") {
      keyframeList.innerHTML = '<p class="editor-note">Click on the truck on the frame where this scene should become clickable. Pick the scene from the dropdown first (add scenes in data/scenes.json).</p>';
    } else {
      const scene = currentScene();
      const hs = scene ? scene.hotspots || [] : [];
      if (!hs.length) {
        keyframeList.innerHTML = '<p class="editor-note">No hotspots yet in this scene.</p>';
      }
      hs.forEach((h, idx) => {
        const row = document.createElement("div");
        row.className = "keyframe-row";
        row.innerHTML = "<span>" + modLabel(h.modId) + " &middot; " + h.x.toFixed(1) + "%, " + h.y.toFixed(1) + "%</span>";
        const delBtn = document.createElement("button");
        delBtn.textContent = "Delete";
        delBtn.addEventListener("click", () => {
          scene.hotspots.splice(idx, 1);
          renderStage();
          renderKeyframeList();
        });
        row.appendChild(delBtn);
        keyframeList.appendChild(row);
      });
    }
  }

  function setFrame(n) {
    const total = state.hotspots.totalFrames;
    state.currentFrame = ((n - 1) % total + total) % total + 1;
    renderStage();
    renderKeyframeList();
  }

  function setupDrag() {
    stage.addEventListener("pointerdown", (e) => {
      if (state.mode === "scene-hotspot") return;
      if (!state.framesAvailable) return;
      state.dragging = true;
      state.dragMoved = false;
      state.dragStartX = e.clientX;
      state.dragStartFrame = state.currentFrame;
      stage.setPointerCapture(e.pointerId);
    });

    stage.addEventListener("pointermove", (e) => {
      if (!state.dragging) return;
      const dx = e.clientX - state.dragStartX;
      if (Math.abs(dx) > 4) state.dragMoved = true;
      const framesMoved = Math.round(-dx / state.pxPerFrame);
      if (state.dragMoved) setFrame(state.dragStartFrame + framesMoved);
    });

    stage.addEventListener("pointerup", (e) => {
      const wasDrag = state.dragging && state.dragMoved;
      state.dragging = false;
      try { stage.releasePointerCapture(e.pointerId); } catch (err) {}
      if (!wasDrag) handleClick(e);
    });
  }

  function handleClick(e) {
    const rect = stage.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const xc = Math.max(0, Math.min(100, x));
    const yc = Math.max(0, Math.min(100, y));

    if (state.mode === "spin") {
      const modId = currentModId();
      if (!modId) return;
      const list = (state.hotspots.mods[modId] = state.hotspots.mods[modId] || []);
      const existing = list.find((k) => k.frame === state.currentFrame);
      if (existing) { existing.x = xc; existing.y = yc; }
      else list.push({ frame: state.currentFrame, x: xc, y: yc });
    } else if (state.mode === "scene-trigger") {
      const scene = currentScene();
      if (!scene) return;
      scene.triggerFrame = state.currentFrame;
      scene.triggerX = xc;
      scene.triggerY = yc;
    } else if (state.mode === "scene-hotspot") {
      const scene = currentScene();
      const modId = currentModId();
      if (!scene || !modId) return;
      scene.hotspots = scene.hotspots || [];
      const existing = scene.hotspots.find((h) => h.modId === modId);
      if (existing) { existing.x = xc; existing.y = yc; }
      else scene.hotspots.push({ modId, x: xc, y: yc });
    }
    renderStage();
    renderKeyframeList();
  }

  function download(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function populateModSelect() {
    modSelect.innerHTML = "";
    state.mods.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.name;
      modSelect.appendChild(opt);
    });
  }

  function populateSceneSelect() {
    sceneSelect.innerHTML = "";
    state.scenes.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.label;
      sceneSelect.appendChild(opt);
    });
  }

  function applyModeUI() {
    state.mode = modeSelect.value;
    modSelectWrap.style.display = state.mode === "scene-trigger" ? "none" : "flex";
    sceneSelectWrap.style.display = state.mode === "spin" ? "none" : "flex";
    editorHint.textContent =
      state.mode === "spin"
        ? "Click on the truck to place/move a point for the selected mod at this frame."
        : state.mode === "scene-trigger"
        ? "Click where the '→ view' dot should sit on this frame for the selected scene."
        : "Click on the scene image to place a dot for the selected mod.";
    renderStage();
    renderKeyframeList();
  }

  async function init() {
    const mods = await loadJSON("data/mods.json", { mods: [] });
    const hotspots = await loadJSON("data/hotspots.json", {
      totalFrames: 12,
      framePathPattern: "frames/frame_{n}.jpg",
      frameNumberPadding: 3,
      mods: {},
    });
    const scenes = await loadJSON("data/scenes.json", { scenes: [] });

    state.mods = mods.mods || [];
    state.hotspots = hotspots;
    state.scenes = scenes.scenes || [];

    populateModSelect();
    populateSceneSelect();
    applyModeUI();

    state.framesAvailable = await preloadFrames();
    if (state.framesAvailable) {
      placeholder.style.display = "none";
      setFrame(1);
    } else {
      frameCounter.textContent = "No frames found";
    }
    setupDrag();

    modeSelect.addEventListener("change", applyModeUI);
    modSelect.addEventListener("change", () => { renderStage(); renderKeyframeList(); });
    sceneSelect.addEventListener("change", () => { renderStage(); renderKeyframeList(); });

    document.getElementById("download-hotspots").addEventListener("click", () => {
      download("hotspots.json", state.hotspots);
    });
    document.getElementById("download-scenes").addEventListener("click", () => {
      download("scenes.json", { scenes: state.scenes });
    });
  }

  init();
})();
