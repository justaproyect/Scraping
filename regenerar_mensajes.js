const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "datos");
const CONFIG = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "config.json"), "utf-8"));

const CLIQUET = CONFIG.servicios_clave || [];
const AC = "Aire Acondicionado / Climatizacion";
const ELEC = "Instalaciones Electricas";
const CCTV = "CCTV / Seguridad Electronica";
const ACCESO = "Control de Acceso";
const UPS = "Infraestructura Tecnologica (Racks, UPS, Servidores)";
const SOLAR_ON = "Energia Solar (ON GRID)";
const SOLAR_HYB = "Energia Solar (HYBRID)";
const SOLAR_OFF = "Energia Solar (OFF GRID)";
const CONECT = "Conectividad / Starlink";
const SST = "Asesoria SST";

function recomendar(tipo) {
  var t = tipo.toLowerCase();
  var r = [];
  function add(s) { if (CLIQUET.includes(s) && !r.includes(s)) r.push(s); }
  if (/hotel|motel/.test(t)) { add(AC); add(ELEC); add(CCTV); add(ACCESO); add(UPS); }
  if (/restaurante/.test(t)) { add(AC); add(ELEC); add(CCTV); }
  if (/centro comercial|supermercado/.test(t)) { add(AC); add(ELEC); add(CCTV); add(SOLAR_ON); }
  if (/clinica|hospital/.test(t)) { add(ELEC); add(AC); add(CCTV); add(SST); add(UPS); add(SOLAR_HYB); }
  if (/colegio|universidad/.test(t)) { add(ELEC); add(AC); add(CCTV); add(SST); add(UPS); }
  if (/industria|fabrica/.test(t)) { add(ELEC); add(SST); add(CCTV); add(SOLAR_ON); add(UPS); }
  if (/bodega/.test(t)) { add(ELEC); add(CCTV); add(SOLAR_ON); add(UPS); }
  if (/banco|oficina|edificio/.test(t)) { add(ELEC); add(AC); add(CCTV); add(ACCESO); add(UPS); }
  if (/gimnasio/.test(t)) { add(AC); add(CCTV); add(ELEC); }
  if (/concesionario/.test(t)) { add(CCTV); add(ELEC); add(AC); add(SOLAR_ON); }
  if (/almacen/.test(t)) { add(CCTV); add(ELEC); add(AC); add(ACCESO); }
  if (/plazoleta|comidas/.test(t)) { add(AC); add(ELEC); }
  if (/consultorio/.test(t)) { add(AC); add(ELEC); add(CCTV); }
  if (/inmobiliaria|constructora/.test(t)) { add(AC); add(ELEC); add(CCTV); }
  if (/taller/.test(t)) { add(ELEC); add(CCTV); add(AC); }
  if (/salon|belleza|peluqueria|barberia|estetica/.test(t)) { add(AC); add(ELEC); add(CCTV); }
  if (/laboratorio|rehabilitacion/.test(t)) { add(AC); add(ELEC); add(CCTV); add(UPS); }
  if (/asilo/.test(t)) { add(AC); add(ELEC); add(CCTV); add(SST); }
  return r;
}

function generarMensaje(n) {
  var nombre = (n.nombre || "").split(" - ")[0].split("|")[0].split("/")[0].trim().slice(0, 40);
  var tipo = (n.tipo || "").toLowerCase();
  var producto = CONFIG.producto || "mantenimiento de aires acondicionados";
  var ubicacion = CONFIG.ubicacion || "Barranquilla";
  var propuesta = CONFIG.propuesta_valor || "servicio rapido y profesional";
  var diferenciador = CONFIG.diferenciador || "planes de mantenimiento preventivo";
  var servicios = n.servicios_recomendados || [];
  var svcStr = servicios.slice(0, 2).join(", ") || producto;
  var tieneAC = servicios.some(function(s) { return /aire|climat/i.test(s); });

  if (/hotel|motel/.test(tipo)) {
    if (tieneAC) return "Hola, vi lo de " + nombre + ". Te escribo porque trabajamos con hoteles en " + ubicacion + " ofreciendo " + producto + ". Sabemos que para un hotel los aires son prioridad. " + diferenciador + " ¿Tienen convenio con alguien actualmente o podria cotizarles?";
    return "Hola, vi lo de " + nombre + ". Trabajamos con hoteles en " + ubicacion + " ofreciendo " + svcStr + ". " + propuesta + " " + diferenciador + " ¿Les interesa una propuesta?";
  }
  if (/centro comercial/.test(tipo)) {
    if (tieneAC) return "Hola, vi lo de " + nombre + ". Somos especialistas en climatizacion para centros comerciales en " + ubicacion + " — " + producto + " de sistemas centrales, cassettes y piso techo. " + diferenciador + " ¿Conversamos?";
    return "Hola, vi lo de " + nombre + ". Trabajamos con centros comerciales en " + ubicacion + " ofreciendo " + svcStr + ". " + propuesta + " ¿Les interesa una cotizacion?";
  }
  if (/restaurante/.test(tipo)) {
    if (tieneAC) return "Hola, vi lo de " + nombre + ". En los restaurantes es clave tener los aires funcionando bien. Ofrecemos " + producto + " para splits, cassettes y sistemas centrales en " + ubicacion + ". " + diferenciador + " ¿Les sirve una cotizacion?";
    return "Hola, vi lo de " + nombre + ". Trabajamos con restaurantes en " + ubicacion + " ofreciendo " + svcStr + ". " + propuesta + " ¿Que tal si conversamos?";
  }
  if (/clinica|hospital/.test(tipo)) {
    if (tieneAC) return "Hola, vi " + nombre + ". Trabajamos con clinicas en " + ubicacion + " dandoles " + producto + ". Sabemos que los aires no pueden fallar en areas criticas. " + diferenciador + " con respuesta prioritaria. ¿Les gustaria recibir informacion?";
    return "Hola, vi " + nombre + ". Trabajamos con centros de salud en " + ubicacion + " ofreciendo " + svcStr + ". " + propuesta + " ¿Les interesa una cotizacion?";
  }
  if (/colegio|universidad/.test(tipo)) {
    if (tieneAC) return "Hola, vi " + nombre + ". Les escribo porque trabajamos con colegios en " + ubicacion + " en " + producto + " para aulas y oficinas. " + diferenciador + " para toda la temporada escolar. ¿Estarian interesados en una revision gratuita?";
    return "Hola, vi " + nombre + ". Trabajamos con instituciones educativas en " + ubicacion + " ofreciendo " + svcStr + ". " + propuesta + " ¿Les sirve una propuesta?";
  }
  if (/gimnasio/.test(tipo)) {
    if (tieneAC) return "Hola, vi lo de " + nombre + ". En los gimnasios los aires trabajan al maximo. Ofrecemos " + producto + " de equipos split, cassette y piso techo en " + ubicacion + ". " + diferenciador + " ¿Les sirve una cotizacion?";
    return "Hola, vi lo de " + nombre + ". Trabajamos con gimnasios en " + ubicacion + " ofreciendo " + svcStr + ". " + propuesta + " ¿Les interesa?";
  }
  if (/banco/.test(tipo)) {
    if (tieneAC) return "Hola, vi " + nombre + ". Trabajamos con sedes bancarias en " + ubicacion + " dandoles " + producto + " y respaldo electrico (UPS). " + diferenciador + " ¿Conversamos?";
    return "Hola, vi " + nombre + ". Trabajamos con entidades financieras en " + ubicacion + " ofreciendo " + svcStr + ". " + propuesta + " ¿Les interesa una cotizacion?";
  }
  if (/supermercado/.test(tipo)) {
    if (tieneAC) return "Hola, vi lo de " + nombre + ". Somos especialistas en climatizacion para supermercados en " + ubicacion + " — " + producto + " de sistemas centrales y areas de ventas. " + diferenciador + " ¿Estarian interesados en una propuesta?";
    return "Hola, vi lo de " + nombre + ". Trabajamos con supermercados en " + ubicacion + " ofreciendo " + svcStr + ". " + propuesta + " ¿Les interesa?";
  }
  if (/concesionario/.test(tipo)) {
    if (tieneAC) return "Hola, vi " + nombre + ". Trabajamos con concesionarios en " + ubicacion + " en " + producto + " para sala de ventas, taller y oficinas. Tambien hacemos instalacion de CCTV. " + diferenciador + " ¿Les interesa que les cotice?";
    return "Hola, vi " + nombre + ". Trabajamos con concesionarios en " + ubicacion + " ofreciendo " + svcStr + ". " + propuesta + " ¿Les sirve?";
  }
  if (/industria|fabrica/.test(tipo)) {
    if (tieneAC) return "Hola, vi " + nombre + ". Trabajamos con industrias en " + ubicacion + " ofreciendo " + producto + " para areas de produccion y oficinas. Tambien hacemos instalaciones electricas industriales y asesoria SST. " + diferenciador + " ¿Les sirve una propuesta?";
    return "Hola, vi " + nombre + ". Trabajamos con industrias en " + ubicacion + " ofreciendo " + svcStr + ". " + propuesta + " ¿Que tal si conversamos?";
  }
  if (/bodega/.test(tipo)) {
    if (tieneAC) return "Hola, vi " + nombre + ". Ofrecemos " + producto + " para bodegas y centros logisticos en " + ubicacion + ". Tambien hacemos instalaciones electricas y CCTV. " + diferenciador + " ¿Les interesaria recibir info?";
    return "Hola, vi " + nombre + ". Trabajamos con bodegas en " + ubicacion + " ofreciendo " + svcStr + ". " + propuesta + " ¿Les sirve?";
  }
  if (/oficina|edificio/.test(tipo)) {
    if (tieneAC) return "Hola, vi lo de " + nombre + ". Trabajamos con edificios de oficinas en " + ubicacion + " en " + producto + " centrales y splits. Tambien ofrecemos instalaciones electricas y UPS. " + diferenciador + " ¿Tienen equipos sin mantenimiento? Podemos cotizarles.";
    return "Hola, vi lo de " + nombre + ". Trabajamos con edificios de oficinas en " + ubicacion + " ofreciendo " + svcStr + ". " + propuesta + " ¿Conversamos?";
  }
  if (/almacen/.test(tipo)) {
    if (tieneAC) return "Hola, vi " + nombre + ". Ofrecemos " + producto + " para almacenes y grandes superficies en " + ubicacion + ". Tambien hacemos instalacion de CCTV y control de acceso. " + diferenciador + " ¿Les interesa una propuesta?";
    return "Hola, vi " + nombre + ". Trabajamos con almacenes en " + ubicacion + " ofreciendo " + svcStr + ". " + propuesta + " ¿Les sirve?";
  }
  if (/asilo/.test(tipo)) {
    if (tieneAC) return "Hola, vi " + nombre + ". Trabajamos con centros de atencion para adultos mayores en " + ubicacion + " dandoles " + producto + ". El confort de los residentes es clave. " + diferenciador + " con respuesta prioritaria. ¿Les interesa una cotizacion sin compromiso?";
    return "Hola, vi " + nombre + ". Trabajamos con centros de atencion en " + ubicacion + " ofreciendo " + svcStr + ". " + propuesta + " ¿Les interesa una propuesta?";
  }
  if (/consultorio/.test(tipo)) {
    return "Hola, vi " + nombre + ". Trabajamos con consultorios en " + ubicacion + " ofreciendo " + svcStr + ". " + propuesta + " " + diferenciador + " ¿Les interesa una cotizacion?";
  }
  if (/inmobiliaria|constructora/.test(tipo)) {
    return "Hola, vi " + nombre + ". Trabajamos con inmobiliarias en " + ubicacion + " ofreciendo " + svcStr + ". " + propuesta + " " + diferenciador + " ¿Conversamos?";
  }
  if (/taller/.test(tipo)) {
    return "Hola, vi " + nombre + ". Trabajamos con talleres en " + ubicacion + " ofreciendo " + svcStr + ". " + propuesta + " " + diferenciador + " ¿Les sirve una cotizacion?";
  }
  if (/salon|belleza|peluqueria|barberia|estetica/.test(tipo)) {
    return "Hola, vi " + nombre + ". Trabajamos con salones de belleza en " + ubicacion + " ofreciendo " + svcStr + ". " + propuesta + " " + diferenciador + " ¿Estarian interesados en una revision?";
  }
  if (/laboratorio/.test(tipo)) {
    return "Hola, vi " + nombre + ". Trabajamos con laboratorios en " + ubicacion + " ofreciendo " + svcStr + ". Sabemos que la temperatura y calidad de energia son criticas. " + propuesta + " ¿Les interesa una propuesta?";
  }
  if (/rehabilitacion/.test(tipo)) {
    return "Hola, vi " + nombre + ". Trabajamos con centros de rehabilitacion en " + ubicacion + " ofreciendo " + svcStr + ". " + propuesta + " " + diferenciador + " ¿Les sirve una cotizacion?";
  }
  if (/plazoleta|comidas/.test(tipo)) {
    return "Hola, vi lo de " + nombre + ". Trabajamos con plazoletas de comidas en " + ubicacion + " ofreciendo " + svcStr + ". " + propuesta + " " + diferenciador + " ¿Estarian interesados en una revision?";
  }
  return "Hola, vi " + nombre + ". Trabajamos en " + ubicacion + " ofreciendo " + svcStr + ". " + propuesta + " " + diferenciador + " ¿Les sirve una cotizacion sin compromiso?";
}

// Main
var files = fs.readdirSync(DATA_DIR).filter(function(f) { return f.startsWith("enviar_") && f.endsWith(".json"); });
if (files.length === 0) { console.log("No hay archivos enviar_*.json"); process.exit(1); }

files.forEach(function(file) {
  var negocios = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8"));
  negocios.forEach(function(n) {
    n.servicios_recomendados = recomendar(n.tipo || "");
    n.mensaje = generarMensaje(n);
  });
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(negocios, null, 2));
  console.log("Regenerados mensajes para: " + file + " (" + negocios.length + " negocios)");
});
