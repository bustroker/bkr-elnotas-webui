import path from "node:path";
import { loadConfig } from "./config/loadConfig.js";
import { loadDotEnv } from "./env/loadDotEnv.js";
import { loadSecrets } from "./env/loadSecrets.js";
import { createApp } from "./http/createApp.js";
import { KeepAlivePinger } from "./runtime/KeepAlivePinger.js";

loadDotEnv();

const port = Number(process.env.PORT ?? "3000");

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const config = await loadConfig("./config/app.json");
const secrets = loadSecrets(process.env);
const app = await createApp({
  config,
  secrets,
  clientDistPath: path.resolve("dist/client")
});
const keepAlivePinger = new KeepAlivePinger({
  config: config.keepAlive,
  fetch,
  logger: app.log
});

app.addHook("onClose", () => {
  keepAlivePinger.stop();
});

await app.listen({ port, host: "0.0.0.0" });
keepAlivePinger.start();
