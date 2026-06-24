const http = require("http");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const nodemailer = require("nodemailer");

const DATA = path.join(__dirname, "datos", "enviar_barranquilla.json");
const PROGRESS = path.join(__dirname, ".gmail_progress.json");
const CONFIG = path.join(__dirname, "datos", "smtp_config.json");
const CONFIG_PATH = path.join(__dirname, "datos", "config.json");

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

  transport = nodemailer.createTransport({ service: "gmail", auth: { user: cfg.user, pass: cfg.pass }, connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 12000 });
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

  if (ruta === "/health") {
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
          transport = nodemailer.createTransport({ service: "gmail", auth: { user: cfg.user, pass: cfg.pass }, connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 12000 });
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

  if (ruta === "/api/smtp-config" && req.method === "GET") {
    var cfg = getSMTPConfig();
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ user: cfg ? cfg.user : "", configured: !!cfg }));
    return;
  }

  if (ruta === "/api/smtp-config" && req.method === "POST") {
    var cuerpo = "";
    req.on("data", function(c) { cuerpo += c; });
    req.on("end", function() {
      try {
        var d = JSON.parse(cuerpo);
        if (d.pass && d.pass.length > 3) {
          fs.writeFileSync(CONFIG, JSON.stringify({ user: d.user || "", pass: d.pass }));
          transport = null;
        }
      } catch(e) {}
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ ok: true }));
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

  if (ruta === "/api/config" && req.method === "GET") {
    var cfg = { objetivo: "", error: null };
    try { Object.assign(cfg, JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"))); } catch (e) { cfg.error = e.message; }
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(cfg));
    return;
  }

  if (ruta === "/api/config" && req.method === "POST") {
    var cuerpo = "";
    req.on("data", function(c) { cuerpo += c; });
    req.on("end", function() {
      var result = { ok: false, error: null };
      try {
        var nuevo = JSON.parse(cuerpo);
        var actual = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
        Object.assign(actual, nuevo);
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(actual, null, 2));
        execSync("node regenerar_mensajes.js", { cwd: __dirname, timeout: 60000, stdio: "pipe" });
        execSync("node generar_campana.js", { cwd: __dirname, timeout: 60000, stdio: "pipe" });
        result.ok = true;
      } catch (e) { result.error = e.message; }
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify(result));
    });
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
  var smtpOk = getSMTPConfig() ? "SI" : "NO";
  console.log("Config SMTP: " + smtpOk);
  console.log("Api:");
  console.log("  GET /api/estado          — progreso actual");
  console.log("  GET /api/iniciar?batch=N — iniciar envio SMTP");
  console.log("  GET /api/detener         — detener envio");
  console.log("  GET /api/reiniciar       — borrar progreso");
  console.log("  GET/POST /api/config     — leer/cambiar objetivo de campana");
  console.log("  GET/POST /api/smtp-config— leer/configurar credenciales SMTP");
});
