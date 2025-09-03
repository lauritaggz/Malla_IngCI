// ======== Estado ========
const APROBADOS_KEY = "malla_aprobados";
let cursosAprobados = new Set(JSON.parse(localStorage.getItem(APROBADOS_KEY) || "[]"));
let datos = null;
let byId = {};
let mostrarDesbloqueados = true;
let byId = {};
let byCode = {};


// ======== Util ========
const guardaProgreso = () => {
  localStorage.setItem(APROBADOS_KEY, JSON.stringify([...cursosAprobados]));
};
const tieneTodos = (prereqs) => (prereqs || []).every((id) => cursosAprobados.has(id));
const idToNombre = (id) => (byId[id]?.nombre || `ID ${id}`);
function buildMaps(datos){
  byId = {};
  byCode = {};
  datos.semestres.forEach(sem => sem.cursos.forEach(c => {
    byId[c.id] = c;
    if (c.codigo) byCode[c.codigo.trim().toUpperCase()] = c.id;
  }));
}
function cumplePrereq(curso){
  const okIds = (curso.prerrequisitos || []).every(id => cursosAprobados.has(id));
  const okExpr = cumpleExprPorCodigo(curso.prereq_expr || "", cursosAprobados);
  return okIds && okExpr;
}


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
function cumpleExprPorCodigo(expr, aprobadosSet){
  if (!expr || !expr.trim()) return true;

  let s = expr.toUpperCase().replace(/\s+/g, " ");
  s = s.replace(/[A-Z]{2,}\d{2,}/g, (code)=>{
    const id = byCode[code];
    return id ? (aprobadosSet.has(id) ? "true" : "false") : "false";
  });
  s = s.replace(/\by\b/g, "&&").replace(/\bo\b/g, "||");

  try {
    // eslint-disable-next-line no-eval
    return !!eval(s);
  } catch { return false; }
}
async function cargarMalla() {
  const res = await fetch("data.json");
  datos = await res.json();
  buildMaps(datos); // <-- aquí
  




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
      const desbloq = cumplePrereq(c);

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
        <div class="sct">${c.sct ?? c.creditos ?? ""} SCT</div>
        <button class="btn-prereq" type="button">Ver pre</button>
        <div class="prereq-panel"></div>
      `;

      // click en tarjeta: toggle aprobado
      card.addEventListener("click", () => {
        if (cursosAprobados.has(c.id)) cursosAprobados.delete(c.id);
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

function exportarProgreso() {
  const payload = {
    version: 1,
    timestamp: new Date().toISOString(),
    aprobados: [...cursosAprobados]  // ids de cursos
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "progreso-malla.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importarProgreso(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.aprobados)) throw new Error("Formato inválido");
      cursosAprobados = new Set(data.aprobados.map(Number));
      localStorage.setItem(APROBADOS_KEY, JSON.stringify([...cursosAprobados]));
      alert("Progreso importado correctamente.");
      cargarMalla();
    } catch (e) {
      alert("No se pudo importar: " + e.message);
    }
  };
  reader.readAsText(file);
  document.getElementById("btn-export").addEventListener("click", exportarProgreso);

  // Importar
  const input = document.getElementById("file-import");
  input.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) importarProgreso(file);
    e.target.value = ""; 
  });
}





