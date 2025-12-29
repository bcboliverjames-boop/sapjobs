import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

import fs from "node:fs";
import path from "node:path";

const servePublicTimesheet = () => {
  return {
    name: "serve-public-timesheet",
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const url = (req?.url || "").split("?")[0];
        if (!url || !(url === "/timesheet" || url.startsWith("/timesheet/"))) {
          next();
          return;
        }

        const relPath = url === "/timesheet" || url === "/timesheet/" ? "timesheet/index.html" : url.replace(/^\//, "");
        const filePath = path.join(process.cwd(), "public", relPath);

        try {
          if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
            next();
            return;
          }

          const ext = path.extname(filePath).toLowerCase();
          const contentTypeMap: Record<string, string> = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "application/javascript; charset=utf-8",
            ".json": "application/json; charset=utf-8",
            ".svg": "image/svg+xml",
            ".xml": "application/xml; charset=utf-8",
            ".txt": "text/plain; charset=utf-8",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".webp": "image/webp",
            ".ico": "image/x-icon",
          };

          res.statusCode = 200;
          res.setHeader("Cache-Control", "no-store");
          res.setHeader("Content-Type", contentTypeMap[ext] || "application/octet-stream");
          res.end(fs.readFileSync(filePath));
        } catch {
          next();
        }
      });
    },
  };
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [servePublicTimesheet(), uni()],
  base: './',
  // optimizeDeps: {
  //   exclude: ['@cloudbase/adapter-uni-app'],  // 排除 @cloudbase/adapter-uni-app 依赖
  // },
  server: {
    host: '0.0.0.0',  // 使用IP地址代替localhost
    fs: {
      deny: ['timesheet/**'],
    },
    proxy: {
      '/__auth': {
        target: 'https://envId-appid.tcloudbaseapp.com/',
        changeOrigin: true,
      }
    },
  }
});
