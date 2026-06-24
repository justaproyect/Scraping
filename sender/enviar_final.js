const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "datos");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_PROFILE = path.join(process.env.LOCALAPPDATA || process.env.USERPROFILE + "\\AppData\\Local", "Google\\Chrome\\User Data");
const SKIP = 70;
const MIN_WAIT = 25;
const MAX_WAIT = 50;

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
  console.log(`Contactos: ${contactos.length}\n`);

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: false,
    args: [
      `--user-data-dir=${USER_PROFILE}`,
      "--no-sandbox",
      "--disable-notifications",
      "--profile-directory=Default",
    ],
  });

  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36");
  await page.goto("https://web.whatsapp.com", { waitUntil: "domcontentloaded" });

  console.log("Esperando que cargue WhatsApp Web...");
  console.log("Si ves QR, escanea.");
  console.log("Si ya tienes sesion, espera a que carguen los chats.\n");

  // Esperar a que aparezca el panel de busqueda
  await page.waitForSelector('div[contenteditable="true"]', { timeout: 180000 });

  console.log("✓ Listo! Enviando mensajes...\n");
  await sleep(4000);

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
      // Click search box
      const boxes = await page.$$('div[contenteditable="true"]');
      let searchBox = null;
      for (const b of boxes) {
        const visible = await b.evaluate(el => el.offsetParent !== null);
        if (visible) { searchBox = b; break; }
      }
      if (!searchBox) throw new Error("No search box");
      
      await searchBox.click({ delay: 50 });
      await searchBox.evaluate(el => { el.textContent = ""; el.innerHTML = ""; });
      await sleep(200);
      await searchBox.type(num, { delay: 30 });
      await sleep(1500);

      // Click first result
      const firstResult = await page.evaluate(() => {
        const items = document.querySelectorAll('[role="listitem"]');
        for (const item of items) {
          const title = item.querySelector('[title]');
          if (title) {
            item.click();
            return title.getAttribute("title");
          }
        }
        return null;
      });
      if (!firstResult) throw new Error("No result found");
      await sleep(2000);

      // Type message
      const msgBox = await page.evaluate(() => {
        const divs = document.querySelectorAll('div[contenteditable="true"]');
        for (const d of divs) {
          if (d.closest("footer")) return d;
        }
        return null;
      });

      if (!msgBox) throw new Error("No message box");

      // Write and send
      await page.evaluate((m) => {
        const divs = document.querySelectorAll('div[contenteditable="true"]');
        for (const d of divs) {
          if (d.closest("footer")) {
            d.focus();
            d.textContent = m;
            // Dispatch input event
            d.dispatchEvent(new Event("input", { bubbles: true }));
            return;
          }
        }
      }, msg);
      await sleep(1000);
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
      console.log(`     ⏱ ${Math.round(d/1000)}s...`);
      await sleep(d);
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`✅ ${ok} enviados | ❌ ${fail} fallados | ⚠ ${skipCount} fijos`);
  fs.writeFileSync(path.join(DATA_DIR, "log_envio.json"), JSON.stringify({ ok, fail, skipCount }));
  console.log("FIN");
  process.exit(0);
})().catch(e => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
