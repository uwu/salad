import posthtml from "posthtml";
import { transform } from "@babel/core";
import g from "@babel/generator";

// what the fuck?
const generate = g.default;

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

            if (attr.startsWith(":[") && node.endsWith("]")) {
              node.attrs[`{...{ [${attr.slice(2, -1)}]: ${value} }}`];
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
    type: "Program",
    body: []
  }

  mainScript = transform(mainScript, {
    plugins: [
      {
        visitor: {
          ImportDeclaration(path) {
            importAst.body.push(path.node);
            path.remove();
          },
        },
      },
      ["@babel/plugin-syntax-jsx"],
    ],
    sourceType: "module",
  }).code;
  otherScripts.push(generate(importAst).code)

  // Post transform building
  let built = `
  ${otherScripts.join("\n")}

  export default function ${componentName}($props) {${
    mainScript ? "\n" + mainScript : ""
  }
    return <>${template}</>
  }
  `.trim();

  return built;
}