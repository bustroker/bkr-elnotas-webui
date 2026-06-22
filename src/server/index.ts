import path from "node:path";
import { loadConfig } from "./config/loadConfig.js";
import { loadDotEnv } from "./env/loadDotEnv.js";
import { loadSecrets } from "./env/loadSecrets.js";
import { createServer } from "./http/createServer.js";

loadDotEnv();

const configFilePath = process.env.CONFIG_FILE ?? "./config/app.json";
const port = Number(process.env.PORT ?? "3000");

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const config = await loadConfig(configFilePath);
loadSecrets(process.env);

const server = createServer({
  config,
  clientDistPath: path.resolve("dist/client")
});

server.listen(port, () => {
  console.log(`5l-elnotas-webui listening on port ${port}`);
});
