const { Client, LocalAuth } = require("whatsapp-web.js");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "datos");
const SESSION_DIR = path.join(__dirname, "session_big");

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const SKIP_FIRST = 70; // Saltar los primeros 70 ya contactados
const MIN_DELAY = 20;   // segundos minimo entre mensajes
const MAX_DELAY = 45;   // segundos maximo

const args = process.argv.slice(2);
const campFile = args.includes("--campaign") ? args[args.indexOf("--campaign") + 1] : null;
const file = campFile || "enviar_barranquilla.json";

const dataPath = path.join(DATA_DIR, file);
if (!fs.existsSync(dataPath)) {
  console.log("Archivo no encontrado:", dataPath);
  process.exit(1);
}

const todos = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
const conTelefono = todos.filter((n) => n.telefono);

// Saltar primeros 70, tomar hasta 300
const contactos = conTelefono.slice(SKIP_FIRST, SKIP_FIRST + 300);

console.log("=== SCRAPING - ENVIO AUTOMATICO ===");
console.log(`Total en base: ${todos.length}`);
console.log(`Con telefono: ${conTelefono.length}`);
console.log(`Saltando primeros: ${SKIP_FIRST}`);
console.log(`A enviar ahora: ${contactos.length}`);
console.log(`\nRango: #${SKIP_FIRST + 1} a #${SKIP_FIRST + contactos.length}`);

console.log("\n--- PRIMEROS 3 A ENVIAR ---");
contactos.slice(0, 3).forEach((n, i) => {
  console.log(`\n[${i + 1}] ${n.nombre}`);
  console.log(`    Tel: ${n.telefono}`);
  console.log(`    Msj: ${(n.mensaje || "").slice(0, 80)}...`);
});

console.log("\nIniciando Chrome para WhatsApp Web...");
console.log("Escanea el QR cuando aparezca.\n");

function limpiarNumero(raw) {
  let num = raw.replace(/\D/g, "");
  if (num.startsWith("57")) return num;
  if (num.startsWith("0")) num = num.slice(1);
  return "57" + num;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: SESSION_DIR }),
  puppeteer: {
    executablePath: CHROME_PATH,
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  },
  webVersionCache: {
    type: "remote",
    remotePath: "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html",
  },
});

client.on("qr", (qr) => {
  console.log("=== ESCANEA EL QR ===");
  try {
    const qrc = require("qrcode-terminal");
    qrc.generate(qr, { small: true });
  } catch { console.log("QR:", qr); }
});

client.on("authenticated", () => console.log("✓ Autenticado"));
client.on("auth_failure", (m) => console.log("Error auth:", m));

client.on("ready", async () => {
  console.log("\n✓ CONECTADO A WHATSAPP!");
  console.log(`\nEnviando mensajes a ${contactos.length} contactos...`);
  console.log("Los mensajes se enviaran automaticamente.\n");

  let ok = 0, fail = 0, skipped = 0;

  for (let i = 0; i < contactos.length; i++) {
    const n = contactos[i];
    const numero = limpiarNumero(n.telefono);
    const mensaje = n.mensaje;

    if (!numero || numero.length < 12 || !mensaje) {
      console.log(`  [${i + 1}/${contactos.length}] SKIP ${(n.nombre || "").slice(0, 35)} - sin datos`);
      skipped++;
      continue;
    }

    try {
      const chatId = numero + "@c.us";
      await client.sendMessage(chatId, mensaje);
      ok++;
      console.log(`  [${i + 1}/${contactos.length}] ✅ ${n.nombre.slice(0, 35)}`);
    } catch (e) {
      const errMsg = e.message || "";
      // Si error es "No LID", intentar con formato alternativo
      if (errMsg.includes("No LID")) {
        try {
          const chatId2 = numero + "@s.whatsapp.net";
          await client.sendMessage(chatId2, mensaje);
          ok++;
          console.log(`  [${i + 1}/${contactos.length}] ✅ ${n.nombre.slice(0, 35)} (formato alt)`);
        } catch (e2) {
          fail++;
          console.log(`  [${i + 1}/${contactos.length}] ❌ ${n.nombre.slice(0, 35)} - ${e2.message.slice(0, 50)}`);
        }
      } else {
        fail++;
        console.log(`  [${i + 1}/${contactos.length}] ❌ ${n.nombre.slice(0, 35)} - ${errMsg.slice(0, 50)}`);
      }
    }

    if (i < contactos.length - 1) {
      const delay = (MIN_DELAY + Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY))) * 1000;
      console.log(`     ⏱ ${Math.round(delay / 1000)}s...`);
      await sleep(delay);
    }
  }

  const totalProc = ok + fail + skipped;
  console.log(`\n${"=".repeat(50)}`);
  console.log("RESULTADOS FINALES");
  console.log(`${"=".repeat(50)}`);
  console.log(`Enviados: ${ok}`);
  console.log(`Fallados: ${fail}`);
  console.log(`Saltados: ${skipped}`);
  console.log(`Total:    ${totalProc}`);
  console.log(`${"=".repeat(50)}`);

  // Guardar log
  const logPath = path.join(DATA_DIR, `envio_log_${Date.now()}.json`);
  fs.writeFileSync(logPath, JSON.stringify({ ok, fail, skipped, total: totalProc, fecha: new Date().toISOString() }, null, 2));
  console.log(`\nLog guardado: ${logPath}`);
  process.exit(0);
});

client.on("disconnected", (reason) => {
  console.log("Desconectado:", reason);
  process.exit(1);
});

client.initialize();
