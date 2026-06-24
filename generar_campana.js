const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "datos");
const OUT_DIR = path.join(__dirname, "campanas");

const files = fs.readdirSync(DATA_DIR).filter((f) => f.startsWith("enviar_") && f.endsWith(".json"));
if (files.length === 0) {
  console.log("No hay campanas. Ejecuta: python 1_buscar.py && python 2_analizar.py");
  process.exit(1);
}
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function limpiarNumero(raw) {
  let num = raw.replace(/\s*(ext|x|opción)\s*[.\s]*\d+\s*$/i, "").replace(/\D/g, "");
  if (num.startsWith("57")) num = num.slice(2);
  if (num.startsWith("0")) num = num.slice(1);
  if (!num.startsWith("3") || num.length !== 10) return null;
  return "57" + num;
}

for (const file of files) {
  const negocios = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8"));
  const campanaName = file.replace("enviar_", "").replace(".json", "");
  const fileName = `campana_${campanaName}.html`;

  const contactos = [];
  let htmlRows = "";
  let idx = 0;
  const tipos = [...new Set(negocios.map((n) => n.tipo))].sort();

  for (const tipo of tipos) {
    const items = negocios.filter((n) => n.tipo === tipo && limpiarNumero(n.telefono));
    if (items.length === 0) continue;
    htmlRows += `<tr class="th"><td colspan="6">${tipo} (${items.length})</td></tr>`;
    for (const n of items) {
      const num = limpiarNumero(n.telefono);
      const msg = encodeURIComponent(n.mensaje || `Hola, vi que ${n.nombre} esta en ${tipo}. Te puedo enviar info?`);
      const wa = `https://wa.me/${num}?text=${msg}`;
      const svc = (n.servicios_recomendados || []).slice(0, 3).join(", ");
      const email = n.email || "";
      const mailto = email ? "https://mail.google.com/mail/?view=cm&fs=1&to=" + encodeURIComponent(email) + "&su=" + encodeURIComponent("Contacto " + n.nombre) + "&body=" + msg : "";
      const msgRaw = n.mensaje || `Hola, vi que ${n.nombre} esta en ${tipo}. Te puedo enviar info?`;
      contactos.push({ idx, nombre: n.nombre, telefono: n.telefono, tipo, wa, email, mailto, mensaje: msgRaw });
      htmlRows += `<tr data-idx="${idx}" data-email="${email ? 1 : 0}"><td>${n.nombre}</td><td class="col-tel">${n.telefono}</td><td class="col-email" style="display:none">${email || "---"}</td><td class="svc">${svc}</td><td><a href="${wa}" target="_blank" class="btn btn-wa-link">Enviar</a><a href="${mailto || "#"}" target="_blank" class="btn btn-email-link" style="display:none">Enviar</a><button class="btn btn-smtp-link" data-idx="${idx}" onclick="enviarUnicoSMTP(this)" style="display:none">Enviar</button></td><td><a href="${wa}" target="_blank" class="btn-p btn-wa-link">Msj</a><a href="${mailto || "#"}" target="_blank" class="btn-p btn-email-link" style="display:none">Msj</a></td></tr>`;
      idx++;
    }
  }

  const contactosJSON = JSON.stringify(contactos);
  const sinTelefono = negocios.filter((n) => !n.telefono);

  // Build category stats for navigation
  const categorias = tipos.map((t) => {
    const wa = negocios.filter((n) => n.tipo === t && limpiarNumero(n.telefono)).length;
    const total = negocios.filter((n) => n.tipo === t).length;
    return { tipo: t, wa, total };
  }).filter((c) => c.wa > 0);
  const categoriasJSON = JSON.stringify(categorias);
  const catFolder = path.join(DATA_DIR, "por_categoria").replace(/\\/g, "/");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Scraper - Campaña ${campanaName}</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' fill='%23cc0000'/%3E%3C/svg%3E">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%}
body{background:#0d0d0d;color:#e0e0e0;font-family:system-ui,-apple-system,sans-serif;padding:20px 20px 140px}
h1{color:#fff;font-size:20px;margin-bottom:4px}
p.desc{color:#888;font-size:13px;margin-bottom:20px}
.stats{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap}
.stat{background:#111;border:1px solid #222;border-radius:4px;padding:12px 16px;text-align:center;flex:1;min-width:80px}
.stat .n{font-size:20px;font-weight:600;color:#ff2222}
.stat .l{font-size:10px;color:#777;text-transform:uppercase;letter-spacing:.05em}
table{width:100%;border-collapse:collapse;background:#111;border:1px solid #222;border-radius:4px;overflow:hidden}
th{background:#111;color:#999;font-size:10px;text-transform:uppercase;padding:8px 10px;text-align:left;border-bottom:1px solid #222;letter-spacing:.06em}
td{padding:8px 10px;font-size:12px;border-bottom:1px solid #181818;color:#ccc}
tr.th td{background:#0a0a0a;color:#ff3333;font-size:10px;text-transform:uppercase;padding:5px 10px;letter-spacing:.04em}
.svc{color:#666;font-size:11px;max-width:200px}
.btn,.btn-p{display:inline-block;padding:3px 10px;border-radius:3px;font-size:11px;text-decoration:none;font-weight:500}
.btn{color:#ff3333;border:1px solid #ff3333}
.btn:hover{background:#ff2222;color:#fff}
.btn-p{color:#666;border:1px solid #333}
.btn-p:hover{border-color:#555;color:#999}
input#search{width:100%;padding:8px 12px;background:#111;border:1px solid #222;border-radius:4px;color:#e0e0e0;font-size:13px;margin-bottom:12px;outline:none;font-family:inherit}
input#search:focus{border-color:#ff2222}
.prog-bar{position:fixed;bottom:72px;left:0;right:0;background:#0d0d0d;border-top:1px solid #181818;padding:6px 20px;z-index:99;display:flex;align-items:center;gap:10px}
.prog-bar .txt{font-size:12px;color:#888;white-space:nowrap;min-width:60px}
.prog-bar .bar{flex:1;height:3px;background:#222;border-radius:2px}
.prog-bar .bar div{height:100%;background:#ff3333;border-radius:2px;width:0;transition:width .3s}
.action-footer{position:fixed;bottom:0;left:0;right:0;background:#0d0d0d;border-top:1px solid #222;padding:8px 20px;z-index:100}
.action-footer .info{display:flex;gap:6px;align-items:baseline;margin-bottom:6px;font-size:12px}
.action-footer .info .nm{color:#fff;font-weight:600}
.action-footer .info .dt{color:#555}
.actions{display:flex;gap:4px;align-items:center}
.actions button{flex:1;padding:6px 8px;border:none;border-radius:3px;font-size:11px;font-weight:500;cursor:pointer;font-family:inherit;min-width:0;white-space:nowrap}
.actions button:disabled{opacity:.3;cursor:default}
.btn-wa{background:#cc0000;color:#fff}
.btn-wa:hover:not(:disabled){background:#ff2222}
.btn-ok{background:#cc0000;color:#fff}
.btn-ok:hover:not(:disabled){background:#ff2222}
.btn-sk{background:#181818;color:#888;border:1px solid #222!important}
.btn-sk:hover:not(:disabled){background:#222;color:#ccc}
.btn-st{background:#181818;color:#888;border:1px solid #222!important}
.btn-st:hover:not(:disabled){background:#222;color:#ccc}
.btn-rs{background:#111;color:#555;border:1px solid #222!important;font-size:10px!important}
.btn-rs:hover:not(:disabled){background:#1a1a1a}
.btn-start{background:transparent;color:#ff3333;border:1px solid #ff3333;padding:8px 16px;border-radius:3px;font-size:12px;cursor:pointer;font-family:inherit}
.btn-start:hover{background:#ff2222;color:#fff}
.smtp-group{display:none;align-items:center;gap:4px;margin-left:4px}
.smtp-group.show{display:flex}
.smtp-group .stat-smtp{color:#888;font-size:10px;white-space:nowrap}
.smtp-input{width:36px;padding:3px 4px;background:#111;border:1px solid #333;border-radius:3px;color:#e0e0e0;font-size:11px;text-align:center;outline:none;font-family:inherit}
.smtp-input:focus{border-color:#ff3333}
.smtp-input:disabled{opacity:.3}
.btn-smtp-link{display:none;padding:3px 8px;min-width:48px;border-radius:3px;font-size:11px;text-decoration:none;font-weight:500;cursor:pointer;font-family:inherit;border:1px solid #cc0000;color:#fff;background:#cc0000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.btn-smtp-link:hover:not(:disabled){background:#990000;border-color:#990000}
.btn-smtp-link:disabled{opacity:.5;cursor:default}
.btn-smtp-link.ok{background:#006600!important;border-color:#006600!important;color:#fff!important}
.btn-smtp-link.err{background:#660000!important;border-color:#660000!important;color:#fff!important}
.enviado{opacity:.25}
.enviado td:first-child::after{content:" enviado";color:#555;font-size:9px;margin-left:5px;text-transform:uppercase;letter-spacing:.05em}
.activo{background:#1a0000!important;border-left:2px solid #ff3333}
.cats{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px}
.cats button{background:#111;border:1px solid #222;border-radius:3px;color:#888;padding:4px 10px;font-size:11px;cursor:pointer;font-family:inherit}
.cats button:hover{border-color:#555;color:#ccc}
.cats button.act{border-color:#ff3333;color:#ff3333;background:#1a0000}
.cats button .n{color:#ff3333;font-weight:600}
.cats button.act .n{color:#fff}
.sin-tel{margin-top:16px;padding:12px;background:#111;border-radius:4px;border:1px solid #222;color:#777;font-size:12px}
.sin-tel details{cursor:pointer}
.sin-tel li{margin:2px 0 2px 16px;color:#555;font-size:11px}
.dl-link{color:#666;font-size:11px;text-decoration:none;margin-left:4px}
.dl-link:hover{color:#ff3333}
.modes{display:flex;gap:0;margin-bottom:16px;border:1px solid #222;border-radius:4px;overflow:hidden;width:fit-content}
.modes button{background:#111;border:none;color:#888;padding:6px 16px;font-size:12px;cursor:pointer;font-family:inherit;border-right:1px solid #222}
.modes button:last-child{border-right:none}
.modes button.act{background:#1a0000;color:#ff3333;font-weight:600}
.ad{background:#0a0a0a;border:1px solid #1a1a1a;border-radius:4px;padding:8px 12px;margin:12px 0;text-align:center;position:relative}
.ad .lbl{position:absolute;top:2px;left:6px;font-size:8px;color:#444;text-transform:uppercase;letter-spacing:.1em}
.ad .in{color:#555;font-size:11px}
.ad a{color:#cc0000;text-decoration:none;font-size:12px}
.ad a:hover{color:#ff2222}
</style>
</head>
<body>

<h1>Scraping <span style="color:#cc0000">Justa</span> — ${campanaName}</h1>
<p class="desc">${negocios.length} negocios · ${contactos.length} WhatsApp (celular 3XX) · ${sinTelefono.length + (negocios.filter(n => n.telefono && !limpiarNumero(n.telefono)).length)} fijos/sin número</p>

<div class="modes">
  <button class="act" onclick="setModo('wa')" id="modWA">WhatsApp</button>
  <button onclick="setModo('email')" id="modEmail">Gmail Web <span style="color:#666;font-size:10px">(${contactos.filter(c => c.email).length})</span></button>
  <button onclick="setModo('smtp')" id="modSMTP">SMTP Auto</button>
</div>

<div class="stats">
  <div class="stat"><div class="n">${negocios.length}</div><div class="l">Total</div></div>
  <div class="stat"><div class="n">${contactos.length}</div><div class="l">WhatsApp</div></div>
  <div class="stat"><div class="n">${tipos.length}</div><div class="l">Tipos</div></div>
  <div class="stat"><button class="btn-start" onclick="iniciar()">Envio Masivo</button></div>
</div>

<div class="ad"><span class="lbl">Anuncio</span><span class="in">╰┈➤ <a href="#">Mas Negocios</a> · <a href="#">Tu anuncio aqui</a></span></div>

<div class="cats" id="cats"></div>

<div class="prog-bar" id="progBar">
  <span class="txt" id="progText">0 / ${contactos.length}</span>
  <div class="bar"><div id="progFill"></div></div>
</div>

<div class="action-footer" id="actionFooter">
  <div class="info">
    <span class="nm" id="curName">---</span>
    <span class="dt" id="curDetail">Inactivo</span>
  </div>
  <div class="actions">
    <button class="btn-wa" id="btnAbrirWA" onclick="abrirWA()" disabled>Abrir WhatsApp</button>
    <button class="btn-ok" id="btnOk" onclick="marcarEnviado()" disabled>Ya envie</button>
    <button class="btn-sk" id="btnSaltar" onclick="saltar()" disabled>Saltar</button>
    <button class="btn-st" onclick="detener()">Detener</button>
    <button class="btn-rs" onclick="reiniciar()">Reiniciar</button>
    <div class="smtp-group" id="smtpGroup">
      <span class="stat-smtp" id="statSMTP"></span>
      <input type="number" id="smtpBatch" value="20" min="1" max="200" class="smtp-input" disabled>
      <button class="btn-wa" id="btnSMTPStart" onclick="iniciarSMTP()" disabled style="padding:6px 20px">Enviar</button>
      <button class="btn-st" id="btnSMTPStop" onclick="detenerSMTP()" style="display:none">Detener</button>
      <button class="btn-rs" id="btnSMTPReset" onclick="reiniciarSMTP()" style="font-size:10px!important;padding:4px 6px">Reiniciar</button>
    </div>
  </div>
</div>

<input type="text" id="search" placeholder="Buscar por nombre, tipo o telefono..." onkeyup="filtrar()">

<div class="ad"><span class="lbl">Anuncio</span><span class="in">╰┈➤ <a href="#">Tu marca aqui</a> · <a href="#">Publica con nosotros</a></span></div>

<table>
<thead><tr><th>Nombre</th><th class="col-tel">Telefono</th><th class="col-email" style="display:none">Email</th><th>Servicios</th><th>Contacto</th><th>Msj</th></tr></thead>
<tbody id="tabla">
${htmlRows}
</tbody>
</table>

<div class="sin-tel">
<details>
  <summary>${sinTelefono.length} negocios sin telefono (clic para ver)</summary>
  <ul>${sinTelefono.map((n) => `<li>[${n.tipo}] ${n.nombre}</li>`).join("")}</ul>
</details>
</div>

<script>
const contactos = ${contactosJSON};
const categorias = ${categoriasJSON};
const COOLDOWN = 60;
const KEY = "campana_progreso";
let catActiva = "";

function initCats() {
  var cont = document.getElementById("cats");
  cont.innerHTML = "";
  var todos = document.createElement("button");
  todos.textContent = "Todas " + contactos.length;
  if (catActiva === "") todos.className = "act";
  todos.onclick = function() { filtrarCategoria(""); };
  cont.appendChild(todos);
  categorias.forEach(function(c) {
    var b = document.createElement("button");
    b.textContent = c.tipo + " " + c.wa;
    if (catActiva === c.tipo) b.className = "act";
    b.onclick = function() { filtrarCategoria(c.tipo); };
    cont.appendChild(b);
  });
}

function filtrarCategoria(tipo) {
  catActiva = tipo;
  initCats();
  var q = document.getElementById("search").value.toLowerCase();
  var trs = document.querySelectorAll("#tabla tr");
  var i = 0;
  while (i < trs.length) {
    if (trs[i].classList.contains("th")) {
      var headerTxt = trs[i].textContent.toLowerCase();
      var headerMatch = !tipo || headerTxt.indexOf(tipo.toLowerCase()) !== -1;
      trs[i].style.display = headerMatch ? "" : "none";
      i++;
      while (i < trs.length && !trs[i].classList.contains("th")) {
        var rowMatch = true;
        if (!headerMatch) rowMatch = false;
        if (rowMatch && q) rowMatch = trs[i].textContent.toLowerCase().indexOf(q) !== -1;
        if (modo === "email" && rowMatch) rowMatch = trs[i].getAttribute("data-email") === "1";
        trs[i].style.display = rowMatch ? "" : "none";
        i++;
      }
    } else {
      i++;
    }
  }
}

const catFolder = "${catFolder}";
let enviados;
try {
  const saved = localStorage.getItem(KEY);
  enviados = saved ? new Set(JSON.parse(saved)) : new Set();
} catch { enviados = new Set(); }

function guardar() {
  localStorage.setItem(KEY, JSON.stringify([...enviados]));
}

contactos.forEach(function(_, i) {
  if (enviados.has(i)) {
    var r = document.querySelector('tr[data-idx="' + i + '"]');
    if (r) r.classList.add("enviado");
  }
});

let activo = false;
let cur = 0;
let cd = null;

function sigNoEnv(desde) {
  for (var i = desde + 1; i < contactos.length; i++) { if (!enviados.has(i) && (modo !== "email" || contactos[i].email)) return i; }
  for (var i = 0; i < desde; i++) { if (!enviados.has(i) && (modo !== "email" || contactos[i].email)) return i; }
  return -1;
}

function iniciar() {
  if (enviados.size >= contactos.length) { alert("Completado!"); return; }
  activo = true;
  cur = sigNoEnv(-1);
  document.getElementById("btnAbrirWA").disabled = false;
  document.getElementById("btnOk").disabled = false;
  document.getElementById("btnSaltar").disabled = false;
  document.getElementById("smtpBatch").disabled = false;
  mostrar();
}

function mostrar() {
  var c = contactos[cur];
  document.getElementById("progText").textContent = enviados.size + " / " + contactos.length;
  document.getElementById("progFill").style.width = (enviados.size / contactos.length * 100) + "%";
  document.getElementById("curName").textContent = c.nombre;
  document.getElementById("curDetail").textContent = "[" + c.tipo + "] " + c.telefono;
  document.querySelectorAll("tr").forEach(function(r) { r.classList.remove("activo"); });
  var row = document.querySelector('tr[data-idx="' + cur + '"]');
  if (row) row.classList.add("activo");
}

function enviarUnicoSMTP(btn) {
  var idx = btn.getAttribute("data-idx");
  var c = contactos[idx];
  if (!c.email) return;
  btn.disabled = true;
  btn.textContent = "Enviando...";
  btn.className = "btn btn-smtp-link";
  fetch("/api/enviar-unico", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({email: c.email, nombre: c.nombre, mensaje: c.mensaje || "Hola, " + c.nombre + "!"})
  }).then(function(r) { return r.json(); }).then(function(data) {
    if (data.ok) {
      btn.className = "btn btn-smtp-link ok";
      btn.textContent = "OK ✓";
    } else {
      btn.className = "btn btn-smtp-link err";
      btn.textContent = "Falló";
      setTimeout(function() { btn.disabled = false; btn.textContent = "Enviar"; btn.className = "btn btn-smtp-link"; }, 2000);
    }
  }).catch(function() {
    btn.className = "btn btn-smtp-link err";
    btn.textContent = "Error";
    setTimeout(function() { btn.disabled = false; btn.textContent = "Enviar"; btn.className = "btn btn-smtp-link"; }, 2000);
  });
}

function abrirWA() {
  if (!activo) return;
  var c = contactos[cur];
  if (modo === "email") {
    if (!c.email) { alert("Este contacto no tiene email. Saltando..."); saltar(); return; }
    window.open(c.mailto, "_blank");
  } else {
    window.open(c.wa, "w");
  }
}

function marcarEnviado() {
  if (!activo || cd) return;
  enviados.add(cur);
  guardar();
  var row = document.querySelector('tr[data-idx="' + cur + '"]');
  if (row) row.classList.add("enviado");
  document.getElementById("btnOk").disabled = true;
  var segs = COOLDOWN;
  document.getElementById("btnOk").textContent = "[" + segs + "s]";
  cd = setInterval(function() {
    segs--;
    document.getElementById("btnOk").textContent = "[" + segs + "s]";
    if (segs <= 0) {
      clearInterval(cd); cd = null;
      document.getElementById("btnOk").textContent = "Ya envie";
      document.getElementById("btnOk").disabled = false;
      avanzar();
    }
  }, 1000);
}

function saltar() {
  if (!activo || cd) return;
  avanzar();
}

function avanzar() {
  var next = sigNoEnv(cur);
  if (next === -1) {
    document.getElementById("curName").textContent = "Completado!";
    document.getElementById("curDetail").textContent = "Todos enviados";
    document.getElementById("progText").textContent = contactos.length + " / " + contactos.length;
    document.getElementById("progFill").style.width = "100%";
    activo = false;
    document.getElementById("btnAbrirWA").disabled = true;
    document.getElementById("btnOk").disabled = true;
    document.getElementById("btnSaltar").disabled = true;
    document.getElementById("smtpBatch").disabled = true;
    alert("Completado!");
    return;
  }
  cur = next;
  mostrar();
}

function detener() {
  activo = false;
  if (cd) { clearInterval(cd); cd = null; }
  document.getElementById("btnAbrirWA").disabled = true;
  document.getElementById("btnOk").disabled = true;
  document.getElementById("btnSaltar").disabled = true;
  document.getElementById("smtpBatch").disabled = true;
  document.getElementById("curName").textContent = "---";
  document.getElementById("curDetail").textContent = "Detenido";
  document.getElementById("btnOk").textContent = "Ya envie";
  document.querySelectorAll("tr").forEach(function(r) { r.classList.remove("activo"); });
}

function reiniciar() {
  if (confirm("Borrar progreso?")) {
    enviados = new Set();
    guardar();
    location.reload();
  }
}

function filtrar() {
  filtrarCategoria(catActiva);
}

let modo = "wa";

function setModo(m) {
  modo = m;
  var esWA = m === "wa";
  var esSMTP = m === "smtp";
  document.getElementById("modWA").className = esWA ? "act" : "";
  document.getElementById("modEmail").className = m === "email" ? "act" : "";
  document.getElementById("modSMTP").className = esSMTP ? "act" : "";
  document.getElementById("btnAbrirWA").textContent = esWA ? "Abrir WhatsApp" : "Abrir Gmail";
  document.getElementById("btnAbrirWA").style.display = esSMTP ? "none" : "";
  document.getElementById("btnOk").style.display = esSMTP ? "none" : "";
  document.getElementById("btnSaltar").style.display = esSMTP ? "none" : "";
  document.getElementById("smtpGroup").className = "smtp-group" + (esSMTP ? " show" : "");
  if (esSMTP) setTimeout(pollSMTP, 200);
  document.querySelectorAll(".col-tel").forEach(function(el) { el.style.display = esWA ? "" : "none"; });
  document.querySelectorAll(".col-email").forEach(function(el) { el.style.display = esWA ? "none" : ""; });
  document.querySelectorAll(".btn-wa-link").forEach(function(el) { el.style.display = esWA ? "" : "none"; });
  document.querySelectorAll(".btn-email-link").forEach(function(el) { el.style.display = esWA ? "none" : ""; });
  document.querySelectorAll(".btn-smtp-link").forEach(function(el) { el.style.display = esSMTP ? "" : "none"; });
  document.querySelectorAll("#tabla tr[data-idx]").forEach(function(r) {
    if (esWA) { r.style.display = ""; return; }
    var hasEmail = r.getAttribute("data-email") === "1";
    r.style.display = hasEmail ? "" : "none";
  });
  recheckHeaders();
}

function recheckHeaders() {
  document.querySelectorAll("#tabla tr.th").forEach(function(h) {
    var nxt = h.nextElementSibling;
    var vis = false;
    while (nxt && !nxt.classList.contains("th")) {
      if (nxt.style.display !== "none") { vis = true; break; }
      nxt = nxt.nextElementSibling;
    }
    h.style.display = vis ? "" : "none";
  });
}

// SMTP functions
var smtpPoll = null;

function pollSMTP() {
  fetch("/api/estado").then(function(r) { return r.json(); }).then(function(e) {
    document.getElementById("statSMTP").textContent = e.activo ? (e.enviados + "/" + (e.enviados + e.pendientes) + " — " + e.actual) : (e.enviados > 0 ? "Completado: " + e.enviados + " enviados, " + e.fallos + " fallos" : "");
    document.getElementById("btnSMTPStart").disabled = e.activo;
    document.getElementById("btnSMTPStart").style.display = e.activo ? "none" : "";
    document.getElementById("btnSMTPStop").style.display = e.activo ? "" : "none";
    if (e.activo && e.enviados > 0) {
      document.getElementById("progText").textContent = e.enviados + " / " + contactos.length;
      document.getElementById("progFill").style.width = (e.enviados / contactos.length * 100) + "%";
    }
    if (e.activo) smtpPoll = setTimeout(pollSMTP, 1000);
  }).catch(function() { smtpPoll = setTimeout(pollSMTP, 2000); });
}

function iniciarSMTP() {
  var batch = parseInt(document.getElementById("smtpBatch").value) || 20;
  fetch("/api/iniciar?batch=" + batch).then(function() {
    pollSMTP();
  });
}

function detenerSMTP() {
  fetch("/api/detener");
}

function reiniciarSMTP() {
  if (confirm("Borrar progreso SMTP?")) {
    fetch("/api/reiniciar").then(function() { location.reload(); });
  }
}

// Init categories on load
initCats();
</script>
</body>
</html>`;

  fs.writeFileSync(path.join(OUT_DIR, fileName), html, "utf-8");
  console.log("Campana generada: " + path.join(OUT_DIR, fileName));
  console.log("   " + negocios.length + " negocios · " + contactos.length + " con WhatsApp · " + tipos.length + " tipos");
}
