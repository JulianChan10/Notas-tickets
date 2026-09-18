let snippets = JSON.parse(localStorage.getItem("ticket_snippets") || "[]");
let trash = JSON.parse(localStorage.getItem("ticket_trash") || "[]");
let copyHistory = JSON.parse(localStorage.getItem("ticket_copy_history") || "[]");

let editingId = null;
let pendingDeleteId = null;
let activeCategory = "Todas";
let currentSort = "recent";
let isCompact = localStorage.getItem("snippets_compact") === "true";
let currentFilteredSnippets = [];
let focusedCardIndex = -1;
let activeParamSnippet = null;

function saveSnippet() {
  const title = document.getElementById("titleInput").value.trim();
  const text = document.getElementById("bodyInput").value.trim();
  const category = document.getElementById("categoryInput").value.trim() || "General";

  if (!title || !text) return;

  if (editingId) {
    snippets = snippets.map(s => s.id === editingId ? { ...s, title, text, category } : s);
    showToast("Plantilla actualizada");
    cancelEditing();
  } else {
    snippets.unshift({ 
      id: Date.now(), 
      title, 
      text, 
      category, 
      pinned: false, 
      uses: 0 
    });
    document.getElementById("titleInput").value = "";
    document.getElementById("bodyInput").value = "";
    document.getElementById("categoryInput").value = "";
    showToast("Plantilla creada");
  }

  saveToStorage();
  renderCategories();
  renderSnippets();
}

function startEditing(e, id) {
  e.stopPropagation();
  const snippet = snippets.find(s => s.id === id);
  if (!snippet) return;

  editingId = id;
  document.getElementById("titleInput").value = snippet.title;
  document.getElementById("bodyInput").value = snippet.text;
  document.getElementById("categoryInput").value = snippet.category || "General";
  
  const panel = document.getElementById("editorPanel");
  panel.classList.remove("hidden");
  panel.classList.add("editing");
  document.getElementById("btnSave").innerText = "Guardar Cambios";

  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById("bodyInput").focus();
}

function cancelEditing() {
  editingId = null;
  document.getElementById("titleInput").value = "";
  document.getElementById("bodyInput").value = "";
  document.getElementById("categoryInput").value = "";
  
  const panel = document.getElementById("editorPanel");
  panel.classList.remove("editing");
  panel.classList.add("hidden");
  document.getElementById("btnSave").innerText = "Guardar Nota";
}

function togglePin(e, id) {
  e.stopPropagation();
  snippets = snippets.map(s => s.id === id ? { ...s, pinned: !s.pinned } : s);
  saveToStorage();
  renderSnippets();
}

function duplicateSnippet(e, id) {
  e.stopPropagation();
  const item = snippets.find(s => s.id === id);
  if (!item) return;

  const clone = {
    ...item,
    id: Date.now(),
    title: `${item.title} (Copia)`,
    uses: 0,
    pinned: false
  };

  snippets.unshift(clone);
  saveToStorage();
  renderCategories();
  renderSnippets();
  showToast("Plantilla duplicada");
}

function promptDelete(e, id) {
  e.stopPropagation();
  const item = snippets.find(s => s.id === id);
  if (!item) return;

  pendingDeleteId = id;
  document.getElementById("deleteModalDesc").innerText = `¿Mover "${item.title}" a la papelera?`;
  document.getElementById("deleteModal").classList.add("active");
}

function closeDeleteModal() {
  pendingDeleteId = null;
  document.getElementById("deleteModal").classList.remove("active");
}

function confirmDelete() {
  if (!pendingDeleteId) return;

  if (editingId === pendingDeleteId) cancelEditing();
  const deletedItem = snippets.find(s => s.id === pendingDeleteId);
  if (deletedItem) {
    trash.unshift({ ...deletedItem, deletedAt: Date.now() });
    localStorage.setItem("ticket_trash", JSON.stringify(trash));
  }

  snippets = snippets.filter(s => s.id !== pendingDeleteId);
  saveToStorage();

  closeDeleteModal();
  renderCategories();
  renderSnippets();
  updateTrashBadge();
  showToast("Movido a la papelera");
}

function extractVariables(text) {
  const matches = text.match(/\{([a-zA-Z0-9_\-\sáéíóúÁÉÍÓÚñÑ]+)\}/g);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.slice(1, -1).trim()))];
}

function handleSnippetClick(s, cardElement) {
  const vars = extractVariables(s.text);

  if (vars.length === 0) {
    copyToClipboard(s.id, s.text, cardElement);
    return;
  }

  activeParamSnippet = { ...s, cardElement, variables: vars };
  document.getElementById("paramModalTitle").innerText = `Completar: ${s.title}`;
  const container = document.getElementById("paramModalFields");
  container.innerHTML = "";

  vars.forEach((v, index) => {
    const row = document.createElement("div");
    row.className = "field-row";
    row.innerHTML = `
      <label>${escapeHTML(v)}</label>
      <input type="text" id="param_input_${index}" data-key="${v}" placeholder="Valor para ${v}..." autocomplete="off" />
    `;
    container.appendChild(row);
  });

  document.getElementById("paramModal").classList.add("active");
  setTimeout(() => {
    const first = document.getElementById("param_input_0");
    if (first) first.focus();
  }, 40);
}

function closeParamModal() {
  activeParamSnippet = null;
  document.getElementById("paramModal").classList.remove("active");
}

function submitParamModal() {
  if (!activeParamSnippet) return;
  let finalText = activeParamSnippet.text;
  const inputs = document.querySelectorAll("#paramModalFields input");

  inputs.forEach(input => {
    const key = input.getAttribute("data-key");
    const val = input.value.trim() || `{${key}}`;
    finalText = finalText.split(`{${key}}`).join(val);
  });

  const { id, cardElement } = activeParamSnippet;
  closeParamModal();
  copyToClipboard(id, finalText, cardElement);
}

function copyToClipboard(id, text, cardElement) {
  navigator.clipboard.writeText(text).then(() => {
    if (id) {
      snippets = snippets.map(s => s.id === id ? { ...s, uses: (s.uses || 0) + 1 } : s);
      saveToStorage();
    }

    copyHistory = [text, ...copyHistory.filter(t => t !== text)].slice(0, 5);
    localStorage.setItem("ticket_copy_history", JSON.stringify(copyHistory));

    if (cardElement) {
      cardElement.classList.add("copied-pulse");
      setTimeout(() => cardElement.classList.remove("copied-pulse"), 500);
    }

    showToast("¡Copiado al portapapeles!");
    renderSnippets();
  });
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  document.getElementById("toastMsg").innerText = msg;
  toast.classList.add("active");
  setTimeout(() => toast.classList.remove("active"), 1500);
}

function toggleEditor() {
  const panel = document.getElementById("editorPanel");
  if (panel.classList.contains("hidden")) {
    panel.classList.remove("hidden");
    document.getElementById("titleInput").focus();
  } else {
    if (editingId) cancelEditing();
    else panel.classList.add("hidden");
  }
}

function toggleViewMode() {
  isCompact = !isCompact;
  localStorage.setItem("snippets_compact", isCompact);
  applyViewMode();
}

function applyViewMode() {
  const container = document.getElementById("snippetsContainer");
  const btn = document.getElementById("viewModeBtn");
  if (isCompact) {
    container.classList.add("compact-view");
    btn.innerText = "🗂️";
    btn.title = "Cambiar a vista expandida";
  } else {
    container.classList.remove("compact-view");
    btn.innerText = "📑";
    btn.title = "Cambiar a vista compacta";
  }
}

function changeSort(val) {
  currentSort = val;
  renderSnippets();
}

function setCategoryFilter(cat) {
  activeCategory = cat;
  renderCategories();
  renderSnippets();
}

function renderCategories() {
  const container = document.getElementById("categoryFilterContainer");
  const datalist = document.getElementById("categoriesDatalist");
  
  const rawCats = [...new Set(snippets.map(s => s.category || "General"))];
  const allCats = ["Todas", ...rawCats];
  if (!allCats.includes(activeCategory)) activeCategory = "Todas";

  // Chips superiores
  container.innerHTML = allCats.map(cat => `
    <button class="cat-chip ${cat === activeCategory ? 'active' : ''}" onclick="setCategoryFilter('${cat}')">
      ${escapeHTML(cat)}
    </button>
  `).join("");

  // Opciones del autocompletado en el formulario
  if (datalist) {
    datalist.innerHTML = rawCats.map(cat => `<option value="${escapeHTML(cat)}">`).join("");
  }
}

function handleSearchInput() {
  focusedCardIndex = -1;
  renderSnippets();
}

function renderSnippets() {
  const query = document.getElementById("searchInput").value.toLowerCase();
  const container = document.getElementById("snippetsContainer");
  const badge = document.getElementById("countBadge");
  container.innerHTML = "";

  currentFilteredSnippets = snippets.filter(s => {
    const matchesCat = activeCategory === "Todas" || (s.category || "General") === activeCategory;
    const matchesQuery = s.title.toLowerCase().includes(query) || s.text.toLowerCase().includes(query);
    return matchesCat && matchesQuery;
  });

  currentFilteredSnippets.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (currentSort === "uses") return (b.uses || 0) - (a.uses || 0);
    if (currentSort === "alpha") return a.title.localeCompare(b.title);
    return b.id - a.id;
  });

  badge.innerText = `${currentFilteredSnippets.length} ${currentFilteredSnippets.length === 1 ? 'nota' : 'notas'}`;

  if (currentFilteredSnippets.length === 0) {
    container.innerHTML = `<div class="empty-state">No hay notas que coincidan con la búsqueda.</div>`;
    return;
  }

  currentFilteredSnippets.forEach((s, index) => {
    const card = document.createElement("div");
    const vars = extractVariables(s.text);
    const hasParams = vars.length > 0;
    
    card.className = `card ${s.pinned ? 'pinned' : ''} ${index === focusedCardIndex ? 'keyboard-focused' : ''}`;
    card.onclick = () => handleSnippetClick(s, card);

    const shortcutHtml = index < 9 ? `<span class="shortcut-badge">Alt+${index + 1}</span>` : "";
    const paramBadge = hasParams ? `<span class="badge-param">${vars.length} variable(s)</span>` : "";

    card.innerHTML = `
      <div>
        <div class="card-head">
          <span class="card-title">${escapeHTML(s.title)}</span>
          <div class="card-btns">
            <button class="action-btn ${s.pinned ? 'active-pin' : ''}" title="${s.pinned ? 'Desfijar' : 'Fijar arriba'}" onclick="togglePin(event, ${s.id})">📌</button>
            <button class="action-btn" title="Duplicar" onclick="duplicateSnippet(event, ${s.id})">📑</button>
            <button class="action-btn" title="Editar" onclick="startEditing(event, ${s.id})">✏️</button>
            <button class="action-btn btn-del" title="Mover a papelera" onclick="promptDelete(event, ${s.id})">&times;</button>
          </div>
        </div>
        <div class="card-category-tag">${escapeHTML(s.category || "General")}</div>
        <div class="card-text">${escapeHTML(s.text)}</div>
      </div>
      <div class="card-footer">
        <div style="display:flex; align-items:center; gap:6px;">
          <span class="uses-tag">Usado: ${s.uses || 0}</span>
          ${paramBadge}
        </div>
        ${shortcutHtml}
      </div>
    `;
    container.appendChild(card);
  });
}

function toggleHistoryModal() {
  const modal = document.getElementById("historyModal");
  if (modal.classList.contains("active")) {
    modal.classList.remove("active");
  } else {
    const list = document.getElementById("historyListContainer");
    list.innerHTML = copyHistory.length ? "" : `<div class="empty-state">No hay textos en el historial aún.</div>`;
    copyHistory.forEach(text => {
      const item = document.createElement("div");
      item.className = "history-item";
      item.onclick = () => {
        copyToClipboard(null, text);
        modal.classList.remove("active");
      };
      item.innerHTML = `<span class="history-item-text">${escapeHTML(text)}</span><span>📋</span>`;
      list.appendChild(item);
    });
    modal.classList.add("active");
  }
}

function updateTrashBadge() {
  document.getElementById("trashCount").innerText = trash.length;
}

function toggleTrashModal() {
  const modal = document.getElementById("trashModal");
  if (modal.classList.contains("active")) {
    modal.classList.remove("active");
  } else {
    renderTrash();
    modal.classList.add("active");
  }
}

function renderTrash() {
  const list = document.getElementById("trashListContainer");
  list.innerHTML = trash.length ? "" : `<div class="empty-state">La papelera está vacía.</div>`;
  trash.forEach(item => {
    const el = document.createElement("div");
    el.className = "trash-item";
    el.innerHTML = `
      <span class="trash-title">${escapeHTML(item.title)}</span>
      <button class="btn-restore" onclick="restoreFromTrash(${item.id})">Restaurar</button>
    `;
    list.appendChild(el);
  });
}

function restoreFromTrash(id) {
  const item = trash.find(t => t.id === id);
  if (!item) return;

  trash = trash.filter(t => t.id !== id);
  delete item.deletedAt;
  snippets.unshift(item);

  localStorage.setItem("ticket_trash", JSON.stringify(trash));
  saveToStorage();
  updateTrashBadge();
  renderTrash();
  renderCategories();
  renderSnippets();
  showToast("Plantilla restaurada");
}

function emptyTrash() {
  if (!trash.length) return;
  trash = [];
  localStorage.setItem("ticket_trash", JSON.stringify(trash));
  updateTrashBadge();
  renderTrash();
  showToast("Papelera vaciada");
}

function openMiniWindow() {
  window.open(
    window.location.href,
    "TicketSnippetsMini",
    "width=430,height=680,menubar=no,toolbar=no,location=no,status=no"
  );
}

function exportSnippets() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(snippets, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `ticket_snippets_${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function importSnippets(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (Array.isArray(imported)) {
        snippets = imported;
        saveToStorage();
        renderCategories();
        renderSnippets();
        showToast("Notas importadas correctamente");
      }
    } catch (err) {
      alert("Error al leer el archivo JSON.");
    }
  };
  reader.readAsText(file);
}

function saveToStorage() {
  localStorage.setItem("ticket_snippets", JSON.stringify(snippets));
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

window.addEventListener("keydown", (e) => {
  const searchInput = document.getElementById("searchInput");
  const isSearchFocused = document.activeElement === searchInput;

  if (e.key === "Enter" && activeParamSnippet) {
    submitParamModal();
    return;
  }

  if (e.key === "ArrowDown" && (isSearchFocused || focusedCardIndex >= 0)) {
    e.preventDefault();
    if (focusedCardIndex < currentFilteredSnippets.length - 1) {
      focusedCardIndex++;
      renderSnippets();
    }
    return;
  }

  if (e.key === "ArrowUp" && focusedCardIndex >= 0) {
    e.preventDefault();
    focusedCardIndex--;
    if (focusedCardIndex < 0) {
      searchInput.focus();
    }
    renderSnippets();
    return;
  }

  if (e.key === "Enter" && focusedCardIndex >= 0 && !activeParamSnippet) {
    e.preventDefault();
    const target = currentFilteredSnippets[focusedCardIndex];
    if (target) {
      const targetCard = document.querySelectorAll(".grid .card")[focusedCardIndex];
      handleSnippetClick(target, targetCard);
    }
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    searchInput.focus();
  }

  if ((e.ctrlKey || e.altKey) && e.key.toLowerCase() === "n") {
    e.preventDefault();
    const panel = document.getElementById("editorPanel");
    panel.classList.remove("hidden");
    document.getElementById("titleInput").focus();
  }

  if (e.altKey && !isNaN(e.key) && parseInt(e.key) >= 1 && parseInt(e.key) <= 9) {
    const targetIndex = parseInt(e.key) - 1;
    if (currentFilteredSnippets[targetIndex]) {
      e.preventDefault();
      const targetCard = document.querySelectorAll(".grid .card")[targetIndex];
      handleSnippetClick(currentFilteredSnippets[targetIndex], targetCard);
    }
  }

  if (e.key === "Escape") {
    if (activeParamSnippet) {
      closeParamModal();
      return;
    }
    if (document.getElementById("historyModal").classList.contains("active")) {
      toggleHistoryModal();
      return;
    }
    if (document.getElementById("trashModal").classList.contains("active")) {
      toggleTrashModal();
      return;
    }
    if (pendingDeleteId) {
      closeDeleteModal();
      return;
    }
    if (editingId) {
      cancelEditing();
      return;
    }
    const panel = document.getElementById("editorPanel");
    if (!panel.classList.contains("hidden")) {
      const title = document.getElementById("titleInput").value.trim();
      const text = document.getElementById("bodyInput").value.trim();
      if (!title && !text) {
        panel.classList.add("hidden");
      }
    }
  }
});

applyViewMode();
renderCategories();
renderSnippets();
updateTrashBadge();
