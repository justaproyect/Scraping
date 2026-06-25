const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const nodemailer = require("nodemailer");

const DATA = path.join(__dirname, "datos", "enviar_barranquilla.json");
const PROGRESS = path.join(__dirname, ".gmail_progress.json");
const DAILY = path.join(__dirname, ".daily_smtp.json");
const SMTP_CFG = path.join(__dirname, "datos", "smtp_config.json");
const CONFIG_PATH = path.join(__dirname, "datos", "config.json");
const HTML_FILE = path.join(__dirname, "campanas", "campana_barranquilla.html");
const MIME = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript", ".json": "application/json" };

let estado = { total: 0, enviados: 0, fallos: 0, pendientes: 0, activo: false, actual: "" };
let transport = null;
let enviando = false;
let detenerSolicitado = false;
let accountIndex = 0;

function cargarProgreso() {
  if (!fs.existsSync(PROGRESS)) return {};
  return JSON.parse(fs.readFileSync(PROGRESS, "utf-8"));
}
function guardarProgreso(d) {
  fs.writeFileSync(PROGRESS, JSON.stringify(d));
}
function cargarDaily() {
  if (!fs.existsSync(DAILY)) return {};
  return JSON.parse(fs.readFileSync(DAILY, "utf-8"));
}
function guardarDaily(d) {
  fs.writeFileSync(DAILY, JSON.stringify(d));
}

function getAccounts() {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    return [{ user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }];
  }
  if (fs.existsSync(SMTP_CFG)) {
    var c = JSON.parse(fs.readFileSync(SMTP_CFG, "utf-8"));
    if (c.accounts && c.accounts.length > 0) return c.accounts;
    if (c.user && c.pass) return [{ user: c.user, pass: c.pass }];
  }
  return [];
}

function getConfig() {
  var cfg = { delay: 8, daily_limit: 490 };
  try {
    var c = JSON.parse(fs.readFileSync(SMTP_CFG, "utf-8"));
    if (c.delay) cfg.delay = c.delay;
    if (c.daily_limit) cfg.daily_limit = c.daily_limit;
  } catch(e) {}
  return cfg;
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

function nextAccount() {
  var accounts = getAccounts();
  accountIndex = (accountIndex + 1) % accounts.length;
  transport = null;
  var cfg = getConfig();
  if (accountIndex === 0) {
    var daily = cargarDaily();
    var today = new Date().toISOString().slice(0, 10);
    if (daily.date !== today) {
      daily = { date: today, counts: {} };
      guardarDaily(daily);
    }
  }
}

function canSend() {
  var cfg = getConfig();
  var accounts = getAccounts();
  if (accounts.length === 0) return { ok: false, error: "Sin cuentas SMTP" };
  var daily = cargarDaily();
  var today = new Date().toISOString().slice(0, 10);
  if (daily.date !== today) {
    daily = { date: today, counts: {} };
    guardarDaily(daily);
  }
  for (var i = 0; i < accounts.length; i++) {
    var count = daily.counts[i] || 0;
    if (count < cfg.daily_limit) return { ok: true, index: i };
  }
  return { ok: false, error: "Limite diario alcanzado en todas las cuentas (" + cfg.daily_limit + "/cuenta)" };
}

function createTransportForAccount(idx) {
  var accounts = getAccounts();
  var a = accounts[idx];
  return nodemailer.createTransport({
    host: "smtp.gmail.com", port: 587, secure: false, requireTLS: true,
    auth: { user: a.user, pass: a.pass },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000
  });
}

async function enviarEmail(to, nombre, mensaje) {
  var subject = "Contacto " + nombre;
  var text = mensaje || "Hola, " + nombre + "!";
  var sgKey = getSendGridKey();
  if (sgKey) return sendViaSendGrid(to, subject, text);
  var check = canSend();
  if (!check.ok) throw new Error(check.error);
  var idx = check.index;
  if (!transport || accountIndex !== idx) {
    transport = createTransportForAccount(idx);
    accountIndex = idx;
  }
  await transport.sendMail({
    from: getAccounts()[idx].user,
    to: to,
    subject: subject,
    text: text
  });
  var daily = cargarDaily();
  var today = new Date().toISOString().slice(0, 10);
  if (daily.date !== today) daily = { date: today, counts: {} };
  daily.counts[idx] = (daily.counts[idx] || 0) + 1;
  guardarDaily(daily);
}

async function iniciarEnvio(batchSize) {
  if (enviando) return;
  var accounts = getAccounts();
  if (accounts.length === 0) { estado.error = "Sin cuentas SMTP configuradas"; return; }
  var sgKey = getSendGridKey();
  if (!sgKey) {
    var check = canSend();
    if (!check.ok) { estado.error = check.error; return; }
  }
  var negocios = JSON.parse(fs.readFileSync(DATA, "utf-8")).filter(n => n.email && /@/.test(n.email));
  var enviados = cargarProgreso();
  var pendientes = negocios.filter(n => !enviados[n.email + n.nombre]);
  if (pendientes.length === 0) { estado.error = "Todos enviados. Usa /api/reiniciar para resetear"; return; }
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
      if (e.message.includes("Limite diario")) {
        estado.error = "Limite diario alcanzado. Continua mañana o agrega mas cuentas";
        break;
      }
    }
    estado.pendientes = pendientes.length - i - 1;
    if (i < lote - 1 && !detenerSolicitado) {
      var cfg = getConfig();
      await new Promise(r => setTimeout(r, cfg.delay * 1000));
    }
  }
  enviando = false;
  estado.activo = false;
  estado.actual = detenerSolicitado ? "Detenido" : "Completado (" + estado.enviados + " enviados, " + estado.fallos + " fallos)";
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
    var batch = parseInt(url.searchParams.get("batch")) || 0;
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
        var env = cargarProgreso();
        env[d.email + d.nombre] = true;
        guardarProgreso(env);
        resJson.ok = true;
      } catch (e) { resJson.error = e.message; }
      transport = null;
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify(resJson));
    });
    return;
  }

  if (ruta === "/api/smtp-config" && req.method === "GET") {
    var accounts = getAccounts();
    var cfg = getConfig();
    var sgKey = getSendGridKey();
    var daily = cargarDaily();
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({
      accounts: accounts.map(function(a) { return { user: a.user, pass: a.pass ? "***" : "" }; }),
      count: accounts.length,
      delay: cfg.delay,
      daily_limit: cfg.daily_limit,
      sendgrid: !!sgKey,
      today: daily.counts ? Object.values(daily.counts).reduce(function(a,b){return a+b},0) : 0
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
        if (d.accounts) { obj.accounts = d.accounts; delete obj.user; delete obj.pass; }
        if (d.delay) obj.delay = parseInt(d.delay);
        if (d.daily_limit) obj.daily_limit = parseInt(d.daily_limit);
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
  var accounts = getAccounts();
  console.log("Servidor en puerto: " + PORT);
  console.log("Cuentas SMTP: " + accounts.length);
  accounts.forEach(function(a, i) { console.log("  [" + i + "] " + a.user); });
  console.log("SendGrid: " + (getSendGridKey() ? "SI" : "NO"));
  console.log("");
  console.log("Endpoints:");
  console.log("  GET  /api/estado            — progreso actual");
  console.log("  GET  /api/iniciar?batch=N   — iniciar envio batch (N=0 para todos)");
  console.log("  GET  /api/detener           — detener envio");
  console.log("  GET  /api/reiniciar         — borrar progreso");
  console.log("  POST /api/enviar-unico      — enviar 1 email");
  console.log("  GET  /api/config            — leer config campaña");
  console.log("  POST /api/config            — guardar config campaña");
  console.log("  GET  /api/smtp-config       — leer config SMTP");
  console.log("  POST /api/smtp-config       — guardar config SMTP");
});
