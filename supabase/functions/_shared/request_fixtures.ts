// Cuerpos sintéticos con las mismas claves y serialización de 00-core.js,
// 06-sync-brokers.js, TrExpenseListener.java y 0011_myinvestor_keepalive.sql.
// Son muestras reproducibles, nunca máximos de un proveedor ni datos de producción.
export const EXPECTED_BODY_LIMITS = {
  "bank-aspsps": 16384, "bank-connect": 16384, "bank-disconnect": 16384, "bank-sync": 32768,
  "bank-callback": 1024, "categorize": 8192, "delete-account": 65536, "ingest": 49152,
  "myinvestor-connect": 65536, "myinvestor-sync": 1024, "myinvestor-disconnect": 1024,
  "myinvestor-keepalive": 1024, "prices": 4096, "help-assistant": 4096,
};
const banks = Array.from({ length: 12 }, (_, i) => "Banco sintético de pruebas " + String(i + 1).padStart(2, "0"));
export const BANK_ACK_FIXTURE = { recoverGaps: true, aspsps: banks,
  acks: Object.fromEntries(banks.map((b, i) => [b, "2026-10-11T23:59:59.999Z|00000000-0000-4000-8000-" + String(i).padStart(12, "0") + ".mgu2ayo0"])) };
export const INPUT_FIXTURES = {
  "bank-aspsps": [{ country: "ES" }, {}],
  "bank-connect": [{ aspsp_name: "Banco de Sabadell", country: "ES", platform: "web" },
    { aspsp_name: "Banco sintético", country: "ES", platform: "app" }, {}, { aspsp_name: "" }],
  "bank-disconnect": [{ aspsp_name: "Banco de Sabadell" }],
  "bank-sync": [{}, { recoverGaps: true }, { dateFrom: "2026-02-28", aspsps: Array(12).fill("Banco sintético de pruebas") },
    { dateFrom: "2026-02-28T12:00:00.000Z", aspsps: [null, "Banco sintético", ""] }, BANK_ACK_FIXTURE,
    { recoverGaps: true, acks: {}, campoFuturo: { version: 2 } }],
  "bank-callback": [{}],
  "categorize": [{ merchant: "Supermercado sintético" }, { merchant: "\u0001".repeat(120) }],
  "delete-account": [{ password: "contraseña-sintética" }, { password: "x".repeat(512) }],
  "myinvestor-connect": [
    { customerId: "CLIENTE-SINTETICO", password: "x".repeat(128), deviceId: "device-synthetic" },
    { customerId: "CLIENTE-SINTETICO", password: "synthetic", deviceId: "device-synthetic", otpId: "otp-synthetic", signatureRequestId: "signature-synthetic", code: "123456" },
    { storeTokens: true, deviceId: "device-synthetic", accessToken: "a".repeat(2048), refreshToken: "r".repeat(512), refreshExpiresIn: 3600 },
    { storeTokens: true, deviceId: "device-synthetic", accessToken: "synthetic", refreshToken: null, refreshExpiresIn: 0 },
    { storeTokens: true, deviceId: "device-synthetic", accessToken: "synthetic", refreshExpiresIn: null },
    { customerId: "c", password: "p", deviceId: "d", otpId: 123, signatureRequestId: 456, code: "123456" },
    { customerId: "c", password: "p", deviceId: "d", otpId: 123, signatureRequestId: null, code: "123456" },
  ],
  "myinvestor-sync": [{}], "myinvestor-disconnect": [{}], "myinvestor-keepalive": [{}],
  "prices": [{}, { symbols: Array.from({ length: 25 }, (_, i) => "SYNTHETIC" + i) }, { symbols: [null, 123, "NVDA"] }],
  "help-assistant": [{ question: "¿Cómo puedo apuntar un gasto?", language: "es" }, { question: "€".repeat(600), language: "ca" },
    { question: "Cómo apuntar un gasto", language: "fr" }, { question: "Cómo apuntar un gasto", language: null }],
  "ingest": [
    { texto: "Has pagado 9,95 € en Supermercado sintético", titulo: "Trade Republic", fuente: "tr", fecha: "1791792000000", evento: "a".repeat(64) },
    { texto: "9,95 €", titulo: "Comercio sintético", fuente: "wallet", fecha: "1791792000000", evento: "b".repeat(64) },
    { notiText: "Has pagado 9,95 € en Supermercado sintético", notiTitle: "Trade Republic", triggertime: "1791792000000" },
    { texto: "" }, { texto: "notificación", fuente: "otra", evento: null, fecha: 1791792000000 },
    { texto: "notificación", triggertime: "no-fecha" },
  ],
};

export const INVALID_INPUTS: Record<keyof typeof INPUT_FIXTURES, unknown[]> = {
  "bank-aspsps": [{ country: 3 }, { country: "ESP" }],
  "bank-connect": [{ aspsp_name: {} }, { country: "ESP" }, { platform: "other" }],
  "bank-disconnect": [{}, { aspsp_name: [] }, { aspsp_name: " " }],
  "bank-sync": [{ dateFrom: 1 }, { dateFrom: "2026-02-30" }, { dateFrom: "2026-13-01" },
    { recoverGaps: "true" }, { aspsps: "Banco" }, { aspsps: [{}] }],
  "bank-callback": [{ ignored: "no es cuerpo OAuth" }],
  "categorize": [{}, { merchant: 42 }, { merchant: " " }],
  "delete-account": [{}, { password: {} }, { password: " " }],
  "myinvestor-connect": [{}, { storeTokens: "true", customerId: "c", password: "p", deviceId: "d" },
    { storeTokens: true, accessToken: "a" },
    { storeTokens: true, deviceId: "d", accessToken: [] },
    { storeTokens: true, deviceId: "d", accessToken: "a", refreshToken: 1 },
    { storeTokens: true, deviceId: "d", accessToken: "a", refreshExpiresIn: -1 },
    { storeTokens: true, deviceId: "d", accessToken: "a", refreshExpiresIn: 1e100 },
    { customerId: "c", password: {}, deviceId: "d" },
    { customerId: "c", password: "p", deviceId: "d", otpId: {} }],
  "myinvestor-sync": [{ ignored: true }], "myinvestor-disconnect": [{ ignored: true }], "myinvestor-keepalive": [{ ignored: true }],
  "prices": [{ symbols: "NVDA" }, { symbols: [{}] }],
  "help-assistant": [{}, { question: 42 }, { question: " " }, { question: "x".repeat(601) }],
  "ingest": [[]],
};
