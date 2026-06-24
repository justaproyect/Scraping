const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

const DATA = path.join(__dirname, "datos", "enviar_barranquilla.json");
const PROGRESS = path.join(__dirname, ".gmail_progress.json");
const CONFIG = path.join(__dirname, "datos", "smtp_config.json");

async function main() {
  const negocios = JSON.parse(fs.readFileSync(DATA, "utf-8"));
  const conEmail = negocios.filter(n => n.email && /@/.test(n.email));
  console.log(`Total: ${negocios.length} | Con email: ${conEmail.length} | Sin email: ${negocios.length - conEmail.length}\n`);

  // Load or create config
  let cfg = { delay: 5, batch: conEmail.length };
  if (fs.existsSync(CONFIG)) {
    cfg = Object.assign(cfg, JSON.parse(fs.readFileSync(CONFIG, "utf-8")));
    console.log(`Config: ${cfg.user}`);
  }
  // Override from CLI args: node script.js email pass [delay] [batch]
  if (process.argv[2]) cfg.user = process.argv[2];
  if (process.argv[3]) cfg.pass = process.argv[3];
  if (process.argv[4]) cfg.delay = parseInt(process.argv[4]) || 5;
  if (process.argv[5]) cfg.batch = parseInt(process.argv[5]) || conEmail.length;

  if (!cfg.user || !cfg.pass) {
    console.log("Configura primero: crea datos/smtp_config.json con:");
    console.log('{"user":"tu@gmail.com","pass":"tu-app-password","delay":5}');
    console.log("O pasalo como argumentos:");
    console.log("node enviar_gmail.js tu@gmail.com tupassword [delay] [batch]");
    process.exit(1);
  }

  // Save config for next time
  fs.writeFileSync(CONFIG, JSON.stringify({ user: cfg.user, pass: cfg.pass, delay: cfg.delay }, null, 2));

  const transport = nodemailer.createTransport({
    service: "gmail",
    auth: { user: cfg.user, pass: cfg.pass }
  });

  // Verify connection
  try {
    await transport.verify();
    console.log("Conexion SMTP OK\n");
  } catch (e) {
    console.log("Error de conexion:", e.message);
    process.exit(1);
  }

  // Load progress
  let enviados = {};
  if (fs.existsSync(PROGRESS)) enviados = JSON.parse(fs.readFileSync(PROGRESS, "utf-8"));

  const pendientes = conEmail.filter(n => !enviados[n.email + n.nombre]);
  console.log(`Pendientes: ${pendientes.length} de ${conEmail.length}`);

  if (pendientes.length === 0) { console.log("Completado!"); process.exit(0); }

  var lote = Math.min(cfg.batch, pendientes.length);
  var ok = 0, fail = 0;

  for (var i = 0; i < lote; i++) {
    var n = pendientes[i];
    var key = n.email + n.nombre;
    try {
      await transport.sendMail({
        from: cfg.user,
        to: n.email,
        subject: "Contacto " + n.nombre,
        text: n.mensaje || "Hola, " + n.nombre + "!"
      });
      enviados[key] = true;
      fs.writeFileSync(PROGRESS, JSON.stringify(enviados));
      ok++;
      console.log(`[${i+1}/${lote}] OK: ${n.email} — ${n.nombre}`);
    } catch (e) {
      fail++;
      console.log(`[${i+1}/${lote}] FAIL: ${n.email} — ${e.message}`);
    }
    if (i < lote - 1) await new Promise(r => setTimeout(r, cfg.delay * 1000));
  }

  console.log(`\nLote: ${ok} enviados, ${fail} fallos`);
  if (ok > 0) console.log("Para continuar, ejecuta de nuevo el mismo comando");
}

main();
