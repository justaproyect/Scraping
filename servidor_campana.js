const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const nodemailer = require("nodemailer");

const DATA = path.join(__dirname, "datos", "enviar_barranquilla.json");
const PROGRESS = path.join(__dirname, ".gmail_progress.json");
const SMTP_CFG = path.join(__dirname, "datos", "smtp_config.json");
const CONFIG_PATH = path.join(__dirname, "datos", "config.json");
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

function getSMTPConfig() {
  if (process.env.SMTP_USER && process.env.SMTP_PASS)
    return { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS };
  if (fs.existsSync(SMTP_CFG)) return JSON.parse(fs.readFileSync(SMTP_CFG, "utf-8"));
  return null;
}

function getSendGridKey() {
  if (process.env.SENDGRID_API_KEY) return process.env.SENDGRID_API_KEY;
  try { var c = JSON.parse(fs.readFileSync(SMTP_CFG, "utf-8")); if (c.sendgrid) return c.sendgrid; } catch(e) {}
  return null;
}

function sendViaSendGrid(to, subject, text) {
  return new Promise(function(resolve, reject) {
    var key = getSendGridKey();
    if (!key) return reject(new Error("No SendGrid key"));
    var data = JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: process.env.SMTP_USER || "justaproyect7@gmail.com" },
      subject: subject,
      content: [{ type: "text/plain", value: text }]
    });
    var opts = {
      hostname: "api.sendgrid.com",
      path: "/v3/mail/send",
      method: "POST",
      headers: {
        "Authorization": "Bearer " + key,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data)
      },
      timeout: 15000
    };
    var req = https.request(opts, function(res) {
      var body = "";
      res.on("data", function(c) { body += c; });
      res.on("end", function() {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve();
        else reject(new Error("SendGrid error " + res.statusCode + ": " + body.slice(0, 200)));
      });
    });
    req.on("error", reject);
    req.on("timeout", function() { req.destroy(); reject(new Error("SendGrid timeout")); });
    req.write(data);
    req.end();
  });
}

async function enviarEmail(to, nombre, mensaje) {
  var subject = "Contacto " + nombre;
  var text = mensaje || "Hola, " + nombre + "!";
  var sgKey = getSendGridKey();
  if (sgKey) return sendViaSendGrid(to, subject, text);
  if (!transport) {
    var cfg = getSMTPConfig();
    if (!cfg) throw new Error("Sin config de email (SendGrid o SMTP)");
    transport = nodemailer.createTransport({
      host: "smtp.gmail.com", port: 587, secure: false, requireTLS: true,
      auth: { user: cfg.user, pass: cfg.pass },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000
    });
  }
  await transport.sendMail({ from: getSMTPConfig().user, to: to, subject: subject, text: text });
}

async function iniciarEnvio(batchSize) {
  if (enviando) return;
  if (!getSendGridKey() && !getSMTPConfig()) {
    estado.error = "Config de email no encontrada";
    return;
  }
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
      await enviarEmail(n.email, n.nombre, n.mensaje);
      enviados[key] = true;
      guardarProgreso(enviados);
      estado.enviados++;
    } catch (e) {
      estado.fallos++;
    }
    estado.pendientes = pendientes.length - i - 1;
    if (i < lote - 1 && !detenerSolicitado) await new Promise(r => setTimeout(r, 5000));
  }
  enviando = false;
  estado.activo = false;
  estado.actual = detenerSolicitado ? "Detenido" : "Completado";
}

const server = http.createServer((req, res) => {
  var url = new URL(req.url, "http://localhost");
  var ruta = url.pathname;

  if (ruta === "/health") { res.writeHead(200, { "Content-Type": "text/plain" }); res.end("OK"); return; }

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
        await enviarEmail(d.email, d.nombre, d.mensaje);
        transport = null;
        var env = cargarProgreso();
        env[d.email + d.nombre] = true;
        guardarProgreso(env);
        resJson.ok = true;
      } catch (e) { resJson.error = e.message; transport = null; }
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify(resJson));
    });
    return;
  }

  if (ruta === "/api/smtp-config" && req.method === "GET") {
    var cfg = getSMTPConfig();
    var sgKey = getSendGridKey();
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({
      user: cfg ? cfg.user : "",
      configured: !!(cfg || sgKey),
      sendgrid: !!sgKey
    }));
    return;
  }

  if (ruta === "/api/smtp-config" && req.method === "POST") {
    var cuerpo = "";
    req.on("data", function(c) { cuerpo += c; });
    req.on("end", function() {
      try {
        var d = JSON.parse(cuerpo);
        var obj = {};
        if (fs.existsSync(SMTP_CFG)) obj = JSON.parse(fs.readFileSync(SMTP_CFG, "utf-8"));
        if (d.user || d.pass) { obj.user = d.user || ""; obj.pass = d.pass || ""; }
        if (d.sendgrid !== undefined) obj.sendgrid = d.sendgrid || "";
        fs.writeFileSync(SMTP_CFG, JSON.stringify(obj));
        transport = null;
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
  var sgOk = getSendGridKey() ? "SI" : "NO";
  var smtpOk = getSMTPConfig() ? "SI" : "NO";
  console.log("SendGrid: " + sgOk + " | SMTP: " + smtpOk);
  console.log("Api:");
  console.log("  GET /api/estado            — progreso actual");
  console.log("  GET /api/iniciar?batch=N   — iniciar envio batch");
  console.log("  GET /api/detener           — detener envio");
  console.log("  GET /api/reiniciar         — borrar progreso");
  console.log("  GET/POST /api/config       — leer/cambiar objetivo");
  console.log("  GET/POST /api/smtp-config  — leer/configurar credenciales");
});
