import { walkSync, ELEMENT_NODE, TEXT_NODE, render } from "../index.js";
import { matches } from "../selector.js";
import { serialize, compile, middleware, stringify } from "stylis";
import { parse } from "parsel-js";
export default function scope(opts = {}) {
  return async (doc) => {
    const hash = opts.hash ?? shorthash(await render(doc));
    const actions = [];
    let hasStyle = false;
    const selectors = /* @__PURE__ */ new Set();
    const nodes = /* @__PURE__ */ new Set();
    walkSync(doc, (node) => {
      if (node.type === ELEMENT_NODE && node.name === "style") {
        if (!opts.attribute || hasAttribute(node, opts.attribute)) {
          hasStyle = true;
          if (opts.attribute) {
            delete node.attributes[opts.attribute];
          }
          for (const selector of getSelectors(node.children[0].value)) {
            selectors.add(selector);
          }
        }
      }
      if (node.type === ELEMENT_NODE) {
        nodes.add(node);
      }
    });
    if (hasStyle) {
      walkSync(doc, (node) => {
        if (node.type === ELEMENT_NODE) {
          actions.push(() => scopeElement(node, hash, selectors));
          if (node.name === "style") {
            actions.push(() => {
              node.children = node.children.map((c) => {
                if (c.type !== TEXT_NODE) return c;
                c.value = scopeCSS(c.value, hash);
                if (c.value === "") {
                  node.parent.children = node.parent.children.filter(
                    (s) => s !== node
                  );
                }
                return c;
              });
            });
          }
        }
      });
    }
    for (const action of actions) {
      action();
    }
    return doc;
  };
}
const NEVER_SCOPED = /* @__PURE__ */ new Set([
  "base",
  "font",
  "frame",
  "frameset",
  "head",
  "link",
  "meta",
  "noframes",
  "noscript",
  "script",
  "style",
  "title",
]);
function hasAttribute(node, name) {
  if (name in node.attributes) {
    return node.attributes[name] !== "false";
  }
  return false;
}
function scopeElement(node, hash, selectors) {
  const { name } = node;
  if (!name) return;
  if (name.length < 1) return;
  if (NEVER_SCOPED.has(name)) return;
  if (node.attributes["data-scope"]) return;
  for (const selector of selectors) {
    if (matches(node, selector)) {
      node.attributes["data-scope"] = hash;
      return;
    }
  }
}
function scopeSelector(selector, hash) {
  const ast = parse(selector);
  const scope2 = (node) => {
    switch (node.type) {
      case "pseudo-class": {
        if (node.name === "root") return node.content;
        if (node.name === "global") return node.argument;
        return `${node.content}:where([data-scope="${hash}"])`;
      }
      case "compound":
        return `${selector}:where([data-scope="${hash}"])`;
      case "complex": {
        const { left, right, combinator } = node;
        return `${scope2(left)}${combinator}${scope2(right)}`;
      }
      case "list":
        return node.list.map((s) => scope2(s)).join(" ");
      default:
        return `${node.content}:where([data-scope="${hash}"])`;
    }
  };
  return scope2(ast);
}
function scopeCSS(css, hash) {
  return serialize(
    compile(css),
    middleware([
      (element) => {
        if (element.type === "rule") {
          if (Array.isArray(element.props)) {
            element.props = element.props.map((prop) =>
              scopeSelector(prop, hash)
            );
          } else {
            element.props = scopeSelector(element.props, hash);
          }
        }
      },
      stringify,
    ])
  );
}
function getSelectors(css) {
  const selectors = /* @__PURE__ */ new Set();
  serialize(
    compile(css),
    middleware([
      (element) => {
        if (element.type === "rule") {
          if (Array.isArray(element.props)) {
            for (const p of element.props) {
              selectors.add(p);
            }
          } else {
            selectors.add(element.props);
          }
        }
      },
    ])
  );
  return Array.from(selectors);
}
/**
 * shorthash - https://github.com/bibig/node-shorthash
 *
 * @license
 *
 * (The MIT License)
 *
 * Copyright (c) 2013 Bibig <bibig@me.com>
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 */
const dictionary =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXY";
const binary = dictionary.length;
function bitwise(str) {
  let hash = 0;
  if (str.length === 0) return hash;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = (hash << 5) - hash + ch;
    hash = hash & hash;
  }
  return hash;
}
function shorthash(text) {
  let num;
  let result = "";
  let integer = bitwise(text);
  const sign = integer < 0 ? "Z" : "";
  integer = Math.abs(integer);
  while (integer >= binary) {
    num = integer % binary;
    integer = Math.floor(integer / binary);
    result = dictionary[num] + result;
  }
  if (integer > 0) {
    result = dictionary[integer] + result;
  }
  return sign + result;
}
