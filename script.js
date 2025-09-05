const contenedorMalla = document.getElementById("malla");
const btnReset = document.getElementById("btn-reset");
const btnTogglePrereq = document.getElementById("toggle-prereq");

const STORAGE_KEY = "malla_progreso_v1";

let cursos = [];
let aprobados = new Set();
let mostrarPrereq = true;

// === Inicialización segura ===
if (!localStorage.getItem(STORAGE_KEY)) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
}
cargarProgreso();

// === Cargar cursos desde JSON ===
fetch("data.json")
  .then(res => res.json())
  .then(data => {
    cursos = data;
    renderMalla();
  });

// === Eventos de controles ===
btnReset.addEventListener("click", () => {
  if (confirm("¿Quieres reiniciar tu progreso?")) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    aprobados.clear();
    renderMalla();
  }
});

btnTogglePrereq.addEventListener("change", () => {
  mostrarPrereq = btnTogglePrereq.checked;
  renderMalla();
});

// === Funciones de guardado/carga ===
function guardarProgreso() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(aprobados)));
}

function cargarProgreso() {
  try {
    const guardado = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(guardado)) {
      aprobados = new Set(guardado);
    } else {
      aprobados = new Set();
    }
  } catch (e) {
    aprobados = new Set();
  }
}

// === Render de la malla ===
function renderMalla() {
  contenedorMalla.innerHTML = "";

  const porSemestre = {};
  cursos.forEach(c => {
    if (!porSemestre[c.semestre]) porSemestre[c.semestre] = [];
    porSemestre[c.semestre].push(c);
  });

  Object.keys(porSemestre).sort((a, b) => a - b).forEach(sem => {
    const columna = document.createElement("div");
    columna.className = "semestre";
    columna.innerHTML = `<h3>Semestre ${sem}</h3>`;

    porSemestre[sem].forEach(curso => {
      const cursoDiv = document.createElement("div");
      cursoDiv.className = "curso";
      if (aprobados.has(curso.codigo)) cursoDiv.classList.add("aprobado");

      const desbloqueado = (curso.prerreq || []).every(c => aprobados.has(c));
      if (!desbloqueado && !aprobados.has(curso.codigo)) {
        cursoDiv.classList.add("bloqueado");
      } else if (!aprobados.has(curso.codigo)) {
        cursoDiv.classList.add("desbloqueado");
      }

      cursoDiv.innerHTML = `
        <div class="codigo">${curso.codigo}</div>
        <div class="nombre">${curso.nombre}</div>
        <div class="sct">${curso.sct} SCT</div>
        <div class="badges">
          ${aprobados.has(curso.codigo) ? '<div class="badge ok">OK</div>' :
            (!desbloqueado ? '<div class="badge req">Req</div>' : '')}
        </div>
        <button class="btn-prereq">Ver prerequisitos</button>
        <div class="prereq-panel">
          <strong>Prerrequisitos:</strong>
          <ul>
            ${(curso.prerreq || []).map(cod => {
              const ok = aprobados.has(cod);
              const nombre = cursos.find(c => c.codigo === cod)?.nombre || cod;
              return `<li class="${ok ? 'ok' : 'miss'}">${nombre}</li>`;
            }).join('')}
          </ul>
          ${!curso.prerreq || curso.prerreq.length === 0
            ? "<div>Sin prerrequisitos</div>"
            : `<div style="margin-top:6px">Estado: <span class="${desbloqueado ? 'ok' : 'miss'}">
                ${desbloqueado ? "Todos cumplidos" : "Faltan por aprobar"}
              </span></div>`}
        </div>
      `;

      // Botón "Ver prerrequisitos"
      const btnPre = cursoDiv.querySelector(".btn-prereq");
      const panel = cursoDiv.querySelector(".prereq-panel");
      btnPre.addEventListener("click", e => {
        e.stopPropagation();
        panel.classList.toggle("open");
        btnPre.textContent = panel.classList.contains("open") ? "Ocultar pre" : "Ver prerequisitos";
      });

      // Click en curso: aprobar/desaprobar
      cursoDiv.addEventListener("click", () => {
        const prereqs = curso.prerreq || [];
        const cumple = prereqs.every(cod => aprobados.has(cod));

        if (!aprobados.has(curso.codigo)) {
          if (!cumple) {
            if (!panel.classList.contains("open")) {
              panel.classList.add("open");
              btnPre.textContent = "Ocultar pre";
            }
            return;
          }
          aprobados.add(curso.codigo);
        } else {
          aprobados.delete(curso.codigo);
        }

        guardarProgreso();
        renderMalla();
      });

      if (!mostrarPrereq) {
        btnPre.style.display = "none";
        panel.style.display = "none";
      }

      columna.appendChild(cursoDiv);
    });

    contenedorMalla.appendChild(columna);
  });
}
