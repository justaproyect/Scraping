const fs = require("fs");
const path = require("path");
const readline = require("readline");

const CONFIG_PATH = path.join(__dirname, "datos", "config.json");

function cargarConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  }
  return {
    version: 1,
    producto: "mantenimiento de aires acondicionados",
    servicios_clave: [
      "Aire Acondicionado / Climatizacion",
      "Instalaciones Electricas",
      "CCTV / Seguridad Electronica",
      "Control de Acceso",
      "Infraestructura Tecnologica (Racks, UPS, Servidores)",
      "Energia Solar",
      "Asesoria SST"
    ],
    propuesta_valor: "servicio rapido, profesional y con respuesta prioritaria",
    ubicacion: "Barranquilla",
    diferenciador: "planes de mantenimiento preventivo con cobertura en toda la ciudad"
  };
}

function guardarConfig(config) {
  config.version = (config.version || 0) + 1;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
  console.log("\nConfiguracion guardada: " + CONFIG_PATH);
}

function preguntar(rl, query, def) {
  return new Promise((resolve) => {
    rl.question(query + (def ? " [" + def + "]: " : ": "), (resp) => {
      resolve(resp.trim() || def || "");
    });
  });
}

async function main() {
  const config = cargarConfig();

  console.log("\n=== CONFIGURADOR DE CAMPAÑA ===\n");
  console.log("Responde las preguntas para definir el objetivo de tu campana.");
  console.log("Los mensajes se generaran automaticamente basados en estas respuestas.\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const producto = await preguntar(rl, "Que producto o servicio quieres vender?", config.producto);
  const ubicacion = await preguntar(rl, "En que ciudad o zona?", config.ubicacion);
  const propuesta = await preguntar(rl, "Cual es tu propuesta de valor?", config.propuesta_valor);
  const diferenciador = await preguntar(rl, "Que te diferencia de la competencia?", config.diferenciador);

  rl.close();

  config.producto = producto;
  config.ubicacion = ubicacion;
  config.propuesta_valor = propuesta;
  config.diferenciador = diferenciador;

  guardarConfig(config);

  console.log("\nAhora ejecuta para regenerar los mensajes:");
  console.log("  python 2_analizar.py");
  console.log("  node generar_campana.js");
  console.log("");
}

main().catch(console.error);
