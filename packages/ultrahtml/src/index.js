export const DOCUMENT_NODE = 0;
export const ELEMENT_NODE = 1;
export const TEXT_NODE = 2;
export const COMMENT_NODE = 3;
export const DOCTYPE_NODE = 4;

export function h(type, props = {}, ...children) {
  const vnode = {
    type: ELEMENT_NODE,
    name: typeof type === "function" ? type.name : type,
    attributes: props || {},
    children: children.map((child) =>
      typeof child === "string"
        ? { type: TEXT_NODE, value: escapeHTML(String(child)) }
        : child
    ),
    parent: void 0,
    loc: [],
  };
  if (typeof type === "function") {
    __unsafeRenderFn(vnode, type);
  }
  return vnode;
}

export const Fragment = Symbol("Fragment");

const VOID_TAGS = /* @__PURE__ */ new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "keygen",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);
const RAW_TAGS = /* @__PURE__ */ new Set(["script", "style"]);
const SPLIT_ATTRS_RE =
  /([\@\.a-z0-9_\:\-]*)\s*?=?\s*?(['"]?)([\s\S]*?)\2\s+/gim;
const DOM_PARSER_RE =
  /(?:<(\/?)([a-zA-Z][a-zA-Z0-9\:-]*)(?:\s([^>]*?))?((?:\s*\/)?)>|(<\!\-\-)([\s\S]*?)(\-\->)|(<\!)([\s\S]*?)(>))/gm;
function splitAttrs(str) {
  let obj = {};
  let token;
  if (str) {
    SPLIT_ATTRS_RE.lastIndex = 0;
    str = " " + (str || "") + " ";
    while ((token = SPLIT_ATTRS_RE.exec(str))) {
      if (token[0] === " ") continue;
      obj[token[1]] = token[3];
    }
  }
  return obj;
}

export function parse(input) {
  let str = typeof input === "string" ? input : input.value;
  let doc, parent, token, text, i, bStart, bText, bEnd, tag;
  const tags = [];
  DOM_PARSER_RE.lastIndex = 0;
  parent = doc = {
    type: DOCUMENT_NODE,
    children: [],
  };
  let lastIndex = 0;
  function commitTextNode() {
    text = str.substring(lastIndex, DOM_PARSER_RE.lastIndex - token[0].length);
    if (text) {
      parent.children.push({
        type: TEXT_NODE,
        value: text,
        parent,
      });
    }
  }
  while ((token = DOM_PARSER_RE.exec(str))) {
    bStart = token[5] || token[8];
    bText = token[6] || token[9];
    bEnd = token[7] || token[10];
    if (RAW_TAGS.has(parent.name) && token[2] !== parent.name) {
      i = DOM_PARSER_RE.lastIndex - token[0].length;
      if (parent.children.length > 0) {
        parent.children[0].value += token[0];
      }
      continue;
    } else if (bStart === "<!--") {
      i = DOM_PARSER_RE.lastIndex - token[0].length;
      if (RAW_TAGS.has(parent.name)) {
        continue;
      }
      tag = {
        type: COMMENT_NODE,
        value: bText,
        parent,
        loc: [
          {
            start: i,
            end: i + bStart.length,
          },
          {
            start: DOM_PARSER_RE.lastIndex - bEnd.length,
            end: DOM_PARSER_RE.lastIndex,
          },
        ],
      };
      tags.push(tag);
      tag.parent.children.push(tag);
    } else if (bStart === "<!") {
      i = DOM_PARSER_RE.lastIndex - token[0].length;
      tag = {
        type: DOCTYPE_NODE,
        value: bText,
        parent,
        loc: [
          {
            start: i,
            end: i + bStart.length,
          },
          {
            start: DOM_PARSER_RE.lastIndex - bEnd.length,
            end: DOM_PARSER_RE.lastIndex,
          },
        ],
      };
      tags.push(tag);
      tag.parent.children.push(tag);
    } else if (token[1] !== "/") {
      commitTextNode();
      if (RAW_TAGS.has(parent.name)) {
        lastIndex = DOM_PARSER_RE.lastIndex;
        commitTextNode();
        continue;
      } else {
        tag = {
          type: ELEMENT_NODE,
          name: token[2] + "",
          attributes: splitAttrs(token[3]),
          parent,
          children: [],
          loc: [
            {
              start: DOM_PARSER_RE.lastIndex - token[0].length,
              end: DOM_PARSER_RE.lastIndex,
            },
          ],
        };
        tags.push(tag);
        tag.parent.children.push(tag);
        if (
          (token[4] && token[4].indexOf("/") > -1) ||
          VOID_TAGS.has(tag.name)
        ) {
          tag.loc[1] = tag.loc[0];
          tag.isSelfClosingTag = true;
        } else {
          parent = tag;
        }
      }
    } else {
      commitTextNode();
      if (token[2] + "" === parent.name) {
        tag = parent;
        parent = tag.parent;
        tag.loc.push({
          start: DOM_PARSER_RE.lastIndex - token[0].length,
          end: DOM_PARSER_RE.lastIndex,
        });
        text = str.substring(tag.loc[0].end, tag.loc[1].start);
        if (tag.children.length === 0) {
          tag.children.push({
            type: TEXT_NODE,
            value: text,
            parent,
          });
        }
      } else if (
        token[2] + "" === tags[tags.length - 1].name &&
        tags[tags.length - 1].isSelfClosingTag === true
      ) {
        tag = tags[tags.length - 1];
        tag.loc.push({
          start: DOM_PARSER_RE.lastIndex - token[0].length,
          end: DOM_PARSER_RE.lastIndex,
        });
      }
    }
    lastIndex = DOM_PARSER_RE.lastIndex;
  }
  text = str.slice(lastIndex);
  parent.children.push({
    type: TEXT_NODE,
    value: text,
    parent,
  });
  return doc;
}
class Walker {
  constructor(callback) {
    this.callback = callback;
  }
  async visit(node, parent, index) {
    await this.callback(node, parent, index);
    if (Array.isArray(node.children)) {
      let promises = [];
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        promises.push(this.visit(child, node, i));
      }
      await Promise.all(promises);
    }
  }
}
class WalkerSync {
  constructor(callback) {
    this.callback = callback;
  }
  visit(node, parent, index) {
    this.callback(node, parent, index);
    if (Array.isArray(node.children)) {
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        this.visit(child, node, i);
      }
    }
  }
}

const HTMLString = Symbol("HTMLString");
const AttrString = Symbol("AttrString");

export const RenderFn = Symbol("RenderFn");
function mark(str, tags = [HTMLString]) {
  const v = { value: str };
  for (const tag of tags) {
    Object.defineProperty(v, tag, {
      value: true,
      enumerable: false,
      writable: false,
    });
  }
  return v;
}

export function __unsafeHTML(str) {
  return mark(str);
}

export function __unsafeRenderFn(node, fn) {
  Object.defineProperty(node, RenderFn, {
    value: fn,
    enumerable: false,
  });
  return node;
}
const ESCAPE_CHARS = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};
function escapeHTML(str) {
  return str.replace(/[&<>]/g, (c) => ESCAPE_CHARS[c] || c);
}
export function attrs(attributes) {
  let attrStr = "";
  for (const [key, value] of Object.entries(attributes)) {
    attrStr += value === true ? ` ${key}` :` ${key}="${value}"`;
  }
  return mark(attrStr, [HTMLString, AttrString]);
}
export function html(tmpl, ...vals) {
  let buf = "";
  for (let i = 0; i < tmpl.length; i++) {
    buf += tmpl[i];
    const expr = vals[i];
    if (buf.endsWith("...") && expr && typeof expr === "object") {
      buf = buf.slice(0, -3).trimEnd();
      buf += attrs(expr).value;
    } else if (expr && expr[AttrString]) {
      buf = buf.trimEnd();
      buf += expr.value;
    } else if (expr && expr[HTMLString]) {
      buf += expr.value;
    } else if (typeof expr === "string") {
      buf += escapeHTML(expr);
    } else if (expr || expr === 0) {
      buf += String(expr);
    }
  }
  return mark(buf);
}

export function walk(node, callback) {
  const walker = new Walker(callback);
  return walker.visit(node);
}

export function walkSync(node, callback) {
  const walker = new WalkerSync(callback);
  return walker.visit(node);
}

async function renderElement(node) {
  const { name, attributes = {}, extra } = node;
  const children = await Promise.all(
    node.children.map((child) => render(child))
  ).then((res) => res.join(""));
  if (RenderFn in node) {
    const value = await node[RenderFn](attributes, mark(children));
    if (value && value[HTMLString]) return value.value;
    return escapeHTML(String(value));
  }
  if (name === Fragment) return children;
  if (VOID_TAGS.has(name)) {
    return `<${node.name}${attrs(attributes).value}>`;
  }
  return `<${node.name}${attrs(attributes).value}${extra ? extra + " ": ""}>${children}</${node.name}>`;
}
export async function render(node) {
  switch (node.type) {
    case DOCUMENT_NODE:
      return Promise.all(node.children.map((child) => render(child))).then(
        (res) => res.join("")
      );
    case ELEMENT_NODE:
      return renderElement(node);
    case TEXT_NODE:
      return `${node.value}`;
    case COMMENT_NODE:
      return `<!--${node.value}-->`;
    case DOCTYPE_NODE:
      return `<!${node.value}>`;
  }
}
export async function transform(markup, transformers = []) {
  if (!Array.isArray(transformers)) {
    throw new Error(
      `Invalid second argument for \`transform\`! Expected \`Transformer[]\` but got \`${typeof transformers}\``
    );
  }
  const doc = typeof markup === "string" ? parse(markup) : markup;
  let newDoc = doc;
  for (const t of transformers) {
    newDoc = await t(newDoc);
  }
  return render(newDoc);
}
