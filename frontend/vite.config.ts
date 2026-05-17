import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

function knowledgeBaseStatic() {
  const serveKnowledgeBase = (req: any, res: any, next: () => void) => {
    const rawUrl = req.url?.split("?")[0] ?? "/";
    const url = decodeURIComponent(rawUrl);
    if (url === "/baza-znaniy") {
      res.statusCode = 301;
      res.setHeader("Location", "/baza-znaniy/");
      res.end();
      return;
    }
    if (!url.startsWith("/baza-znaniy/")) {
      next();
      return;
    }

    const relativePath = url.endsWith("/") ? `${url}index.html` : url;
    const filePath = path.join(__dirname, "public", relativePath);
    if (!filePath.startsWith(path.join(__dirname, "public", "baza-znaniy")) || !fs.existsSync(filePath)) {
      next();
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.setHeader("Content-Type", ext === ".json" ? "application/json; charset=utf-8" : "text/html; charset=utf-8");
    res.end(fs.readFileSync(filePath));
  };

  return {
    name: "knowledge-base-static",
    configureServer(server: any) {
      server.middlewares.use(serveKnowledgeBase);
    },
    configurePreviewServer(server: any) {
      server.middlewares.use(serveKnowledgeBase);
    },
  };
}

export default defineConfig({
  plugins: [knowledgeBaseStatic(), react()],
  server: { port: 5173, proxy: { "/api": "http://localhost:8000" } }
});
