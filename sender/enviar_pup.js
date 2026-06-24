const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "datos");
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA_DIR = path.join(__dirname, "chrome_data");
const SKIP_FIRST = 70;
const MIN_DELAY_SEC = 25;
const MAX_DELAY_SEC = 50;

const file = "enviar_barranquilla.json";
const todos = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8"));
const conTelefono = todos.filter((n) => n.telefono);
const contactos = conTelefono.slice(SKIP_FIRST, SKIP_FIRST + 300);

console.log("=== SCRAPING - ENVIO AUTOMATICO V2 (PUPPETEER) ===");
console.log(`A enviar: ${contactos.length} (saltando primeros ${SKIP_FIRST})`);

function limpiarNumero(raw) {
  let num = raw.replace(/\D/g, "");
  if (num.startsWith("57")) return num;
  if (num.startsWith("0")) num = num.slice(1);
  return "57" + num;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    userDataDir: USER_DATA_DIR,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-notifications",
    ],
  });

  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.7680.31 Safari/537.36");

  console.log("Abriendo WhatsApp Web...");
  await page.goto("https://web.whatsapp.com", { waitUntil: "domcontentloaded", timeout: 60000 });

  // Esperar a que cargue el QR o ya este logueado
  console.log("Esperando autenticacion...");
  try {
    await page.waitForSelector('canvas[aria-label]', { timeout: 5000 });
    console.log("QR detectado. Escanea con tu WhatsApp.");
    console.log("Esperando escaneo...");
  } catch {}

  // Esperar hasta que aparezca el panel de chats (logueado)
  await page.waitForFunction(() => {
    return document.querySelector('div[role="textbox"]') || document.querySelector('div[tabindex="-1"] div[contenteditable="true"]');
  }, { timeout: 120000 });
  console.log("✓ Autenticado en WhatsApp Web!");

  // Pequeña pausa extra para que cargue todo
  await sleep(3000);

  let ok = 0, fail = 0, skipped = 0;

  for (let i = 0; i < contactos.length; i++) {
    const n = contactos[i];
    const numero = limpiarNumero(n.telefono);
    const mensaje = n.mensaje;

    if (!numero || numero.length < 12 || !mensaje) {
      console.log(`  [${i + 1}/${contactos.length}] SKIP ${(n.nombre || "").slice(0, 35)}`);
      skipped++;
      continue;
    }

    try {
      // Buscar el chat usando el cuadro de busqueda
      const searchBox = await page.waitForFunction(() => {
        const el = document.querySelector('div[contenteditable="true"][tabindex="-1"]');
        if (el) return el;
        return document.querySelector('div[role="textbox"]');
      }, { timeout: 5000 });
      
      const sb = await searchBox;
      await sb.click({ delay: 200 });
      await sb.evaluate(el => el.textContent = "");
      await sb.type(numero, { delay: 50 });

      // Esperar resultados de busqueda
      await sleep(2000);

      // Clic en el primer resultado de busqueda
      const chatResult = await page.waitForFunction(() => {
        const items = document.querySelectorAll('div[role="listitem"]');
        for (const item of items) {
          if (item.textContent.includes("57") || item.textContent.match(/3\d{9}/)) {
            return item;
          }
        }
        return null;
      }, { timeout: 8000 }).catch(() => null);

      if (!chatResult) {
        throw new Error("No se encontro el contacto en la busqueda");
      }

      const cr = await chatResult;
      await cr.click({ delay: 300 });
      await sleep(2000);

      // Escribir y enviar mensaje
      const msgBox = await page.waitForFunction(() => {
        // El area de texto activo donde se escribe el mensaje
        const divs = document.querySelectorAll('div[contenteditable="true"]');
        for (const d of divs) {
          if (d.parentElement?.getAttribute("role") === "textbox" || d.closest('footer')) {
            return d;
          }
        }
        return null;
      }, { timeout: 5000 });

      if (!msgBox) {
        throw new Error("No se encontro el cuadro de mensaje");
      }

      const mb = await msgBox;
      await mb.click({ delay: 100 });
      await mb.type(mensaje, { delay: 15 });
      await sleep(800);

      // Presionar Enter para enviar
      await page.keyboard.press("Enter");
      await sleep(1500);

      ok++;
      console.log(`  [${i + 1}/${contactos.length}] ✅ ${n.nombre.slice(0, 35)}`);
    } catch (e) {
      fail++;
      console.log(`  [${i + 1}/${contactos.length}] ❌ ${n.nombre.slice(0, 35)} - ${e.message.slice(0, 60)}`);
    }

    if (i < contactos.length - 1) {
      const delay = (MIN_DELAY_SEC + Math.floor(Math.random() * (MAX_DELAY_SEC - MIN_DELAY_SEC))) * 1000;
      console.log(`     ⏱ ${Math.round(delay / 1000)}s...`);
      await sleep(delay);
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log("RESULTADOS");
  console.log(`Enviados: ${ok} | Fallados: ${fail} | Saltados: ${skipped}`);
  console.log(`${"=".repeat(50)}`);
  await browser.close();
}

main().catch(console.error);
