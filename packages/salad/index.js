import {
  parse,
  transform,
  walk,
  render,
  COMMENT_NODE,
  TEXT_NODE,
} from "notultrahtml";
import swap from "notultrahtml/transformers/swap";
import { blankSpan, jsxTransform } from "emitkit";
import { parseSync, printSync } from "@swc/core";

const transformer = jsxTransform({ parseSync, printSync });

export async function compileSalad(fileName, fileContents) {
  let componentName = fileName.slice(0, -7);

  let template = "";
  let mainScript = "";
  let otherScripts = [];

  for (const n of parse(fileContents).children) {
    if (n.name == "script") {
      if (!mainScript && n.attributes?.salad == "") {
        mainScript = n.children[0].value;
      } else otherScripts.push(n.children[0].value);
    }

    if (n.name == "template" && !template) template = await render({ type: 0, children: n.children });
  }

  template = await transform(template, [
    (node) => {
      walk(node, (n) => {
        // comment transform
        if (n.type == COMMENT_NODE) {
          n.type = TEXT_NODE;
          n.value = `{/*${n.value.replace(/\/\*|\*\//g, "")}*/}`;
        }

        // interpolation transform
        if (n.type == TEXT_NODE) {
          n.value = n.value.replace(/\{\{[^}]*}}/g, (match) =>
            match.slice(1, -1)
          );
        }

        // attribute transofmrs
        for (const attr in n.attributes) {
          const value = n.attributes[attr];

          // empty attribute = true transform
          if (value == "") {
            delete n.attributes[attr];
            n.attributes[`${attr}={true}`] = true;
            continue;
          }

          // event handler transform
          if (attr[0] == "@") {
            delete n.attributes[attr];
            n.attributes[
              `${attr.substring(1)}={($event) => { ${value} }}`
            ] = true;
          }

          // dynamic binding transform
          if (attr[0] === ":") {
            delete n.attributes[attr];

            if (attr.startsWith(":[") && attr.endsWith("]")) {
              n.attributes[
                `{...{ [${attr.slice(2, -1)}]: ${value} }}`
              ] = true;
              continue;
            }

            n.attributes[`${attr.substring(1)}={${value}}`] = true;
          }
        }
      });

      return node;
    },
    swap({
      template: "",
    }),
  ]);

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

  otherScripts.unshift(printSync(importAst).code);

  // Post transform building
  return `
  ${otherScripts.join("\n")}

  export default function ${componentName}($props) {
    ${mainScript ? "\n" + mainScript : ""}
    
    return <>${template}</>
  }
  `.trim();
}
