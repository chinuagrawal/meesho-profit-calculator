import { createServer } from "node:http";
import { existsSync } from "node:fs";
import handler from "../api/cloud.js";
// Load server variables only in the API process, never in the Vite client.
if (existsSync(".env.local")) process.loadEnvFile?.(".env.local");
const server = createServer((request,response) => {
  if (new URL(request.url ?? "/","http://localhost").pathname !== "/api/cloud") {
    response.statusCode=404; response.end("Not found"); return;
  }
  void handler(request,response);
});
server.listen(3001,"127.0.0.1",() => console.log("Local cloud API listening on http://127.0.0.1:3001"));
