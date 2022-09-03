// This file is mostly copied from https://github.com/lxsmnsyc/solid-marked/blob/main/packages/vite-plugin-solid-marked/src/index.ts, thank you lxsmnsyc.

import {
  compileSalad
} from "../salad/index.js";
import fs from "fs/promises";
import path from "path";

export default function pluginSalad() {
  return {
    name: "salad-sfc",
    resolveId(id, importer) {
      if ((id.endsWith(".s.html") || id.endsWith(".s.html.jsx")) && importer) {
        return path.join(path.dirname(importer), id)
      }

      return null;
    },
    async load(id) {
      if (id.startsWith("\0")) return null;
      
      if (id.endsWith(".s.html")) {
        const { name, ext } = path.parse(id);

        return `export * from '${name}${ext}.jsx'; export { default } from '${name}${ext}.jsx'`
      }

      if (id.endsWith(".s.html.jsx")) {
        const { dir, name } = path.parse(id);
        const target = path.join(dir, name);
        const content = await fs.readFile(target, "utf-8");

        return compileSalad(name, content)
      }


      return null;
    },
    handleHotUpdate(ctx) {
      if (!ctx?.file?.endsWith?.(".s.html")) return;

      const modules = [];
      for (const mod of ctx.modules) {
        for (const imported of mod.importedModules) {
          modules.push(imported)
        }
      }

      return modules;
    }
  }
}