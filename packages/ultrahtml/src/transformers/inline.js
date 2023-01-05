import { walkSync, ELEMENT_NODE, TEXT_NODE } from "../index.js";
import { querySelectorAll, specificity } from "../selector.js";
import { compile } from "stylis";
export default function inline(opts) {
  const { useObjectSyntax = false } = opts ?? {};
  return (doc) => {
    const style = useObjectSyntax ? [":where([style]) {}"] : [];
    const actions = [];
    walkSync(doc, (node, parent) => {
      if (node.type === ELEMENT_NODE) {
        if (node.name === "style") {
          style.push(
            node.children
              .map((c) => (c.type === TEXT_NODE ? c.value : ""))
              .join("")
          );
          actions.push(() => {
            parent.children = parent.children.filter((c) => c !== node);
          });
        }
      }
    });
    for (const action of actions) {
      action();
    }
    const styles = style.join("\n");
    const css = compile(styles);
    const selectors = /* @__PURE__ */ new Map();
    for (const rule of css) {
      if (rule.type === "rule") {
        const rules2 = Object.fromEntries(
          rule.children.map((child) => [child.props, child.children])
        );
        for (const selector of rule.props) {
          const value = Object.assign(selectors.get(selector) ?? {}, rules2);
          selectors.set(selector, value);
        }
      }
    }
    const rules = /* @__PURE__ */ new Map();
    for (const [selector, styles2] of Array.from(selectors).sort(([a], [b]) => {
      const $a = specificity(a);
      const $b = specificity(b);
      if ($a > $b) return 1;
      if ($b > $a) return -1;
      return 0;
    })) {
      const nodes = querySelectorAll(doc, selector);
      for (const node of nodes) {
        const curr = rules.get(node) ?? {};
        rules.set(node, Object.assign(curr, styles2));
      }
    }
    for (const [node, rule] of rules) {
      let style2 = node.attributes.style ?? "";
      let styleObj = {};
      for (const decl of compile(style2)) {
        if (decl.type === "decl") {
          if (
            typeof decl.props === "string" &&
            typeof decl.children === "string"
          ) {
            styleObj[decl.props] = decl.children;
          }
        }
      }
      styleObj = Object.assign({}, rule, styleObj);
      if (useObjectSyntax) {
        node.attributes.style = styleObj;
      } else {
        node.attributes.style = `${Object.entries(styleObj)
          .map(([decl, value]) => `${decl}:${value.replace("!important", "")};`)
          .join("")}`;
      }
    }
    return doc;
  };
}
function isHttpURL(href) {
  return href.startsWith("http://") || href.startsWith("https://");
}
