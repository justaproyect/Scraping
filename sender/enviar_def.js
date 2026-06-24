const { Client, LocalAuth } = require("whatsapp-web.js");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "datos");
const SESSION_DIR = path.join(__dirname, "session_v2");
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const SKIP_FIRST = 70;

const file = "enviar_barranquilla.json";
const todos = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8"));
const conTelefono = todos.filter((n) => n.telefono);
const contactos = conTelefono.slice(SKIP_FIRST, SKIP_FIRST + 300);

console.log("=== SCRAPING - ENVIO AUTOMATICO ===");
console.log(`Total: ${todos.length}`);
console.log(`A enviar: ${contactos.length} (saltando ${SKIP_FIRST})`);

console.log("\n--- PRIMEROS 5 ---");
contactos.slice(0, 5).forEach((n, i) => console.log(`  ${i+1}. ${n.nombre.slice(0,35)} | ${n.telefono}`));

function limpiarNumero(raw) {
  let num = raw.replace(/\D/g, "");
  if (num.startsWith("57")) num = num.slice(2);
  if (num.startsWith("0")) num = num.slice(1);
  // Solo numeros moviles colombianos: empiezan con 3
  if (!num.startsWith("3")) return "";
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
    args: ["--no-sandbox"],
  },
});

client.on("qr", (qr) => {
  console.log("\n=== ESCANEA EL QR CON TU WHATSAPP ===");
  try {
    const qrc = require("qrcode-terminal");
    qrc.generate(qr, { small: true });
  } catch { console.log("QR code generated"); }
});

client.on("authenticated", () => process.stdout.write("."));
client.on("ready", async () => {
  console.log("\n\n✓ CONECTADO. Enviando mensajes...\n");

  let ok = 0, fail = 0, noReg = 0;

  for (let i = 0; i < contactos.length; i++) {
    const n = contactos[i];
    const num = limpiarNumero(n.telefono);
    const msg = n.mensaje;

    if (!num || num.length < 12) {
      noReg++;
      console.log(`  [${i+1}/${contactos.length}] ⚠ ${n.nombre.slice(0,30)} - numero invalido`);
      continue;
    }

    try {
      // Check if number is registered on WhatsApp
      const isReg = await client.isRegisteredUser(num);
      if (!isReg) {
        noReg++;
        console.log(`  [${i+1}/${contactos.length}] ⚠ ${n.nombre.slice(0,30)} - no es WhatsApp`);
        await sleep(5000);
        continue;
      }

      const chatId = num + "@c.us";
      await client.sendMessage(chatId, msg);
      ok++;
      console.log(`  [${i+1}/${contactos.length}] ✅ ${n.nombre.slice(0,35)}`);

      // Delay: 25-50 segundos
      if (i < contactos.length - 1) {
        const d = 25000 + Math.floor(Math.random() * 25000);
        console.log(`     ⏱ ${Math.round(d/1000)}s...`);
        await sleep(d);
      }
    } catch (e) {
      fail++;
      console.log(`  [${i+1}/${contactos.length}] ❌ ${n.nombre.slice(0,30)} - ${e.message.slice(0,50)}`);
      await sleep(10000);
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log("RESULTADOS");
  console.log(`${"=".repeat(50)}`);
  console.log(`✅ Enviados: ${ok}`);
  console.log(`❌ Fallados: ${fail}`);
  console.log(`⚠ No WhatsApp: ${noReg}`);
  console.log(`${"=".repeat(50)}`);

  const log = { ok, fail, noReg, total: contactos.length, fecha: new Date().toISOString() };
  fs.writeFileSync(path.join(DATA_DIR, "log_envio.json"), JSON.stringify(log, null, 2));
  console.log("\nLog guardado. Puedes cerrar Chrome.");
  process.exit(0);
});

client.on("disconnected", (r) => { console.log("Desconectado:", r); process.exit(1); });

console.log("\nIniciando WhatsApp Web...");
client.initialize();
