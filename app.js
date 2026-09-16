let snippets = JSON.parse(localStorage.getItem("ticket_snippets") || "[]");
let editingId = null;
let pendingDeleteId = null;

function saveSnippet() {
  const title = document.getElementById("titleInput").value.trim();
  const text = document.getElementById("bodyInput").value.trim();
  if (!title || !text) return;

  if (editingId) {
    snippets = snippets.map(s => s.id === editingId ? { ...s, title, text } : s);
    showToast("Plantilla actualizada");
    cancelEditing();
  } else {
    snippets.unshift({ id: Date.now(), title, text });
    document.getElementById("titleInput").value = "";
    document.getElementById("bodyInput").value = "";
    showToast("Plantilla creada");
  }

  localStorage.setItem("ticket_snippets", JSON.stringify(snippets));
  renderSnippets();
}

function startEditing(e, id) {
  e.stopPropagation();
  const snippet = snippets.find(s => s.id === id);
  if (!snippet) return;

  editingId = id;
  document.getElementById("titleInput").value = snippet.title;
  document.getElementById("bodyInput").value = snippet.text;
  
  const panel = document.getElementById("editorPanel");
  panel.classList.add("editing");
  document.getElementById("btnSave").innerText = "Guardar Cambios";

  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById("bodyInput").focus();
}

function cancelEditing() {
  editingId = null;
  document.getElementById("titleInput").value = "";
  document.getElementById("bodyInput").value = "";
  
  const panel = document.getElementById("editorPanel");
  panel.classList.remove("editing");
  document.getElementById("btnSave").innerText = "Guardar Nota";
}

function promptDelete(e, id) {
  e.stopPropagation();
  const item = snippets.find(s => s.id === id);
  if (!item) return;

  pendingDeleteId = id;
  document.getElementById("deleteModalDesc").innerText = `¿Seguro que deseas eliminar la plantilla "${item.title}"?`;
  document.getElementById("deleteModal").classList.add("active");
}

function closeDeleteModal() {
  pendingDeleteId = null;
  document.getElementById("deleteModal").classList.remove("active");
}

function confirmDelete() {
  if (!pendingDeleteId) return;

  if (editingId === pendingDeleteId) cancelEditing();
  snippets = snippets.filter(s => s.id !== pendingDeleteId);
  localStorage.setItem("ticket_snippets", JSON.stringify(snippets));

  closeDeleteModal();
  renderSnippets();
  showToast("Plantilla eliminada");
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast("¡Copiado al portapapeles!");
  });
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  document.getElementById("toastMsg").innerText = msg;
  toast.classList.add("active");
  setTimeout(() => toast.classList.remove("active"), 1500);
}

function renderSnippets() {
  const query = document.getElementById("searchInput").value.toLowerCase();
  const container = document.getElementById("snippetsContainer");
  const badge = document.getElementById("countBadge");
  container.innerHTML = "";

  const filtered = snippets.filter(s => 
    s.title.toLowerCase().includes(query) || s.text.toLowerCase().includes(query)
  );

  badge.innerText = `${filtered.length} ${filtered.length === 1 ? 'nota' : 'notas'}`;

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state">No hay plantillas que coincidan con la búsqueda.</div>`;
    return;
  }

  filtered.forEach(s => {
    const card = document.createElement("div");
    card.className = "card";
    card.onclick = () => copyToClipboard(s.text);

    card.innerHTML = `
      <div>
        <div class="card-head">
          <span class="card-title">${escapeHTML(s.title)}</span>
          <div class="card-btns">
            <button class="action-btn" title="Editar" onclick="startEditing(event, ${s.id})">✏️</button>
            <button class="action-btn btn-del" title="Eliminar" onclick="promptDelete(event, ${s.id})">&times;</button>
          </div>
        </div>
        <div class="card-text">${escapeHTML(s.text)}</div>
      </div>
      <div class="card-footer">
        <span class="click-badge">Copiar al clic</span>
      </div>
    `;
    container.appendChild(card);
  });
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    document.getElementById("searchInput").focus();
  }
  if (e.key === "Escape") {
    if (pendingDeleteId) closeDeleteModal();
    else if (editingId) cancelEditing();
  }
});

renderSnippets();
