const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");
const os = require("os");

const DATA_DIR = path.join(__dirname, "..", "datos");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const TEMP_PROFILE = path.join(os.tmpdir(), "scraping_wa_1782244046201");
const SKIP = 70;
const MIN_WAIT = 20;
const MAX_WAIT = 45;

const file = "enviar_barranquilla.json";
const todos = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8"));
const conTel = todos.filter((n) => n.telefono);
const contactos = conTel.slice(SKIP, SKIP + 300);

function cleanNum(raw) {
  let n = raw.replace(/\D/g, "");
  if (n.startsWith("57")) n = n.slice(2);
  if (n.startsWith("0")) n = n.slice(1);
  return n.startsWith("3") ? "57" + n : "";
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function randDelay() { return (MIN_WAIT + Math.random() * (MAX_WAIT - MIN_WAIT)) * 1000; }

(async () => {
  console.log(">>> SCRAPING - ENVIO AUTOMATICO <<<");
  console.log(`Contactos: ${contactos.length} (saltando ${SKIP})`);
  console.log(`Solo celulares 3XX\n`);

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: false,
    args: [
      `--user-data-dir=${TEMP_PROFILE}`,
      "--no-sandbox",
      "--disable-notifications",
      "--disable-gpu",
      "--no-first-run",
      "--new-window",
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36");
  await page.goto("https://web.whatsapp.com", { waitUntil: "load" });

  console.log("⏳ Esperando autenticacion...");
  console.log("📱 Escanea el QR con WhatsApp > Dispositivos vinculados\n");

  await page.waitForSelector('div[contenteditable="true"]', { timeout: 180000 });
  console.log("✓ Conectado! Enviando...\n");
  await sleep(3000);

  let ok = 0, fail = 0, skipCount = 0;

  for (let i = 0; i < contactos.length; i++) {
    const n = contactos[i];
    const num = cleanNum(n.telefono);
    const msg = n.mensaje;

    if (!num) {
      skipCount++;
      console.log(`  [${i+1}/${contactos.length}] ⚠ ${(n.nombre||"").slice(0,30)} - fijo`);
      continue;
    }

    try {
      // Search - click search icon first
      await page.evaluate(() => {
        const icons = document.querySelectorAll('span[data-icon="search"]');
        if (icons[0]) icons[0].click();
      });
      await sleep(500);

      // Clear and type number
      await page.keyboard.down("Control");
      await page.keyboard.press("a");
      await page.keyboard.up("Control");
      await sleep(200);
      await page.keyboard.press("Backspace");
      await sleep(300);
      await page.keyboard.type(num, { delay: 20 });
      await sleep(2500);

      // Click first result
      const clicked = await page.evaluate(() => {
        const items = document.querySelectorAll('[role="listitem"]');
        for (const item of items) {
          const spans = item.querySelectorAll("span");
          for (const s of spans) {
            if (s.title || (s.textContent && s.textContent.match(/3\d{9}/))) {
              item.click();
              return s.title || s.textContent;
            }
          }
        }
        return false;
      });
      if (!clicked) throw new Error("No contact found");
      await sleep(2500);

      // Send message
      const lines = msg.split("\n");
      for (let li = 0; li < lines.length; li++) {
        if (li > 0) {
          await page.keyboard.down("Shift");
          await page.keyboard.press("Enter");
          await page.keyboard.up("Shift");
          await sleep(100);
        }
        await page.keyboard.type(lines[li], { delay: 5 });
      }
      await sleep(500);
      await page.keyboard.press("Enter");
      await sleep(1500);

      ok++;
      console.log(`  [${i+1}/${contactos.length}] ✅ ${(n.nombre||"").slice(0,35)}`);

    } catch (e) {
      fail++;
      console.log(`  [${i+1}/${contactos.length}] ❌ ${(n.nombre||"").slice(0,30)}`);
    }

    if (i < contactos.length - 1) {
      const d = randDelay();
      console.log(`     ⏱ ${Math.round(d/1000)}s`);
      await sleep(d);
    }
  }

  console.log(`\n✅ ${ok} enviados | ❌ ${fail} fallados | ⚠ ${skipCount} fijos`);
  fs.writeFileSync(path.join(DATA_DIR, "log_envio.json"), JSON.stringify({ ok, fail, skipCount }));
  console.log("FIN");
  process.exit(0);
})().catch(e => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
