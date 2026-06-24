const fs = require("fs");
const path = require("path");

const DATA = path.join(__dirname, "datos", "enviar_barranquilla.json");
const OUT = path.join(__dirname, "campanas", "campana_limpia.html");

const negocios = JSON.parse(fs.readFileSync(DATA, "utf-8"));

function limpiarNumero(raw) {
  let num = raw.replace(/\s*(ext|x|opción)\s*[.\s]*\d+\s*$/i, "").replace(/\D/g, "");
  if (num.startsWith("57")) num = num.slice(2);
  if (num.startsWith("0")) num = num.slice(1);
  if (!num.startsWith("3") || num.length !== 10) return null;
  return "57" + num;
}

const contactos = [];
let htmlRows = "";
let idx = 0;
const tipos = [...new Set(negocios.map(n => n.tipo))].sort();

for (const tipo of tipos) {
  const items = negocios.filter(n => n.tipo === tipo && limpiarNumero(n.telefono));
  if (items.length === 0) continue;
  htmlRows += `<tr class="th"><td colspan="5">${tipo} (${items.length})</td></tr>`;
  for (const n of items) {
    const num = limpiarNumero(n.telefono);
    const msg = encodeURIComponent(n.mensaje || `Hola, vi que ${n.nombre} esta en ${tipo}. Te puedo enviar info?`);
    const wa = `https://wa.me/${num}?text=${msg}`;
    const svc = (n.servicios_recomendados || []).slice(0, 3).join(", ");
    contactos.push({ idx, nombre: n.nombre, telefono: n.telefono, tipo, wa });
    htmlRows += `<tr data-idx="${idx}"><td>${n.nombre}</td><td>${n.telefono}</td><td class="svc">${svc}</td><td><a href="${wa}" target="_blank" class="btn">Enviar</a></td><td><a href="${wa}" target="_blank" class="btn-p">Msj</a></td></tr>`;
    idx++;
  }
}

const contactosJSON = JSON.stringify(contactos);

const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Campaña Barranquilla</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0d0d0d;color:#e0e0e0;font-family:system-ui,-apple-system,sans-serif;padding:20px}
h1{color:#fff;font-size:20px;margin-bottom:4px}
p.desc{color:#888;font-size:13px;margin-bottom:20px}
.stats{display:flex;gap:10px;margin-bottom:16px}
.stat{background:#111;border:1px solid #222;border-radius:4px;padding:12px 16px;text-align:center;flex:1}
.stat .n{font-size:20px;font-weight:600;color:#ff2222}
.stat .l{font-size:10px;color:#777;text-transform:uppercase;letter-spacing:.05em}
table{width:100%;border-collapse:collapse;background:#111;border:1px solid #222;border-radius:4px;overflow:hidden}
th{background:#111;color:#999;font-size:10px;text-transform:uppercase;padding:8px 10px;text-align:left;border-bottom:1px solid #222;letter-spacing:.06em}
td{padding:8px 10px;font-size:12px;border-bottom:1px solid #181818;color:#ccc}
tr.th td{background:#0a0a0a;color:#ff3333;font-size:10px;text-transform:uppercase;padding:5px 10px;letter-spacing:.04em}
.svc{color:#666;font-size:11px}
.btn,.btn-p{display:inline-block;padding:3px 10px;border-radius:3px;font-size:11px;text-decoration:none;font-weight:500}
.btn{color:#ff3333;border:1px solid #ff3333}
.btn:hover{background:#ff2222;color:#fff}
.btn-p{color:#666;border:1px solid #333}
.btn-p:hover{border-color:#555;color:#999}
input#search{width:100%;padding:8px 12px;background:#111;border:1px solid #222;border-radius:4px;color:#e0e0e0;font-size:13px;margin-bottom:12px;outline:none;font-family:inherit}
input#search:focus{border-color:#ff2222}
.mass-bar{display:none;background:#111;border:1px solid #222;border-radius:4px;padding:16px;margin-bottom:16px}
.mass-bar.show{display:block}
.mass-bar .info{background:#0a0a0a;padding:10px 12px;border-radius:3px;margin-bottom:12px}
.mass-bar .info .nm{font-size:14px;font-weight:600;color:#fff}
.mass-bar .info .dt{font-size:11px;color:#777}
.mass-bar .prog{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.mass-bar .prog .txt{font-size:13px;color:#e0e0e0}
.mass-bar .prog .bar{flex:1;height:4px;background:#222;border-radius:2px}
.mass-bar .prog .bar div{height:100%;background:#ff3333;border-radius:2px;width:0}
.actions{display:flex;gap:6px}
.actions button{flex:1;padding:8px;border:none;border-radius:3px;font-size:12px;font-weight:500;cursor:pointer;font-family:inherit}
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
.enviado{opacity:.25}
.enviado td:first-child::after{content:" enviado";color:#555;font-size:9px;margin-left:5px;text-transform:uppercase;letter-spacing:.05em}
.activo{background:#1a0000!important;border-left:2px solid #ff3333}
</style>
</head>
<body>

<h1>Campaña Barranquilla</h1>
<p class="desc">${negocios.length} negocios &middot; ${contactos.length} WhatsApp (celular 3XX)</p>

<div class="stats">
  <div class="stat"><div class="n">${negocios.length}</div><div class="l">Total</div></div>
  <div class="stat"><div class="n">${contactos.length}</div><div class="l">WhatsApp</div></div>
  <div class="stat"><div class="n">${tipos.length}</div><div class="l">Tipos</div></div>
  <div class="stat"><button class="btn-start" onclick="iniciar()">Envio Masivo</button></div>
</div>

<div class="mass-bar" id="massBar">
  <div class="prog">
    <span class="txt" id="progText">0 / ${contactos.length}</span>
    <div class="bar"><div id="progFill"></div></div>
  </div>
  <div class="info">
    <div class="nm" id="curName">---</div>
    <div class="dt" id="curDetail">---</div>
  </div>
  <div class="actions">
    <button class="btn-wa" onclick="abrirWA()">Abrir WhatsApp</button>
    <button class="btn-ok" id="btnOk" onclick="marcarEnviado()">Ya envie</button>
    <button class="btn-sk" onclick="saltar()">Saltar</button>
    <button class="btn-st" onclick="detener()">Detener</button>
    <button class="btn-rs" onclick="reiniciar()">Reiniciar</button>
  </div>
</div>

<input type="text" id="search" placeholder="Buscar..." onkeyup="filtrar()">

<table>
<thead><tr><th>Nombre</th><th>Telefono</th><th>Servicios</th><th>WhatsApp</th><th>Msj</th></tr></thead>
<tbody id="tabla">
${htmlRows}
</tbody>
</table>

<script>
const contactos = ${contactosJSON};
const COOLDOWN = 60;
const KEY = "campana_progreso";
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
  for (var i = desde + 1; i < contactos.length; i++) { if (!enviados.has(i)) return i; }
  for (var i = 0; i < desde; i++) { if (!enviados.has(i)) return i; }
  return -1;
}

function iniciar() {
  if (enviados.size >= contactos.length) { alert("Completado!"); return; }
  activo = true;
  document.getElementById("massBar").classList.add("show");
  cur = sigNoEnv(-1);
  mostrar();
}

function mostrar() {
  var c = contactos[cur];
  document.getElementById("progText").textContent = enviados.size + " / " + contactos.length;
  document.getElementById("progFill").style.width = (enviados.size / contactos.length * 100) + "%";
  document.getElementById("curName").textContent = c.nombre;
  document.getElementById("curDetail").textContent = "[" + c.tipo + "] " + c.telefono;
  document.getElementById("btnOk").style.display = "";
  document.querySelectorAll("tr").forEach(function(r) { r.classList.remove("activo"); });
  var row = document.querySelector('tr[data-idx="' + cur + '"]');
  if (row) row.classList.add("activo");
}

function abrirWA() {
  if (!activo) return;
  window.open(contactos[cur].wa, "w");
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
    document.getElementById("btnOk").style.display = "none";
    activo = false;
    alert("Completado!");
    return;
  }
  cur = next;
  mostrar();
}

function detener() {
  activo = false;
  if (cd) { clearInterval(cd); cd = null; }
  document.getElementById("massBar").classList.remove("show");
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
  var q = document.getElementById("search").value.toLowerCase();
  var rows = document.querySelectorAll("#tabla tr");
  rows.forEach(function(r) {
    r.style.display = r.textContent.toLowerCase().includes(q) ? "" : "none";
  });
}
</script>
</body>
</html>`;

fs.writeFileSync(OUT, html, "utf-8");
console.log("OK: " + OUT);
console.log(contactos.length + " contactos con WhatsApp");
