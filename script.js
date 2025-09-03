// ======== Estado ========
const APROBADOS_KEY = "malla_aprobados";
let cursosAprobados = new Set(JSON.parse(localStorage.getItem(APROBADOS_KEY) || "[]"));
let datos = null;
let byId = {};
let mostrarDesbloqueados = true;

// ======== Util ========
const guardaProgreso = () => {
  localStorage.setItem(APROBADOS_KEY, JSON.stringify([...cursosAprobados]));
};
const tieneTodos = (prereqs) => (prereqs || []).every((id) => cursosAprobados.has(id));
const idToNombre = (id) => (byId[id]?.nombre || `ID ${id}`);

function renderPrereqPanel(panelEl, curso){
  const prereqs = curso.prerrequisitos || [];
  const nombres = prereqs.map(idToNombre);
  const faltan = prereqs.filter(id => !cursosAprobados.has(id)).map(idToNombre);
  panelEl.innerHTML = `
    <div><strong>Prerrequisitos</strong></div>
    ${prereqs.length
      ? `<ul>${nombres.map(n=>`<li>${n}</li>`).join("")}</ul>`
      : `<div>Sin prerrequisitos</div>`
    }
    ${prereqs.length
      ? `<div style="margin-top:6px">Estado: <span class="${faltan.length? 'miss':'ok'}">
          ${faltan.length ? `Faltan: ${faltan.join(", ")}` : "Todos cumplidos"}
        </span></div>`
      : ""
    }
  `;
}

// ======== Render ========
async function cargarMalla() {
  const res = await fetch("data.json");
  datos = await res.json();

  // mapa id -> curso
  byId = {};
  datos.semestres.forEach(sem => sem.cursos.forEach(c => byId[c.id] = c));

  const contenedor = document.getElementById("malla");
  contenedor.innerHTML = "";

  datos.semestres.forEach((sem) => {
    const col = document.createElement("section");
    col.className = "semestre";
    col.innerHTML = `<h3>Semestre ${sem.numero}</h3>`;

    sem.cursos.forEach((c) => {
      const card = document.createElement("div");
      card.className = "curso";
      card.dataset.id = c.id;

      const aprobado = cursosAprobados.has(c.id);
      const desbloq = tieneTodos(c.prerrequisitos || []);

      if (aprobado) card.classList.add("aprobado");
      if (desbloq && mostrarDesbloqueados) card.classList.add("desbloqueado");
      if (!desbloq && !aprobado) card.classList.add("bloqueado");

      // estructura
      card.innerHTML = `
        <span class="codigo">${c.codigo || "COD"}</span>
        <span class="nombre">${c.nombre}</span>
        <div class="badges">
          ${desbloq ? `<span class="badge ok">OK</span>` : `<span class="badge req">Req</span>`}
        </div>
        <div class="sct">${c.sct ?? c.creditos ?? ""} CT</div>
        <button class="btn-prereq" type="button">Ver pre</button>
        <div class="prereq-panel"></div>
      `;

      // click en tarjeta: toggle aprobado
      // click en tarjeta: toggle aprobado (respetando prerrequisitos)
card.addEventListener("click", () => {
  const yaAprobado = cursosAprobados.has(c.id);
  const desbloqNow = tieneTodos(c.prerrequisitos || []);

  // Si NO cumple prerrequisitos y aún no está aprobado → bloquear
  if (!desbloqNow && !yaAprobado) {
    // feedback visual + abrir panel de pre
    const panel = card.querySelector(".prereq-panel");
    const btn = card.querySelector(".btn-prereq");
    renderPrereqPanel(panel, c);
    panel.classList.add("open");
    if (btn) btn.textContent = "Ocultar pre";

    // pequeña animación de shake
    card.classList.remove("denegado");
    void card.offsetWidth; // reflow para reiniciar animación
    card.classList.add("denegado");
    return; // NO marcar como aprobado
  }

  // Si cumple prerrequisitos (o ya estaba aprobado), toggle normal
  if (yaAprobado) cursosAprobados.delete(c.id);
  else cursosAprobados.add(c.id);

  guardaProgreso();
  cargarMalla(); // re-render para recalcular estados
});


      // botón "Ver pre": abrir/cerrar panel (sin marcar aprobado)
      const btn = card.querySelector(".btn-prereq");
      const panel = card.querySelector(".prereq-panel");
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation(); // evita togglear aprobado
        // actualizar contenido según estado actual
        renderPrereqPanel(panel, c);
        panel.classList.toggle("open");
        btn.textContent = panel.classList.contains("open") ? "Ocultar pre" : "Ver pre";
      });

      col.appendChild(card);
    });

    contenedor.appendChild(col);
  });
}

// ======== Controles ========
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-reset").addEventListener("click", () => {
    if (confirm("¿Reiniciar progreso?")) {
      cursosAprobados.clear();
      guardaProgreso();
      cargarMalla();
    }
  });

  const chk = document.getElementById("toggle-prereq");
  chk.addEventListener("change", (e) => {
    mostrarDesbloqueados = e.target.checked;
    cargarMalla();
  });

  cargarMalla();
});

