import { compileSalad } from "@uwu/salad";
import fs from "fs/promises";
import path from "path";

export default function pluginSalad() {
  let devMode = false;

  return {
    name: "salad-sfc",
    enforce: "pre",
    configResolved(config) {
      devMode = config.command == "serve";
    },
    resolveId(id, importer) {
      if (id.endsWith(".s.html.jsx")) return id;
      if (!id.endsWith(".s.html")) return null;

      let resolvedId = id;
      if (importer) resolvedId = path.join(path.dirname(importer), id);

      // If you stare at Vite long enough it will collapse in on itself.
      return devMode ? resolvedId : resolvedId + ".jsx";
    },

    async load(id) {
      if (devMode) {
        if (id.endsWith(".s.html"))
          return `export { default } from "${id}.jsx"; export * from "${id}.jsx"`;
      }

      if (!id.endsWith(".s.html.jsx")) return null;

      let modPath = id.slice(0, -4);
      
      // See line 21 for more information.
      if (devMode) modPath = path.join(process.cwd(), modPath);

      const fileContent = await fs.readFile(modPath, "utf-8");
      return compileSalad(path.basename(modPath), fileContent);
    },

    handleHotUpdate(ctx) {
      if (!ctx?.file?.endsWith?.(".s.html")) return;

      const modules = [];
      for (const mod of ctx.modules) {
        for (const imported of mod.importedModules) {
          modules.push(imported);
        }
      }

      return modules;
    },
  };
}
