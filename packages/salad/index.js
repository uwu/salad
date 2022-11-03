import posthtml from "posthtml";
import { blankSpan, jsxTransform } from "emitkit";
import { parseSync, printSync } from "@swc/core";

const transformer = jsxTransform({ parseSync, printSync });

export function compileSalad(fileName, fileContents) {
  let componentName = fileName.slice(0, -7);

  let mainScript;
  let otherScripts = [];

  const template = posthtml((tree) => {
    for (const n of tree) {
      if (n?.tag === "script") {
        const content = n.content.join();

        if (!mainScript && n?.attrs?.salad === true) {
          mainScript = content;
          continue;
        }

        otherScripts.push(n.content.join());
      } else if (n?.tag === "template") {
        tree.length = 0;
        tree.push(...n?.content);
      }
    }

    tree.walk((node) => {
      if (typeof node === "string") {
        // Comment transform
        if (node.startsWith("<!--") && node.endsWith("-->"))
          return (
            "{/*" +
            node.slice(4, -3).replaceAll("/*", "").replaceAll("*/", "") +
            "*/}"
          );

        // Text interpolation transform
        return node.replace(/\{\{[^}]*}}/g, (match) => match.slice(1, -1));
      }

      // Attribute-based transforms
      if (node?.attrs) {
        for (const attr in node.attrs) {
          // Attributes without equals true transform
          if (node.attrs[attr] === true) {
            delete node.attrs[attr];
            node.attrs[attr + "={true}"] = true;
            continue;
          }

          // Event handler transform
          if (attr[0] === "@") {
            const value = node.attrs[attr];
            delete node.attrs[attr];

            node.attrs[
              `${attr.substring(1)}={($event) => { ${value} }}`
            ] = true;
          } else if (attr[0] === ":") {
            const value = node.attrs[attr];
            delete node.attrs[attr];

            if (attr.startsWith(":[") && attr.endsWith("]")) {
              node.attrs[`{...{ [${attr.slice(2, -1)}]: ${value} }}`] = true;
              continue;
            }

            node.attrs[`${attr.substring(1)}={${value}}`] = true;
          }
        }
      }

      return node;
    });

    // Template transform
    tree.match({ tag: "template" }, (n) => {
      // I would make the tag "", but unfortunately the library will turn it into a <div> when I do that. Fortunately, Babel does not seem to give a fuck.
      n.tag = " ";

      return n;
    });

    return tree;
  }).process(fileContents, {
    recognizeNoValueAttribute: true,
    closingSingleTag: "slash",
    sync: true,
  }).html;

  const importAst = {
    type: "Module",
    body: [],
    span: blankSpan,
    interpreter: null,
  };

  mainScript = transformer(mainScript, {
    plugin: (p) => {
      for (const stmt of p.body)
        if (stmt.type === "ImportDeclaration") importAst.body.push(stmt);

      p.body = p.body.filter((e) => e.type !== "ImportDeclaration");

      return p;
    },
  }).code;

  otherScripts.push(printSync(importAst).code);

  // Post transform building
  return `
  ${otherScripts.join("\n")}

  export default function ${componentName}($props) {
    ${mainScript ? "\n" + mainScript : ""}
    
    return <>${template}</>
  }
  `.trim();
}
