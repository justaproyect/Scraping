const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "datos");
const USER_DATA = path.join(__dirname, "pup_session");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const SKIP = 70;
const MAX = 300;
const MIN_WAIT = 25;
const MAX_WAIT = 50;

const file = "enviar_barranquilla.json";
const todos = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8"));
const conTel = todos.filter((n) => n.telefono);
const contactos = conTel.slice(SKIP, SKIP + MAX);

function cleanNum(raw) {
  let n = raw.replace(/\D/g, "");
  if (n.startsWith("57")) n = n.slice(2);
  if (n.startsWith("0")) n = n.slice(1);
  return n.startsWith("3") ? "57" + n : "";
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function randDelay() { return (MIN_WAIT + Math.random() * (MAX_WAIT - MIN_WAIT)) * 1000; }

(async () => {
  console.log(">>> SCRAPING - ENVIO 100% AUTOMATICO <<<");
  console.log(`A enviar: ${contactos.length} (saltando ${SKIP})`);

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: false,
    userDataDir: USER_DATA,
    args: ["--no-sandbox", "--disable-notifications"],
  });

  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36");
  await page.goto("https://web.whatsapp.com", { waitUntil: "domcontentloaded" });

  console.log("\nEsperando autenticacion...");
  console.log("Si ves un QR, escanealo con tu WhatsApp.");

  // Esperar a que aparezca el panel de busqueda (logueado)
  try {
    await page.waitForSelector('div[contenteditable="true"][tabindex="-1"]', { timeout: 120000 });
  } catch {
    // Fallback: buscar cualquier contenteditable
    await page.waitForFunction(() => {
      return document.querySelectorAll('div[contenteditable="true"]').length >= 2;
    }, { timeout: 120000 });
  }

  console.log("✓ Autenticado. Iniciando envios...\n");
  await sleep(3000);

  let ok = 0, fail = 0, skipCount = 0;

  for (let i = 0; i < contactos.length; i++) {
    const n = contactos[i];
    const num = cleanNum(n.telefono);
    const msg = n.mensaje;

    if (!num) {
      skipCount++;
      console.log(`  [${i+1}/${contactos.length}] ⚠ ${(n.nombre||"").slice(0,30)} - fijo /no valido`);
      continue;
    }

    try {
      // 1. Buscar el numero
      const searchBox = await page.waitForFunction(() => {
        const el = document.querySelector('div[contenteditable="true"][tabindex="-1"]');
        if (el && el.isConnected) return el;
        // fallback
        const all = document.querySelectorAll('div[contenteditable="true"]');
        for (const d of all) {
          if (d.closest('header') || d.closest('div[role="search"]')) return d;
        }
        return null;
      }, { timeout: 5000 });

      await searchBox.click({ delay: 100 });
      await searchBox.evaluate(el => el.textContent = "");
      await sleep(300);
      await searchBox.type(num, { delay: 40 });
      await sleep(2000);

      // 2. Clic en el contacto (primer resultado)
      const result = await page.waitForFunction(() => {
        const items = document.querySelectorAll('div[role="listitem"]');
        for (const item of items) {
          if (item.querySelector('span[title]')) return item;
        }
        return null;
      }, { timeout: 8000 });

      if (!result) throw new Error("No se encontro el contacto");

      const rect = await result.evaluate(el => {
        el.scrollIntoView();
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width/2, y: r.y + r.height/2 };
      });
      await page.mouse.click(rect.x, rect.y, { delay: 100 });
      await sleep(2000);

      // 3. Escribir mensaje
      const msgArea = await page.waitForFunction(() => {
        const divs = document.querySelectorAll('div[contenteditable="true"]');
        for (const d of divs) {
          if (d.closest('footer')) return d;
        }
        return null;
      }, { timeout: 5000 });

      if (!msgArea) throw new Error("No se encontro area de mensaje");

      await msgArea.click({ delay: 100 });
      // Escribir linea por linea
      const lines = msg.split('\n');
      for (let li = 0; li < lines.length; li++) {
        await page.keyboard.type(lines[li], { delay: 10 });
        if (li < lines.length - 1) {
          await page.keyboard.down('Shift');
          await page.keyboard.press('Enter');
          await page.keyboard.up('Shift');
          await sleep(100);
        }
      }
      await sleep(500);
      await page.keyboard.press('Enter');
      await sleep(1000);

      ok++;
      console.log(`  [${i+1}/${contactos.length}] ✅ ${(n.nombre||"").slice(0,35)}`);

    } catch (e) {
      fail++;
      console.log(`  [${i+1}/${contactos.length}] ❌ ${(n.nombre||"").slice(0,30)} - ${(e.message||"").slice(0,50)}`);
    }

    if (i < contactos.length - 1) {
      const d = randDelay();
      console.log(`     ⏱ ${Math.round(d/1000)}s...`);
      await sleep(d);
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log("RESULTADOS FINALES");
  console.log(`${"=".repeat(50)}`);
  console.log(`✅ Enviados: ${ok}`);
  console.log(`❌ Fallados: ${fail}`);
  console.log(`⚠ Saltados: ${skipCount}`);
  console.log(`${"=".repeat(50)}`);

  fs.writeFileSync(path.join(DATA_DIR, "log_envio.json"), JSON.stringify({ ok, fail, skipCount, fecha: new Date().toISOString() }));
  console.log("\nLog guardado. Puedes cerrar Chrome.");
  process.exit(0);
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
