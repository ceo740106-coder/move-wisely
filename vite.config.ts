import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
function stockfishAssetsPlugin(): Plugin {
  return {
    name: "movewisely:stockfish-assets",
    buildStart() {
      const root = process.cwd(); const candidates = [join(root,"node_modules","stockfish","src"),join(root,"node_modules","stockfish","bin"),join(root,"node_modules","stockfish")];
      const out = join(root,"public","engine"); mkdirSync(out,{recursive:true});
      for (const base of candidates) {
        try {
          const files = readdirSync(base);
          for (const file of files) if (/^stockfish-19-lite-single\.(js|wasm)$/.test(file)) copyFileSync(join(base,file),join(out,file));
        } catch {}
      }
      const js=join(out,"stockfish-19-lite-single.js"), wasm=join(out,"stockfish-19-lite-single.wasm");
      if (process.env.CI && (!requireExists(js)||!requireExists(wasm))) throw new Error("Stockfish 19 lite assets were not found after npm install.");
    }
  };
}
function requireExists(path:string){return existsSync(path);}
export default defineConfig({
  server:{host:"0.0.0.0",port:8080,strictPort:true},
  preview:{host:"0.0.0.0",port:8081,strictPort:true},
  resolve:{tsconfigPaths:true},
  plugins:[cloudflare({viteEnvironment:{name:"ssr"}}),tanstackStart(),viteReact(),tailwindcss(),stockfishAssetsPlugin()],
});
