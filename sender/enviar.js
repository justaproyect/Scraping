const { makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const DATA_DIR = path.join(__dirname, "..", "datos");
const SESSION_DIR = path.join(__dirname, "session");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function ask(q) {
  return new Promise((r) => rl.question(q, r));
}

// QR printer sin dependencia externa
function printQR(qr) {
  try {
    const qrcode = require("qrcode-terminal");
    qrcode.generate(qr, { small: true });
  } catch {
    console.log("\nEscanea este codigo QR con tu WhatsApp:");
    console.log(qr);
    console.log("\n(Instala 'npm install qrcode-terminal' para ver el QR grafico)");
  }
}

function limpiarNumero(raw) {
  let num = raw.replace(/\D/g, "");
  if (num.startsWith("57")) num = num.slice(2);
  if (num.startsWith("0")) num = num.slice(1);
  // Col: 57 + 10 digits
  return "57" + num;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const args = process.argv.slice(2);
  const autoCampaign = args.includes("--campaign") ? args[args.indexOf("--campaign") + 1] : null;
  const autoConfirm = args.includes("--confirm");

  console.log("=== SCRAPING - WhatsApp Sender ===\n");

  const files = fs.readdirSync(DATA_DIR).filter((f) => f.startsWith("enviar_") && f.endsWith(".json"));
  if (files.length === 0) {
    console.log("No hay archivos de campana. Ejecuta primero: python 1_buscar.py && python 2_analizar.py");
    process.exit(1);
  }

  let campana;
  if (autoCampaign && files.includes(autoCampaign)) {
    campana = autoCampaign;
    console.log(`Campana: ${campana}`);
  } else {
    console.log("Campanas disponibles:");
    files.forEach((f, i) => console.log(`  [${i + 1}] ${f}`));
    const idx = parseInt(await ask("\nSelecciona campana: ")) - 1;
    if (idx < 0 || idx >= files.length) { console.log("Invalido"); process.exit(1); }
    campana = files[idx];
  }

  const negocios = JSON.parse(fs.readFileSync(path.join(DATA_DIR, campana), "utf-8"));

  const conTelefono = negocios.filter((n) => n.telefono);
  const sinTelefono = negocios.filter((n) => !n.telefono);

  console.log(`\nTotal: ${negocios.length}`);
  console.log(`Con telefono: ${conTelefono.length}`);
  console.log(`Sin telefono: ${sinTelefono.length}`);

  // Show preview
  console.log("\n--- VISTA PREVIA (primeros 5) ---");
  conTelefono.slice(0, 5).forEach((n, i) => {
    console.log(`\n[${i + 1}] ${n.nombre}`);
    console.log(`    Tel: ${n.telefono}`);
    console.log(`    Servicios: ${n.servicios_recomendados?.join(", ") || "N/A"}`);
    console.log(`    Mensaje: ${n.mensaje || "Sin mensaje"}`);
  });

  if (!autoConfirm) {
    const confirm = await ask(`\nEnviar mensajes a ${conTelefono.length} contactos? (si/no): `);
    if (confirm.toLowerCase() !== "si") {
      console.log("Cancelado");
      process.exit(0);
    }
  }

  // Borrar session previa si existe para forzar QR nuevo
  if (fs.existsSync(SESSION_DIR)) {
    fs.rmSync(SESSION_DIR, { recursive: true, force: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const sock = makeWASocket({
    auth: state,
    browser: Browsers.macOS("Scraping"),
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  let qrEmitido = false;

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && !qrEmitido) {
      qrEmitido = true;
      console.clear();
      console.log("=== ESCANEA EL QR CON TU WHATSAPP ===\n");
      console.log("Abre WhatsApp > Dispositivos vinculados > Vincular dispositivo");
      console.log("Escanea este codigo:\n");
      printQR(qr);
      console.log("\nEsperando escaneo...");
    }

    if (connection === "open") {
      console.log("\n✓ Conectado a WhatsApp!");
      await enviarMensajes(sock, conTelefono);
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode === DisconnectReason.loggedOut) {
        console.log("Sesion cerrada desde el telefono. Vuelve a intentar.");
        process.exit(1);
      }
      console.log("Reconectando en 3s...");
      await sleep(3000);
      main();
    }
  });

  sock.ev.on("creds.update", saveCreds);
}

async function enviarMensajes(sock, contactos) {
  console.log(`\nEnviando a ${contactos.length} contactos...`);
  let ok = 0, fail = 0, skipped = 0;

  for (let i = 0; i < contactos.length; i++) {
    const n = contactos[i];
    const numero = limpiarNumero(n.telefono);
    const mensaje = n.mensaje;

    if (!numero || numero.length < 12 || !mensaje) {
      console.log(`  [${i + 1}/${contactos.length}] SKIP ${n.nombre.slice(0, 30)} - sin numero o mensaje`);
      skipped++;
      continue;
    }

    try {
      const jid = numero + "@s.whatsapp.net";
      await sock.sendMessage(jid, { text: mensaje });
      ok++;
      console.log(`  [${i + 1}/${contactos.length}] OK  ${n.nombre.slice(0, 30)}`);
    } catch (e) {
      fail++;
      console.log(`  [${i + 1}/${contactos.length}] ERR ${n.nombre.slice(0, 30)} - ${e.message}`);
    }

    // Delay aleatorio entre mensajes (30-90 segundos)
    if (i < contactos.length - 1) {
      const delay = 30000 + Math.floor(Math.random() * 60000);
      console.log(`     Esperando ${Math.round(delay / 1000)}s...`);
      await sleep(delay);
    }
  }

  console.log(`\n=== RESULTADOS ===`);
  console.log(`Enviados: ${ok} | Fallados: ${fail} | Saltados: ${skipped}`);
  console.log(`Total procesados: ${contactos.length}`);
  process.exit(0);
}

main().catch(console.error);
