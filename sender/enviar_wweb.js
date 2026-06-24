const { Client, LocalAuth } = require("whatsapp-web.js");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "datos");
const SESSION_DIR = path.join(__dirname, "session_wweb");

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const args = process.argv.slice(2);
const autoCampaign = args.includes("--campaign") ? args[args.indexOf("--campaign") + 1] : null;
const autoConfirm = args.includes("--confirm");

const files = fs.readdirSync(DATA_DIR).filter((f) => f.startsWith("enviar_") && f.endsWith(".json"));
if (files.length === 0) {
  console.log("No hay campanas. Ejecuta: python 1_buscar.py && python 2_analizar.py");
  process.exit(1);
}

let campana;
if (autoCampaign && files.includes(autoCampaign)) {
  campana = autoCampaign;
  console.log(`Campana: ${campana}`);
} else {
  console.log("Campanas disponibles:");
  files.forEach((f, i) => console.log(`  [${i + 1}] ${f}`));
  process.exit(0);
}

const negocios = JSON.parse(fs.readFileSync(path.join(DATA_DIR, campana), "utf-8"));
const conTelefono = negocios.filter((n) => n.telefono);

console.log(`Total: ${negocios.length} | Con telefono: ${conTelefono.length}`);

// Vista previa
console.log("\n--- VISTA PREVIA ---");
conTelefono.slice(0, 3).forEach((n) => {
  console.log(`\n${n.nombre}`);
  console.log(`  Tel: ${n.telefono}`);
  console.log(`  Msj: ${n.mensaje?.slice(0, 80)}`);
});

if (!autoConfirm) {
  console.log("\nUsa --confirm para enviar automaticamente.");
  console.log("O usa la pagina HTML en /campanas/ para envio manual.");
  process.exit(0);
}

function limpiarNumero(raw) {
  let num = raw.replace(/\D/g, "");
  if (num.startsWith("57")) return num;
  if (num.startsWith("0")) num = num.slice(1);
  return "57" + num;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

console.log("\nIniciando Chrome...");
console.log("Escanea el QR de WhatsApp Web cuando aparezca.\n");

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: SESSION_DIR }),
  puppeteer: {
    executablePath: CHROME_PATH,
    headless: false,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  },
  takeoverOnConflict: true,
});

client.on("qr", (qr) => {
  console.log("=== QR RECIBIDO ===");
  console.log("Escanea con WhatsApp > Dispositivos vinculados");
  try {
    const qrcode = require("qrcode-terminal");
    qrcode.generate(qr, { small: true });
  } catch {
    console.log("RAW QR:", qr);
  }
});

client.on("ready", async () => {
  console.log("\n✓ Conectado a WhatsApp!");
  console.log(`\nEnviando ${conTelefono.length} mensajes...`);
  let ok = 0, fail = 0, skipped = 0;

  for (let i = 0; i < conTelefono.length; i++) {
    const n = conTelefono[i];
    const numero = limpiarNumero(n.telefono);
    const mensaje = n.mensaje;

    if (!numero || numero.length < 12 || !mensaje) {
      console.log(`  [${i + 1}/${conTelefono.length}] SKIP ${(n.nombre || "").slice(0, 30)}`);
      skipped++;
      continue;
    }

    try {
      const jid = numero + "@c.us";
      await client.sendMessage(jid, mensaje);
      ok++;
      console.log(`  [${i + 1}/${conTelefono.length}] OK  ${n.nombre.slice(0, 30)}`);
    } catch (e) {
      fail++;
      console.log(`  [${i + 1}/${conTelefono.length}] ERR ${(n.nombre || "").slice(0, 30)} - ${e.message}`);
    }

    if (i < conTelefono.length - 1) {
      const delay = 15000 + Math.floor(Math.random() * 30000);
      console.log(`     Esperando ${Math.round(delay / 1000)}s...`);
      await sleep(delay);
    }
  }

  console.log(`\n=== RESULTADOS ===`);
  console.log(`Enviados: ${ok} | Fallados: ${fail} | Saltados: ${skipped}`);
  process.exit(0);
});

client.on("disconnected", (reason) => {
  console.log("Desconectado:", reason);
  process.exit(1);
});

client.initialize();
