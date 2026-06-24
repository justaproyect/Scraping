const http = require("http");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

const DATA = path.join(__dirname, "datos", "enviar_barranquilla.json");
const PROGRESS = path.join(__dirname, ".gmail_progress.json");
const CONFIG = path.join(__dirname, "datos", "smtp_config.json");

function getSMTPConfig() {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    return { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS };
  }
  if (fs.existsSync(CONFIG)) return JSON.parse(fs.readFileSync(CONFIG, "utf-8"));
  return null;
}
const HTML_FILE = path.join(__dirname, "campanas", "campana_barranquilla.html");

const MIME = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript", ".json": "application/json" };

let estado = { total: 0, enviados: 0, fallos: 0, pendientes: 0, activo: false, actual: "" };
let transport = null;
let enviando = false;
let detenerSolicitado = false;

function cargarProgreso() {
  if (!fs.existsSync(PROGRESS)) return {};
  return JSON.parse(fs.readFileSync(PROGRESS, "utf-8"));
}

function guardarProgreso(d) {
  fs.writeFileSync(PROGRESS, JSON.stringify(d));
}

async function iniciarEnvio(batchSize) {
  if (enviando) return;
  var cfg = getSMTPConfig();
  if (!cfg) { estado.error = "Config SMTP no encontrada (smtp_config.json o env vars)"; return; }

  transport = nodemailer.createTransport({ service: "gmail", auth: { user: cfg.user, pass: cfg.pass } });
  try { await transport.verify(); } catch (e) { estado.error = "SMTP: " + e.message; return; }

  var negocios = JSON.parse(fs.readFileSync(DATA, "utf-8")).filter(n => n.email && /@/.test(n.email));
  var enviados = cargarProgreso();
  var pendientes = negocios.filter(n => !enviados[n.email + n.nombre]);

  if (pendientes.length === 0) { estado.error = "Todos enviados"; return; }

  var lote = Math.min(batchSize || pendientes.length, pendientes.length);
  enviando = true;
  detenerSolicitado = false;
  estado.activo = true;
  estado.total = pendientes.length;
  estado.enviados = 0;
  estado.fallos = 0;
  estado.pendientes = pendientes.length;
  estado.actual = "";

  for (var i = 0; i < lote && !detenerSolicitado; i++) {
    var n = pendientes[i];
    var key = n.email + n.nombre;
    estado.actual = n.nombre + " (" + n.email + ")";
    try {
      await transport.sendMail({
        from: cfg.user, to: n.email,
        subject: "Contacto " + n.nombre,
        text: n.mensaje || "Hola, " + n.nombre + "!"
      });
      enviados[key] = true;
      guardarProgreso(enviados);
      estado.enviados++;
    } catch (e) {
      estado.fallos++;
    }
    estado.pendientes = pendientes.length - i - 1;
    if (i < lote - 1 && !detenerSolicitado) await new Promise(r => setTimeout(r, (cfg.delay || 5) * 1000));
  }

  enviando = false;
  estado.activo = false;
  estado.actual = detenerSolicitado ? "Detenido" : "Completado";
}

const server = http.createServer((req, res) => {
  var url = new URL(req.url, "http://localhost");
  var ruta = url.pathname;

  if (ruta === "/" || ruta === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("OK");
    return;
  }

  if (ruta === "/api/estado") {
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(estado));
    return;
  }

  if (ruta === "/api/iniciar") {
    var batch = parseInt(url.searchParams.get("batch")) || 20;
    if (!enviando) iniciarEnvio(batch);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (ruta === "/api/detener") {
    detenerSolicitado = true;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (ruta === "/api/enviar-unico" && req.method === "POST") {
    var cuerpo = "";
    req.on("data", function(c) { cuerpo += c; });
    req.on("end", async function() {
      var d = JSON.parse(cuerpo);
      var resJson = { ok: false };
      try {
        if (!transport) {
          var cfg = getSMTPConfig();
          if (!cfg) { resJson.error = "Sin config SMTP"; res.writeHead(200,{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}); res.end(JSON.stringify(resJson)); return; }
          transport = nodemailer.createTransport({ service: "gmail", auth: { user: cfg.user, pass: cfg.pass } });
        }
        await transport.sendMail({
          from: getSMTPConfig().user,
          to: d.email,
          subject: "Contacto " + d.nombre,
          text: d.mensaje
        });
        var env = cargarProgreso();
        env[d.email + d.nombre] = true;
        guardarProgreso(env);
        resJson.ok = true;
      } catch (e) { resJson.error = e.message; }
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify(resJson));
    });
    return;
  }

  if (ruta === "/api/reiniciar") {
    fs.writeFileSync(PROGRESS, "{}");
    estado = { total: 0, enviados: 0, fallos: 0, pendientes: 0, activo: false, actual: "" };
    detenerSolicitado = true;
    enviando = false;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Serve static files
  var filePath = path.join(__dirname, "campanas", ruta === "/" ? "campana_barranquilla.html" : ruta);
  var ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { "Content-Type": MIME[ext] || "text/plain", "Access-Control-Allow-Origin": "*" });
    res.end(data);
  });
});

var PORT = process.env.PORT || 4567;
server.listen(PORT, () => {
  console.log("Servidor en puerto: " + PORT);
  console.log("Api:");
  console.log("  GET /api/estado     — progreso actual");
  console.log("  GET /api/iniciar?batch=N — iniciar envio SMTP");
  console.log("  GET /api/detener    — detener envio");
  console.log("  GET /api/reiniciar  — borrar progreso");
});
