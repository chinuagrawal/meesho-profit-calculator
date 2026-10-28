import { createServer } from "node:http";
import { existsSync } from "node:fs";
import handler from "../api/cloud.js";
import adminHandler from "../api/admin.js";
// Load server variables only in the API process, never in the Vite client.
if (existsSync(".env.local")) process.loadEnvFile?.(".env.local");
const server = createServer((request,response) => {
  const path = new URL(request.url ?? "/","http://localhost").pathname;
  if (path === "/api/admin") { void adminHandler(request,response); return; }
  if (path !== "/api/cloud") {
    response.statusCode=404; response.end("Not found"); return;
  }
  void handler(request,response);
});
server.listen(3001,"127.0.0.1",() => console.log("Local cloud API listening on http://127.0.0.1:3001"));
