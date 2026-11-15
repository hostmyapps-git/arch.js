var arch = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/arch.js
  var arch_exports = {};
  __export(arch_exports, {
    ArchError: () => ArchError,
    getIconPacks: () => getIconPacks,
    getProfile: () => getProfile,
    getProfiles: () => getProfiles,
    layout: () => layout,
    parse: () => parse,
    registerIconPack: () => registerIconPack,
    registerProfile: () => registerProfile,
    render: () => render,
    renderAll: () => renderAll,
    renderIconToString: () => renderIconToString,
    renderMarkdown: () => renderMarkdown,
    renderToString: () => renderToString,
    validate: () => validate,
    version: () => version
  });

  // src/errors.js
  var ArchError = class extends Error {
    constructor(message, loc = {}, code = "ARCH_SYNTAX") {
      super(loc.line ? `${message} (Zeile ${loc.line}, Spalte ${loc.column})` : message);
      this.name = "ArchError";
      this.line = loc.line ?? null;
      this.column = loc.column ?? null;
      this.code = code;
    }
  };

  // src/profiles.js
  var TEMPLATES = Object.freeze([
    "person",
    "system",
    "application",
    "service",
    "component",
    "database",
    "queue",
    "interface",
    "capability",
    "process",
    "artifact",
    "node",
    "package"
  ]);
  var EDGE_STYLES = Object.freeze(["flow", "dependency", "association", "access", "composition", "realization", "generalization"]);
  var NODE_PROPERTIES = Object.freeze(["description", "technology", "icon", "stereotype", "tags"]);
  var EDGE_PROPERTIES = Object.freeze(["description", "technology", "tags"]);
  var registry = /* @__PURE__ */ new Map();
  var compiledProfiles = /* @__PURE__ */ new WeakSet();
  var idPattern = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
  var reservedTypes = /* @__PURE__ */ new Set(["relation", "model", "view", "config", "architecture"]);
  var reservedAttributes = /* @__PURE__ */ new Set(["id", "type", "title", "parent", "loc", "attributes", "attributeLocs", "relation"]);
  var fail = (message) => {
    throw new ArchError(message, {}, "ARCH_PROFILE");
  };
  var own = (object, key) => Object.hasOwn(object, key);
  var record = (value2) => value2 && typeof value2 === "object" && !Array.isArray(value2);
  var copy = (value2) => JSON.parse(JSON.stringify(value2));
  var freeze = (value2) => {
    if (value2 && typeof value2 === "object") {
      Object.values(value2).forEach(freeze);
      Object.freeze(value2);
    }
    return value2;
  };
  function keys(value2, allowed, label) {
    if (!record(value2)) fail(`${label} muss ein Objekt sein`);
    for (const key of Object.keys(value2)) if (!allowed.includes(key)) fail(`${label}: unbekannte Einstellung ${key}`);
  }
  function identifier(value2, label) {
    if (typeof value2 !== "string" || !idPattern.test(value2)) fail(`${label}: ungültiger Bezeichner ${value2}`);
  }
  function names(value2, label, fallback = ["*"], allowEmpty = false) {
    const array = value2 === void 0 ? fallback : typeof value2 === "string" ? [value2] : value2;
    if (!Array.isArray(array) || !allowEmpty && !array.length || array.length > 512) fail(`${label}: ungültige Namensliste`);
    for (const item of array) if (item !== "*") identifier(item, label);
    return [...new Set(array)];
  }
  function cardinality(value2, label) {
    if (value2 === void 0) return void 0;
    keys(value2, ["min", "max"], label);
    const result = { min: value2.min ?? 0, max: value2.max ?? null };
    if (!Number.isInteger(result.min) || result.min < 0 || result.min > 4e3 || result.max !== null && (!Number.isInteger(result.max) || result.max < result.min || result.max > 4e3)) fail(`${label}: ungültige Kardinalität`);
    return result;
  }
  function attributes(value2 = {}, label) {
    if (!record(value2) || Object.keys(value2).length > 128) fail(`${label}: ungültige Attributdefinitionen`);
    const result = /* @__PURE__ */ Object.create(null);
    for (const [name, rule] of Object.entries(value2)) {
      identifier(name, label);
      if (reservedAttributes.has(name)) fail(`${label}: reserviertes Attribut ${name}`);
      keys(rule, ["type", "required", "enum", "min", "max", "minLength", "maxLength", "many", "minItems", "maxItems", "uniqueItems", "targets", "format"], `${label}.${name}`);
      const type = rule.type ?? "string";
      if (!["string", "number", "integer", "boolean", "reference"].includes(type)) fail(`${label}.${name}: unbekannter Datentyp ${type}`);
      if (rule.required !== void 0 && typeof rule.required !== "boolean") fail(`${label}.${name}: required muss boolean sein`);
      const normalized = { type, required: rule.required ?? false };
      if (rule.many !== void 0 && typeof rule.many !== "boolean") fail(`${label}.${name}: many muss boolean sein`);
      if (rule.many) normalized.many = true;
      if (rule.uniqueItems !== void 0) {
        if (!rule.many || typeof rule.uniqueItems !== "boolean") fail(`${label}.${name}: uniqueItems benötigt many`);
        normalized.uniqueItems = rule.uniqueItems;
      }
      for (const bound of ["minItems", "maxItems"]) if (rule[bound] !== void 0) {
        if (!rule.many || !Number.isInteger(rule[bound]) || rule[bound] < 0 || rule[bound] > 4e3) fail(`${label}.${name}: ungültige Grenze ${bound}`);
        normalized[bound] = rule[bound];
      }
      if ((normalized.minItems ?? 0) > (normalized.maxItems ?? 4e3)) fail(`${label}.${name}: widersprüchliche Listengrenzen`);
      if (type === "reference") normalized.targets = names(rule.targets, `${label}.${name}.targets`);
      else if (rule.targets !== void 0) fail(`${label}.${name}: targets benötigt type reference`);
      if (rule.format !== void 0) {
        if (type !== "string" || !["date", "date-time", "uri"].includes(rule.format)) fail(`${label}.${name}: ungültiges format`);
        normalized.format = rule.format;
      }
      for (const bound of ["min", "max", "minLength", "maxLength"]) if (rule[bound] !== void 0) {
        if (!Number.isFinite(rule[bound]) || (bound.includes("Length") ? type !== "string" || !Number.isInteger(rule[bound]) || rule[bound] < 0 : !["number", "integer"].includes(type)))
          fail(`${label}.${name}: ungültige Grenze ${bound}`);
        normalized[bound] = rule[bound];
      }
      if (normalized.min !== void 0 && normalized.max !== void 0 && normalized.min > normalized.max || normalized.minLength !== void 0 && normalized.maxLength !== void 0 && normalized.minLength > normalized.maxLength) fail(`${label}.${name}: widersprüchliche Grenzen`);
      if (rule.enum !== void 0) {
        if (!Array.isArray(rule.enum) || !rule.enum.length || rule.enum.length > 256 || rule.enum.some((v) => type === "integer" ? !Number.isInteger(v) : typeof v !== (type === "reference" ? "string" : type) || type === "number" && !Number.isFinite(v))) fail(`${label}.${name}: ungültige enum-Werte`);
        normalized.enum = [...new Set(rule.enum)];
      }
      if ([...NODE_PROPERTIES, ...EDGE_PROPERTIES].includes(name) && (type !== "string" || rule.many)) fail(`${label}.${name}: Standardattribute müssen skalare Strings bleiben`);
      result[name] = normalized;
    }
    return result;
  }
  var bases = (rule) => typeof rule?.extends === "string" ? [rule.extends] : rule?.extends ?? [];
  function parentNames(value2, label) {
    if (value2 === void 0) return [];
    const values = names(value2, label, [], true);
    if (values.includes("*")) fail(`${label}: Wildcard als Basistyp ist nicht erlaubt`);
    return values;
  }
  function mergeAttributes(parents, local, label) {
    const result = /* @__PURE__ */ Object.create(null);
    for (const parent of parents) for (const [key, value2] of Object.entries(parent.attributes)) {
      if (own(result, key) && JSON.stringify(result[key]) !== JSON.stringify(value2) && !own(local ?? {}, key))
        fail(`${label}.${key}: mehrdeutige geerbte Attributregel; lokale Regel erforderlich`);
      result[key] = value2;
    }
    return Object.assign(result, attributes(local, label));
  }
  function comparisons(value2 = [], label) {
    if (!Array.isArray(value2) || value2.length > 128) fail(`${label}: ungültige comparisons`);
    return value2.map((rule) => {
      keys(rule, ["left", "op", "right"], label);
      identifier(rule.left, label);
      identifier(rule.right, label);
      if (!["<", "<=", "=", "!=", ">=", ">"].includes(rule.op)) fail(`${label}: unbekannter Vergleich`);
      return { left: rule.left, op: rule.op, right: rule.right };
    });
  }
  function compileProfile(definition, fallbackId) {
    if (compiledProfiles.has(definition)) return definition;
    keys(definition, ["id", "title", "version", "extends", "nodeTypes", "relationTypes", "viewpoints", "styleGroups", "defaultRelation", "requireViewpoint"], "Profil");
    const id = definition.id ?? fallbackId;
    identifier(id, "Profil-ID");
    if (definition.extends !== void 0 && (typeof definition.extends !== "string" || !registry.has(definition.extends))) fail(`Unbekanntes Basisprofil: ${definition.extends}`);
    const base = definition.extends ? registry.get(definition.extends) : void 0;
    for (const key of ["title", "version"]) if (definition[key] !== void 0 && typeof definition[key] !== "string") fail(`Profil.${key} muss ein String sein`);
    if (definition.requireViewpoint !== void 0 && typeof definition.requireViewpoint !== "boolean") fail("requireViewpoint muss boolean sein");
    const merged = (key) => {
      const values = definition[key] ?? {};
      if (!record(values)) fail(`Profil.${key} muss ein Objekt sein`);
      return Object.assign(/* @__PURE__ */ Object.create(null), base?.[key] ?? {}, values);
    };
    const rawNodes = merged("nodeTypes"), rawEdges = merged("relationTypes"), rawViews = merged("viewpoints");
    const styleGroups = merged("styleGroups");
    if (Object.keys(styleGroups).length > 512) fail("Zu viele Stilgruppen");
    for (const [name, group] of Object.entries(styleGroups)) {
      identifier(name, "Stilgruppe");
      keys(group, ["backgroundColor"], `Stilgruppe ${name}`);
      if (group.backgroundColor !== void 0 && !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(group.backgroundColor)) fail(`${name}: ungültige backgroundColor`);
    }
    if (!Object.keys(rawNodes).length || Object.keys(rawNodes).length > 512 || Object.keys(rawEdges).length > 512 || Object.keys(rawViews).length > 128) fail("Profil benötigt 1–512 Knotentypen; maximal 512 Relationstypen und 128 Viewpoints");
    const nodeTypes = /* @__PURE__ */ Object.create(null), relationTypes = /* @__PURE__ */ Object.create(null), viewpoints = /* @__PURE__ */ Object.create(null);
    const compiling = /* @__PURE__ */ new Set();
    const node = (name) => {
      if (own(nodeTypes, name)) return nodeTypes[name];
      if (!own(rawNodes, name) || compiling.has(`n:${name}`)) fail(`Unbekannter oder zyklischer Knotentyp: ${name}`);
      identifier(name, "Knotentyp");
      if (reservedTypes.has(name)) fail(`Reservierter Knotentyp: ${name}`);
      const raw = rawNodes[name];
      keys(raw, ["extends", "template", "container", "contains", "abstract", "attributes", "icon", "accent", "backgroundColor", "styleGroup", "comparisons"], `Knotentyp ${name}`);
      compiling.add(`n:${name}`);
      const baseNames = parentNames(raw.extends, `Basistyp von ${name}`), parents = baseNames.map(node), parent = parents[0];
      const result = {
        template: raw.template ?? parent?.template ?? "node",
        container: raw.container,
        abstract: raw.abstract ?? false,
        attributes: mergeAttributes(parents, raw.attributes, name)
      };
      for (const key of ["icon", "accent"]) if (raw[key] !== void 0 || parent?.[key] !== void 0) result[key] = raw[key] ?? parent[key];
      for (const key of ["styleGroup", "backgroundColor"]) if (raw[key] !== void 0 || parent?.[key] !== void 0) result[key] = raw[key] ?? parent[key];
      if (result.styleGroup !== void 0 && !own(styleGroups, result.styleGroup)) fail(`${name}: unbekannte Stilgruppe ${result.styleGroup}`);
      if (result.backgroundColor !== void 0 && !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(result.backgroundColor)) fail(`${name}: ungültige backgroundColor`);
      if (raw.extends !== void 0) result.extends = Array.isArray(raw.extends) ? baseNames : raw.extends;
      const checks = [...parents.flatMap((p) => p.comparisons ?? []), ...comparisons(raw.comparisons, name)];
      if (checks.length) result.comparisons = [...new Map(checks.map((check) => [JSON.stringify(check), check])).values()];
      for (const check of result.comparisons ?? []) {
        const a = result.attributes[check.left], b = result.attributes[check.right];
        if (!a || !b || a.many || b.many || a.type !== b.type || !["number", "integer", "string"].includes(a.type) || a.format !== b.format)
          fail(`${name}: Vergleich benötigt zwei kompatible skalare Attribute`);
      }
      if (!TEMPLATES.includes(result.template)) fail(`Unbekanntes Template für ${name}: ${result.template}`);
      result.container ?? (result.container = result.template === "package");
      if (typeof result.abstract !== "boolean" || typeof result.container !== "boolean" || result.container !== (result.template === "package")) fail(`${name}: Container benötigen template package`);
      if (raw.contains !== void 0 && !result.container) fail(`${name}: contains ist nur für Container erlaubt`);
      if (result.container) result.contains = names(raw.contains ?? parent?.contains, `${name}.contains`, ["*"], true);
      if (result.icon !== void 0 && (typeof result.icon !== "string" || !/^[A-Za-z_][A-Za-z0-9_-]*\.[A-Za-z0-9_][A-Za-z0-9_-]*$/.test(result.icon))) fail(`${name}: ungültige Iconreferenz`);
      if (result.accent !== void 0 && !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(result.accent)) fail(`${name}: ungültige Akzentfarbe`);
      nodeTypes[name] = result;
      compiling.delete(`n:${name}`);
      return result;
    };
    for (const name of Object.keys(rawNodes)) node(name);
    const knownNodes = (list, label) => {
      for (const name of list) if (name !== "*" && !own(nodeTypes, name)) fail(`${label}: unbekannter Knotentyp ${name}`);
    };
    const checkReferences = (rule, label) => {
      for (const [key, attr] of Object.entries(rule.attributes)) if (attr.type === "reference") knownNodes(attr.targets, `${label}.${key}`);
    };
    for (const [name, rule] of Object.entries(nodeTypes)) {
      if (rule.container) knownNodes(rule.contains, `${name}.contains`);
      checkReferences(rule, name);
    }
    const relation = (name) => {
      if (own(relationTypes, name)) return relationTypes[name];
      if (!own(rawEdges, name) || compiling.has(`e:${name}`)) fail(`Unbekannter oder zyklischer Relationstyp: ${name}`);
      identifier(name, "Relationstyp");
      const raw = rawEdges[name];
      keys(raw, ["extends", "from", "to", "style", "abstract", "allowSelf", "attributes", "outgoing", "incoming", "pairs", "acyclic"], `Relationstyp ${name}`);
      compiling.add(`e:${name}`);
      const baseNames = parentNames(raw.extends, `Basisrelation von ${name}`), parents = baseNames.map(relation), parent = parents[0];
      const result = {
        from: names(raw.from ?? parent?.from, `${name}.from`),
        to: names(raw.to ?? parent?.to, `${name}.to`),
        style: raw.style ?? parent?.style ?? "flow",
        abstract: raw.abstract ?? false,
        allowSelf: raw.allowSelf ?? parent?.allowSelf ?? true,
        attributes: mergeAttributes(parents, raw.attributes, name)
      };
      if (raw.extends !== void 0) result.extends = Array.isArray(raw.extends) ? baseNames : raw.extends;
      if (raw.acyclic !== void 0 && typeof raw.acyclic !== "boolean") fail(`${name}.acyclic muss boolean sein`);
      if (raw.acyclic ?? parent?.acyclic) result.acyclic = true;
      const pairs = raw.pairs ?? parent?.pairs;
      if (pairs !== void 0) {
        if (!Array.isArray(pairs) || !pairs.length || pairs.length > 512) fail(`${name}: ungültige pairs`);
        result.pairs = pairs.map((pair) => {
          keys(pair, ["from", "to", "fromExclude", "toExclude"], `${name}.pairs`);
          const normalized = { from: names(pair.from, name), to: names(pair.to, name) };
          for (const key of ["fromExclude", "toExclude"]) if (pair[key] !== void 0) normalized[key] = names(pair[key], name, [], true);
          for (const [key, values] of Object.entries(normalized)) knownNodes(values, `${name}.${key}`);
          return normalized;
        });
      }
      if (!EDGE_STYLES.includes(result.style)) fail(`Unbekannter Kantenstil für ${name}: ${result.style}`);
      if (typeof result.abstract !== "boolean" || typeof result.allowSelf !== "boolean") fail(`${name}: abstract/allowSelf müssen boolean sein`);
      for (const key of ["outgoing", "incoming"]) {
        const value2 = cardinality(raw[key] ?? parent?.[key], `${name}.${key}`);
        if (value2) result[key] = value2;
      }
      knownNodes(result.from, `${name}.from`);
      knownNodes(result.to, `${name}.to`);
      checkReferences(result, name);
      relationTypes[name] = result;
      compiling.delete(`e:${name}`);
      return result;
    };
    for (const name of Object.keys(rawEdges)) relation(name);
    const knownEdges = (list, label) => {
      for (const name of list) if (name !== "*" && !own(relationTypes, name)) fail(`${label}: unbekannter Relationstyp ${name}`);
    };
    for (const [name, raw] of Object.entries(rawViews)) {
      identifier(name, "Viewpoint");
      keys(raw, ["nodes", "relations", "requiredNodes", "requiredRelations", "connections"], `Viewpoint ${name}`);
      const result = {
        nodes: names(raw.nodes, `${name}.nodes`, ["*"], true),
        relations: names(raw.relations, `${name}.relations`, ["*"], true),
        requiredNodes: raw.requiredNodes === void 0 ? [] : names(raw.requiredNodes, `${name}.requiredNodes`, [], true),
        requiredRelations: raw.requiredRelations === void 0 ? [] : names(raw.requiredRelations, `${name}.requiredRelations`, [], true)
      };
      knownNodes(result.nodes, name);
      knownNodes(result.requiredNodes, name);
      knownEdges(result.relations, name);
      knownEdges(result.requiredRelations, name);
      if (result.requiredNodes.includes("*") || result.requiredRelations.includes("*")) fail(`${name}: Pflichtlisten erlauben keinen Wildcard`);
      if (raw.connections !== void 0) {
        if (!Array.isArray(raw.connections) || raw.connections.length > 128) fail(`${name}: ungültige connections`);
        result.connections = raw.connections.map((check) => {
          keys(check, ["nodes", "relations", "direction", "min", "max"], `${name}.connections`);
          const value2 = {
            nodes: names(check.nodes, name),
            relations: names(check.relations, name),
            direction: check.direction ?? "either",
            ...cardinality({ min: check.min ?? 1, max: check.max }, `${name}.connections`)
          };
          if (!["incoming", "outgoing", "either"].includes(value2.direction)) fail(`${name}: ungültige Verbindungsrichtung`);
          knownNodes(value2.nodes, name);
          knownEdges(value2.relations, name);
          return value2;
        });
      }
      viewpoints[name] = result;
    }
    const defaultRelation = own(definition, "defaultRelation") ? definition.defaultRelation : base ? base.defaultRelation : own(relationTypes, "flow") ? "flow" : null;
    if (defaultRelation !== null && (!own(relationTypes, defaultRelation) || relationTypes[defaultRelation].abstract)) fail(`Ungültige Standardrelation: ${defaultRelation}`);
    const compiled = freeze({
      id,
      title: definition.title ?? base?.title ?? id,
      version: definition.version ?? base?.version ?? "1",
      nodeTypes,
      relationTypes,
      viewpoints,
      styleGroups: copy(styleGroups),
      defaultRelation,
      requireViewpoint: definition.requireViewpoint ?? base?.requireViewpoint ?? false
    });
    compiledProfiles.add(compiled);
    return compiled;
  }
  function registerProfile(name, definition) {
    identifier(name, "Profilname");
    if (definition?.id !== void 0 && definition.id !== name) fail("Profilname und Profil-ID müssen übereinstimmen");
    const profile = compileProfile(definition, name);
    registry.set(name, profile);
    return copy(profile);
  }
  function getProfiles() {
    return [...registry.keys()];
  }
  function getProfile(name) {
    if (!registry.has(name)) fail(`Unbekanntes Profil: ${name}`);
    return copy(registry.get(name));
  }
  function resolveProfile(model, options = {}) {
    let selection = options.profile;
    if (selection === void 0 && model.profile) return compileProfile(model.profile);
    if (selection === void 0) selection = model.config?.profile;
    if (selection !== void 0) {
      if (typeof selection === "string") {
        if (!registry.has(selection)) throw new ArchError(`Unbekanntes Profil: ${selection}`, model.config?.loc, "ARCH_PROFILE");
        return registry.get(selection);
      }
      return compileProfile(selection, "parameter");
    }
    if (model.config?.definition) {
      try {
        return compileProfile(model.config.definition, "inline");
      } catch (error) {
        throw new ArchError(error.message, model.config.loc, "ARCH_PROFILE");
      }
    }
    return registry.get("default");
  }
  function matches(type, allowed, definitions) {
    if (allowed.includes("*")) return true;
    const visited = /* @__PURE__ */ new Set(), pending = [type];
    while (pending.length) {
      const next = pending.pop();
      if (!next || visited.has(next)) continue;
      if (allowed.includes(next)) return true;
      visited.add(next);
      pending.push(...bases(definitions[next]));
    }
    return false;
  }
  function visibleNodeIds(model, view) {
    const nodes = new Map(model.nodes.map((node) => [node.id, node])), visible = new Set(view.include ?? nodes.keys());
    if (view.include) {
      const children = /* @__PURE__ */ new Map();
      for (const node of model.nodes) {
        if (!children.has(node.parent)) children.set(node.parent, []);
        children.get(node.parent).push(node.id);
      }
      const add = (id) => {
        for (const child of children.get(id) ?? []) {
          if (!visible.has(child)) {
            visible.add(child);
            add(child);
          }
        }
      };
      for (const id of view.include) add(id);
      for (const id of [...visible]) {
        const seen = /* @__PURE__ */ new Set();
        let parent = nodes.get(id)?.parent;
        while (parent && !seen.has(parent)) {
          seen.add(parent);
          visible.add(parent);
          parent = nodes.get(parent)?.parent;
        }
      }
    }
    return visible;
  }
  function validFormat(value2, format) {
    if (typeof value2 !== "string") return false;
    if (format === "uri") return /^[A-Za-z][A-Za-z0-9+.-]*:\S+$/.test(value2);
    const date = value2.match(/^(\d{4})-(\d{2})-(\d{2})(.*)$/);
    if (!date) return false;
    const year = Number(date[1]), month = Number(date[2]), day = Number(date[3]);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    if (month < 1 || month > 12 || day < 1 || day > [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]) return false;
    if (format === "date") return date[4] === "";
    const time = date[4].match(/^T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/);
    return !!time && Number(time[1]) < 24 && Number(time[2]) < 60 && Number(time[3]) < 60 && (!time[4] || Number(time[5]) < 24 && Number(time[6]) < 60) && Number.isFinite(Date.parse(value2));
  }
  function profileDiagnostics(model, profile) {
    const result = [], nodes = new Map(model.nodes.map((node) => [node.id, node]));
    const add = (message, item, extra = {}) => result.push({
      severity: "error",
      code: profile.id === "default" ? "ARCH_VALIDATION" : "ARCH_SEMANTIC",
      message,
      line: item?.loc?.line ?? null,
      column: item?.loc?.column ?? null,
      ...extra
    });
    const checkAttributes = (item, rule, builtins) => {
      const values = { ...Object.fromEntries(builtins.filter((key) => own(item, key)).map((key) => [key, item[key]])), ...item.attributes };
      for (const [name, value2] of Object.entries(values)) {
        const schema = rule.attributes[name];
        const location = { loc: item.attributeLocs?.[name] ?? item.loc };
        const extra = { elementId: item.id, attribute: name };
        if (!schema && !builtins.includes(name)) {
          add(`Unbekanntes Attribut für ${item.type}: ${name}`, location, extra);
          continue;
        }
        const type = schema?.type ?? "string", many = !!schema?.many;
        if (many !== Array.isArray(value2)) {
          add(`${item.id}.${name}: erwartet ${many ? "Liste" : type}`, location, extra);
          continue;
        }
        const entries = many ? value2 : [value2];
        if (many && (entries.length < (schema.minItems ?? 0) || entries.length > (schema.maxItems ?? 4e3))) add(`${item.id}.${name}: ungültige Listenlänge`, location, extra);
        if (many && schema.uniqueItems && new Set(entries).size !== entries.length) add(`${item.id}.${name}: doppelte Listeneinträge sind nicht erlaubt`, location, extra);
        for (const entry of entries) {
          if (type === "integer" ? !Number.isInteger(entry) : typeof entry !== (type === "reference" ? "string" : type) || type === "number" && !Number.isFinite(entry)) {
            add(`${item.id}.${name}: erwartet ${type}`, location, extra);
            continue;
          }
          if (!schema) continue;
          if (schema.enum && !schema.enum.includes(entry)) add(`${item.id}.${name}: Wert muss aus ${schema.enum.map((v) => JSON.stringify(v)).join(", ")} stammen`, location, extra);
          if (schema.min !== void 0 && entry < schema.min || schema.max !== void 0 && entry > schema.max) add(`${item.id}.${name}: Zahl außerhalb des erlaubten Bereichs`, location, extra);
          if (schema.minLength !== void 0 && [...entry].length < schema.minLength || schema.maxLength !== void 0 && [...entry].length > schema.maxLength) add(`${item.id}.${name}: ungültige Textlänge`, location, extra);
          if (schema.format && !validFormat(entry, schema.format)) add(`${item.id}.${name}: ungültiges Format ${schema.format}`, location, extra);
          if (type === "reference") {
            const target = nodes.get(entry);
            if (!target) add(`${item.id}.${name}: unbekannte Referenz ${entry}`, location, extra);
            else if (!matches(target.type, schema.targets, profile.nodeTypes)) add(`${item.id}.${name}: Referenztyp ${target.type} ist nicht erlaubt`, location, extra);
          }
        }
      }
      for (const [name, schema] of Object.entries(rule.attributes)) if (schema.required && !own(values, name)) add(`${item.id}: Pflichtattribut ${name} fehlt`, item, { elementId: item.id, attribute: name });
      for (const check of rule.comparisons ?? []) {
        const a = rule.attributes[check.left], b = rule.attributes[check.right];
        let left = values[check.left], right = values[check.right];
        if (left === void 0 || right === void 0 || typeof left !== typeof right) continue;
        if (a.format && (!validFormat(left, a.format) || !validFormat(right, b.format))) continue;
        if (a.format === "date" || a.format === "date-time") {
          left = Date.parse(left);
          right = Date.parse(right);
        }
        const ok = { "<": left < right, "<=": left <= right, "=": left === right, "!=": left !== right, ">=": left >= right, ">": left > right }[check.op];
        if (!ok) add(`${item.id}: ${check.left} ${check.op} ${check.right} ist nicht erfüllt`, item, { elementId: item.id });
      }
    };
    for (const node of model.nodes) {
      const rule = profile.nodeTypes[node.type];
      if (!rule) {
        add(`Unbekannter Elementtyp im Profil ${profile.id}: ${node.type}`, node, { elementId: node.id });
        continue;
      }
      if (rule.abstract) add(`Abstrakter Knotentyp darf nicht instanziiert werden: ${node.type}`, node, { elementId: node.id });
      if (node.parent) {
        const parent = nodes.get(node.parent), parentRule = profile.nodeTypes[parent?.type];
        if (parentRule && !parentRule.container) add(`${node.parent} ist kein Container`, node, { elementId: node.id });
        else if (parentRule && !matches(node.type, parentRule.contains, profile.nodeTypes)) add(`${node.type} ist in ${parent.type} nicht erlaubt`, node, { elementId: node.id });
      }
      checkAttributes(node, rule, NODE_PROPERTIES);
    }
    for (const edge of model.edges) {
      const type = edge.type ?? profile.defaultRelation, rule = profile.relationTypes[type];
      if (!rule) {
        add(type ? `Unbekannter Beziehungstyp im Profil ${profile.id}: ${type}` : `Beziehung ${edge.id} benötigt einen expliziten type`, edge, { elementId: edge.id });
        continue;
      }
      if (rule.abstract) add(`Abstrakter Beziehungstyp darf nicht instanziiert werden: ${type}`, edge, { elementId: edge.id });
      if (!rule.allowSelf && edge.source === edge.target) add(`${type}: Selbstbeziehung ist nicht erlaubt`, edge, { elementId: edge.id });
      for (const [endpoint, types] of [["source", rule.from], ["target", rule.to]]) {
        const node = nodes.get(edge[endpoint]);
        if (node && !matches(node.type, types, profile.nodeTypes)) add(`${edge.id}: ${endpoint} vom Typ ${node.type} ist für ${type} nicht erlaubt`, edge, { elementId: edge.id });
      }
      if (rule.pairs && !rule.pairs.some((pair) => {
        const source = nodes.get(edge.source), target = nodes.get(edge.target);
        return source && target && matches(source.type, pair.from, profile.nodeTypes) && matches(target.type, pair.to, profile.nodeTypes) && !matches(source.type, pair.fromExclude ?? [], profile.nodeTypes) && !matches(target.type, pair.toExclude ?? [], profile.nodeTypes);
      })) add(`${edge.id}: Typkombination ${nodes.get(edge.source)?.type} → ${nodes.get(edge.target)?.type} ist für ${type} nicht erlaubt`, edge, { elementId: edge.id });
      checkAttributes({ ...edge, type }, rule, EDGE_PROPERTIES);
    }
    const counts = /* @__PURE__ */ new Map();
    for (const edge of model.edges) {
      const pending = [edge.type ?? profile.defaultRelation];
      const visited = /* @__PURE__ */ new Set();
      while (pending.length) {
        const type = pending.pop();
        if (!type || visited.has(type)) continue;
        visited.add(type);
        if (!counts.has(type)) counts.set(type, { source: /* @__PURE__ */ new Map(), target: /* @__PURE__ */ new Map() });
        for (const endpoint of ["source", "target"]) {
          const map = counts.get(type)[endpoint];
          map.set(edge[endpoint], (map.get(edge[endpoint]) ?? 0) + 1);
        }
        pending.push(...bases(profile.relationTypes[type]));
      }
    }
    for (const [type, rule] of Object.entries(profile.relationTypes)) if (rule.acyclic) {
      const adjacency = /* @__PURE__ */ new Map(), state = /* @__PURE__ */ new Map();
      for (const edge of model.edges) if (matches(edge.type ?? profile.defaultRelation, [type], profile.relationTypes)) {
        if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
        adjacency.get(edge.source).push(edge);
      }
      let cycle;
      const visit = (id) => {
        state.set(id, 1);
        for (const edge of adjacency.get(id) ?? []) {
          if (state.get(edge.target) === 1) {
            cycle = edge;
            return;
          }
          if (!state.has(edge.target)) visit(edge.target);
          if (cycle) return;
        }
        state.set(id, 2);
      };
      for (const id of adjacency.keys()) {
        if (!state.has(id)) visit(id);
        if (cycle) break;
      }
      if (cycle) add(`${type}: Zyklus ist nicht erlaubt`, cycle, { elementId: cycle.id });
    }
    for (const [name, rule] of Object.entries(profile.relationTypes)) for (const key of ["outgoing", "incoming"]) if (rule[key]) {
      const endpoint = key === "outgoing" ? "source" : "target", applicable = key === "outgoing" ? rule.from : rule.to;
      for (const node of model.nodes) if (matches(node.type, applicable, profile.nodeTypes)) {
        const count = counts.get(name)?.[endpoint].get(node.id) ?? 0;
        if (count < rule[key].min || rule[key].max !== null && count > rule[key].max) add(`${node.id}: ${name}.${key} erwartet ${rule[key].min}–${rule[key].max ?? "∞"} Beziehungen, gefunden ${count}`, node, { elementId: node.id });
      }
    }
    for (const view of model.views) {
      if (!view.viewpoint) {
        if (profile.requireViewpoint) add(`Ansicht ${view.id} benötigt einen viewpoint`, view, { viewId: view.id });
        continue;
      }
      const rule = profile.viewpoints[view.viewpoint];
      if (!rule) {
        add(`Unbekannter Viewpoint: ${view.viewpoint}`, view, { viewId: view.id });
        continue;
      }
      const visible = visibleNodeIds(model, view), selectedNodes = model.nodes.filter((node) => visible.has(node.id));
      const selectedEdges = model.edges.filter((edge) => visible.has(edge.source) && visible.has(edge.target));
      for (const node of selectedNodes) if (!matches(node.type, rule.nodes, profile.nodeTypes)) add(`${view.id}: Knotentyp ${node.type} ist für Viewpoint ${view.viewpoint} nicht erlaubt`, node, { elementId: node.id, viewId: view.id });
      for (const edge of selectedEdges) if (!matches(edge.type ?? profile.defaultRelation, rule.relations, profile.relationTypes)) add(`${view.id}: Beziehungstyp ${edge.type ?? profile.defaultRelation} ist nicht erlaubt`, edge, { elementId: edge.id, viewId: view.id });
      for (const type of rule.requiredNodes) if (!selectedNodes.some((node) => matches(node.type, [type], profile.nodeTypes))) add(`${view.id}: Pflicht-Knotentyp ${type} fehlt`, view, { viewId: view.id });
      for (const type of rule.requiredRelations) if (!selectedEdges.some((edge) => matches(edge.type ?? profile.defaultRelation, [type], profile.relationTypes))) add(`${view.id}: Pflicht-Beziehungstyp ${type} fehlt`, view, { viewId: view.id });
      for (const check of rule.connections ?? []) for (const node of selectedNodes) if (matches(node.type, check.nodes, profile.nodeTypes)) {
        const count = selectedEdges.filter((edge) => matches(edge.type ?? profile.defaultRelation, check.relations, profile.relationTypes) && (check.direction !== "incoming" && edge.source === node.id || check.direction !== "outgoing" && edge.target === node.id)).length;
        if (count < check.min || check.max !== null && count > check.max) add(`${view.id}: ${node.id} benötigt ${check.min}–${check.max ?? "∞"} ${check.direction}-Verbindungen`, node, { elementId: node.id, viewId: view.id });
      }
    }
    return result;
  }
  registerProfile("default", {
    title: "arch.js standard",
    version: "1",
    nodeTypes: Object.fromEntries(TEMPLATES.map((template) => [template, { template }])),
    relationTypes: Object.fromEntries(EDGE_STYLES.map((style) => [style, { style }])),
    defaultRelation: "flow"
  });

  // src/colors.js
  function luminance(hex) {
    const value2 = hex.slice(1);
    const channels = (value2.length === 3 ? [...value2].map((c) => c + c).join("") : value2).match(/../g).map((c) => {
      const n = parseInt(c, 16) / 255;
      return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }
  var contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
  var foreground = (background) => contrast(background, "#000000") >= contrast(background, "#ffffff") ? "#000000" : "#ffffff";
  function composite(front, back, opacity) {
    const channels = (hex) => {
      const value2 = hex.slice(1);
      return (value2.length === 3 ? [...value2].map((c) => c + c).join("") : value2).match(/../g).map((c) => parseInt(c, 16));
    };
    const base = channels(back);
    return "#" + channels(front).map((n, i) => Math.round(n * opacity + base[i] * (1 - opacity)).toString(16).padStart(2, "0")).join("");
  }

  // src/diagrams.js
  var DIAGRAMS = ["connected", "sequence", "state", "activity", "matrix", "heatmap", "timeline", "class"];
  var fields = {
    connected: [],
    sequence: ["participants", "messages", "asyncMessages", "returns"],
    state: ["initial", "finals"],
    activity: ["lanes", "laneAttribute", "initial", "finals", "decisions", "forks", "joins"],
    matrix: ["rows", "columns", "relations"],
    heatmap: ["valueAttribute", "parentAttribute", "min", "max", "colorLow", "colorHigh"],
    timeline: ["startAttribute", "endAttribute"],
    class: ["attributes", "methods", "functions", "interfaces", "ports", "parameters", "ownerAttribute", "signatureAttribute"]
  };
  var lists = /* @__PURE__ */ new Set(["participants", "messages", "asyncMessages", "returns", "finals", "lanes", "decisions", "forks", "joins", "rows", "columns", "relations", "attributes", "methods", "functions", "interfaces", "ports", "parameters"]);
  var members = ["attributes", "methods", "functions", "interfaces", "ports", "parameters"];
  var esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
  var fail2 = (message, view) => {
    throw new ArchError(`Ansicht ${view.id}: ${message}`, view.loc, "ARCH_VALIDATION");
  };
  var value = (node, name) => node.attributes?.[name] ?? node[name];
  function selected(model, view) {
    const ids = visibleNodeIds(model, view), nodes = model.nodes.filter((n) => ids.has(n.id));
    return { nodes, edges: model.edges.filter((e) => ids.has(e.source) && ids.has(e.target)) };
  }
  function validateDiagramView(model, profile, view) {
    const c = view.diagram ?? { type: "connected" }, type = c.type;
    if (!DIAGRAMS.includes(type)) fail2(`Unbekannter Diagrammtyp ${type}`, view);
    const { nodes, edges } = selected(model, view), ids = new Set(nodes.map((n) => n.id)), edgeIds = new Set(edges.map((e) => e.id));
    for (const [key, v] of Object.entries(c)) {
      if (key === "type") continue;
      if (!fields[type].includes(key)) fail2(`Einstellung ${key} gilt nicht für ${type}`, view);
      if (lists.has(key)) {
        if (!Array.isArray(v) || v.some((x) => typeof x !== "string") || new Set(v).size !== v.length) fail2(`${key} benötigt eine eindeutige Liste`, view);
        const allowed = ["messages", "asyncMessages", "returns"].includes(key) ? edgeIds : key === "relations" ? new Set(Object.keys(profile.relationTypes)) : ids;
        for (const id of v) if (!allowed.has(id)) fail2(`${key}: unbekannte oder unsichtbare Referenz ${id}`, view);
      } else if (["min", "max"].includes(key)) {
        if (!Number.isFinite(v)) fail2(`${key} muss endlich sein`, view);
      } else if (typeof v !== "string") fail2(`${key} muss ein String sein`, view);
      if (key.startsWith("color") && !/^#(?:[a-f0-9]{3}|[a-f0-9]{6})$/i.test(v)) fail2(`Ungültige Farbe ${key}`, view);
    }
    if (Object.keys(view.places).length || Object.keys(view.routes).length) {
      if (type !== "connected") fail2("place/route sind nur für connected vorgesehen; dieser Renderer bestimmt das Layout", view);
    }
    if (c.initial && !ids.has(c.initial)) fail2("initial ist nicht sichtbar", view);
    if (type === "sequence") {
      const participants = new Set(c.participants ?? nodes.map((n) => n.id)), messages = c.messages ?? edges.map((e) => e.id);
      for (const id of messages) {
        const e = edges.find((e2) => e2.id === id);
        if (!participants.has(e.source) || !participants.has(e.target)) fail2(`Nachricht ${id} benötigt beide Teilnehmer`, view);
      }
      for (const id of [...c.returns ?? [], ...c.asyncMessages ?? []]) if (!messages.includes(id)) fail2(`Nachricht ${id} ist nicht in messages enthalten`, view);
      if ((c.returns ?? []).some((id) => (c.asyncMessages ?? []).includes(id))) fail2("Nachricht kann nicht zugleich return und async sein", view);
    }
    if (type === "matrix" && ((c.rows ?? nodes).length > 100 || (c.columns ?? nodes).length > 100)) fail2("Matrix maximal 100 Zeilen/Spalten", view);
    if (type === "activity") {
      const lanes = new Set(c.lanes ?? []), tasks = nodes.filter((n) => !lanes.has(n.id));
      for (const n of tasks) if (lanes.size && !lanes.has(value(n, c.laneAttribute ?? "owner"))) fail2(`${n.id}: gültige Lane-Zuordnung fehlt`, view);
      const kinds = [...c.decisions ?? [], ...c.forks ?? [], ...c.joins ?? []];
      if (new Set(kinds).size !== kinds.length) fail2("Aktivität hat mehrere Kontrollknotenarten", view);
      for (const id of c.decisions ?? []) if (edges.filter((e) => e.source === id).length < 2) fail2(`${id}: Entscheidung benötigt mindestens zwei Ausgänge`, view);
      for (const id of c.forks ?? []) if (edges.filter((e) => e.source === id).length < 2) fail2(`${id}: Fork benötigt mindestens zwei Ausgänge`, view);
      for (const id of c.joins ?? []) if (edges.filter((e) => e.target === id).length < 2) fail2(`${id}: Join benötigt mindestens zwei Eingänge`, view);
      for (const e of edges) if (lanes.has(e.source) || lanes.has(e.target)) fail2("Lane-Elemente sind keine Ablaufknoten", view);
    }
    if (["state", "activity"].includes(type)) {
      if (c.initial && (c.finals ?? []).includes(c.initial)) fail2("Initial- und Endknoten müssen verschieden sein", view);
      if (c.initial && edges.some((e) => e.target === c.initial)) fail2("Initialknoten darf keine eingehenden Übergänge haben", view);
      if (edges.some((e) => (c.finals ?? []).includes(e.source))) fail2("Endknoten darf keine ausgehenden Übergänge haben", view);
    }
    if (type === "heatmap") {
      const min = c.min ?? 0, max = c.max ?? 5;
      if (min >= max) fail2("Heatmap benötigt min < max", view);
      if (!c.valueAttribute) fail2("valueAttribute fehlt", view);
      const parents = /* @__PURE__ */ new Map();
      for (const n of nodes) {
        const v = value(n, c.valueAttribute);
        if (v !== void 0 && (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)) fail2(`${n.id}: Heatmap-Wert außerhalb ${min}–${max}`, view);
        const parent = c.parentAttribute ? value(n, c.parentAttribute) : n.parent;
        if (parent !== void 0 && parent !== null) {
          if (!ids.has(parent)) fail2(`${n.id}: Heatmap-Elternteil ist nicht sichtbar`, view);
          parents.set(n.id, parent);
        }
      }
      for (const n of nodes) {
        const seen = /* @__PURE__ */ new Set();
        let p = n.id;
        while (parents.has(p)) {
          if (seen.has(p) || seen.size >= 32) fail2("Heatmap-Hierarchie zyklisch oder zu tief", view);
          seen.add(p);
          p = parents.get(p);
        }
      }
    }
    if (type === "timeline") for (const n of nodes) {
      const start = value(n, c.startAttribute ?? "start"), end = value(n, c.endAttribute ?? "end");
      for (const v of [start, end]) {
        const match = typeof v === "string" && v.match(/^(\d{4}-\d{2}-\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/);
        if (!match || !Number.isFinite(Date.parse(v)) || new Date(Date.parse(match[1])).toISOString().slice(0, 10) !== match[1]) fail2(`${n.id}: gültige ISO-start/end-Werte benötigt`, view);
      }
      if (Date.parse(start) > Date.parse(end)) fail2(`${n.id}: start liegt nach end`, view);
    }
    if (type === "class") {
      const all = members.flatMap((k) => c[k] ?? []), memberIds = new Set(all), byId = new Map(nodes.map((n) => [n.id, n]));
      if (memberIds.size !== all.length) fail2("Detail gehört zu mehreren Bereichen", view);
      for (const id of all) {
        const owner = value(byId.get(id), c.ownerAttribute ?? "owner");
        if (!byId.has(owner) || id === owner || memberIds.has(owner) && !(c.parameters ?? []).includes(id)) fail2(`${id}: gültiger Eigentümer fehlt`, view);
        if ((c.parameters ?? []).includes(id) && ![...c.methods ?? [], ...c.functions ?? []].includes(owner)) fail2(`${id}: Parameter benötigt Methode/Funktion als Eigentümer`, view);
      }
    }
  }
  function scene(graph, theme, prefix) {
    const { nodes, edges, view, profileRules } = graph, c = view.diagram, type = c.type;
    const dark = theme === "dark", bg = dark ? "#111827" : "#fafbfe", text = dark ? "#f1f5f9" : "#1e293b", border = dark ? "#8b9ab2" : "#64748b", muted = dark ? "#b4bfd0" : "#52627a";
    const byId = new Map(nodes.map((n) => [n.id, n])), out = [];
    let width = 900, height = 300;
    const wrap2 = (s, limit) => {
      const measure = (s2) => [...s2].reduce((sum, c2) => sum + (/[MW@%]/.test(c2) ? 1.6 : /[ilI.,:! ]/.test(c2) ? 0.5 : 1), 0);
      const lines = [];
      for (const paragraph of String(s ?? "").split("\n")) {
        let line = "";
        for (const word of paragraph.split(/\s+/)) {
          if (line && measure(line + " " + word) > limit) {
            lines.push(line);
            line = "";
          }
          let part = "";
          for (const ch of word) {
            if (part && measure(part + ch) > limit) {
              lines.push(part);
              part = "";
            }
            part += ch;
          }
          line += (line ? " " : "") + part;
        }
        lines.push(line);
      }
      return lines;
    };
    const label = (s, x, y, w = 200, size = 13, color = text, anchor = "start") => {
      const all = wrap2(s, Math.max(1, Math.floor(w / (size * 0.65)))), lines = all.slice(0, 2);
      if (all.length > 2) lines[1] = lines[1].slice(0, -1) + "…";
      out.push(`<text x="${x}" y="${y}" fill="${color}" font-size="${size}" text-anchor="${anchor}"><title>${esc(s)}</title>${lines.map((s2, i) => `<tspan x="${x}" dy="${i ? size * 1.4 : 0}">${esc(s2)}</tspan>`).join("")}</text>`);
      return lines.length * size * 1.4;
    };
    const rect = (x, y, w, h, fill = bg, opacity = 1, rx = 6) => out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" fill-opacity="${opacity}" stroke="${border}"/>`);
    const path = (d, arrow = false, dashed = false) => out.push(`<path d="${d}" fill="none" stroke="${border}" stroke-width="1.5"${arrow ? ` marker-end="url(#${prefix}-${typeof arrow === "string" ? arrow : "arrow"})"` : ""}${dashed ? ' stroke-dasharray="6 5"' : ""}/>`);
    const card = (n, x, y, w = 220, h = 90, body) => {
      Object.assign(n, { x, y, width: w, height: h });
      const fill = n.backgroundColor ?? (dark ? "#1e293b" : "#ffffff"), opacity = n.backgroundColor ? 0.2 : 1, fg = foreground(composite(fill, bg, opacity));
      out.push(`<g data-node="${esc(n.id)}" data-type="${esc(n.type)}" transform="translate(${x} ${y})"><title>${esc(n.title)}</title>`);
      rect(0, 0, w, h, fill, opacity);
      label(n.type, 14, 22, w - 28, 10, fg);
      label(n.title, 14, 45, w - 28, 14, fg);
      if (body) body(fg);
      out.push("</g>");
      return { x, y, width: w, height: h };
    };
    const edgeLabel = (e, x, y) => {
      rect(x - 80, y - 14, 160, 20, bg, 1, 3);
      label(e.title, x, y, 150, 11, muted, "middle");
    };
    if (type === "sequence") {
      const participants = (c.participants ?? nodes.map((n) => n.id)).map((id) => byId.get(id));
      const messages = (c.messages ?? edges.map((e) => e.id)).map((id) => edges.find((e) => e.id === id));
      const gap = Math.max(280, ...participants.map((n) => n.title.length * 8 + 40));
      width = Math.max(500, participants.length * gap + 160);
      height = 180 + messages.reduce((sum, e) => sum + Math.max(90, Math.min(2, wrap2(e.title, 32).length) * 18 + 50), 0);
      const xs = /* @__PURE__ */ new Map();
      participants.forEach((n, i) => {
        const x = 60 + i * gap;
        xs.set(n.id, x + 110);
        card(n, x, 25, 220, 90);
        path(`M${x + 110} 115 V${height - 25}`, false, true);
      });
      let y = 155;
      messages.forEach((e, i) => {
        const a = xs.get(e.source), b = xs.get(e.target), ret = (c.returns ?? []).includes(e.id), async = (c.asyncMessages ?? []).includes(e.id);
        out.push(`<g data-edge="${esc(e.id)}" data-message="${i + 1}" data-message-kind="${ret ? "return" : async ? "async" : "sync"}">`);
        if (a === b) {
          path(`M${a} ${y} h65 v35 h-65`, !async, ret);
          if (async) path(`M${a + 10} ${y + 29} L${a} ${y + 35} l10 6`);
          label(`${i + 1}. ${e.title}`, a + 10, y - 12, 220, 12);
        } else {
          path(`M${a} ${y} H${b}`, !async, ret);
          if (async) path(`M${b + (b > a ? -10 : 10)} ${y - 6} L${b} ${y} l${b > a ? -10 : 10} 6`);
          label(`${i + 1}. ${e.title}`, (a + b) / 2, y - 15, Math.abs(b - a) - 25, 12, text, "middle");
        }
        if (!ret && !async) rect(b - 4, y, 8, 35, dark ? "#64748b" : "#cbd5e1", 1, 0);
        out.push("</g>");
        y += Math.max(90, Math.min(2, wrap2(e.title, 32).length) * 18 + 50);
      });
    } else if (type === "matrix") {
      const rows = (c.rows ?? nodes.map((n) => n.id)).map((id) => byId.get(id)), cols = (c.columns ?? nodes.map((n) => n.id)).map((id) => byId.get(id));
      const cell = 110, left = 240, top = 130;
      width = left + cols.length * cell + 40;
      height = top + rows.length * 70 + 60;
      cols.forEach((n, i) => label(n.title, left + i * cell + cell / 2, 35, cell - 12, 12, text, "middle"));
      rows.forEach((n, r) => {
        label(n.title, 10, top + r * 70 + 30, left - 25, 12);
        cols.forEach((m, k) => {
          const matching = edges.filter((e) => e.source === n.id && e.target === m.id && (!c.relations || matches(e.type, c.relations, profileRules.relationTypes)));
          const x = left + k * cell, y = top + r * 70;
          rect(x, y, cell, 70, matching.length ? dark ? "#134e4a" : "#ccfbf1" : bg, 1, 0);
          out.push(`<g data-cell="${esc(n.id)}:${esc(m.id)}"><title>${esc(matching.map((e) => `${e.type}: ${e.title}`).join("\n") || "No relationship")}</title>`);
          label(matching.length || "·", x + cell / 2, y + 40, cell, 16, text, "middle");
          out.push("</g>");
        });
      });
      label("Rows → columns · number of directed relationships", 10, height - 15, width - 20, 12, muted);
    } else if (type === "heatmap") {
      const parent = (n) => c.parentAttribute ? value(n, c.parentAttribute) : n.parent, children = (id) => nodes.filter((n) => (parent(n) ?? null) === id);
      const leaves = (n) => Math.max(1, children(n.id).reduce((sum, k) => sum + leaves(k), 0));
      const levels = (n) => 1 + Math.max(0, ...children(n.id).map(levels));
      const roots = children(null);
      width = Math.max(600, roots.reduce((sum, n) => sum + leaves(n) * 250, 0) + 40);
      height = Math.max(270, ...roots.map((n) => levels(n) * 110 + 140));
      const mix = (a, b, t) => composite(b, a, t), min = c.min ?? 0, max = c.max ?? 5;
      const tile = (n, x2, y, w, h, backdrop = bg) => {
        const v = value(n, c.valueAttribute), fill = v === void 0 ? dark ? "#64748b" : "#94a3b8" : mix(c.colorLow ?? "#fee2e2", c.colorHigh ?? "#16a34a", (v - min) / (max - min)), fg = foreground(composite(fill, backdrop, 0.2));
        out.push(`<g data-tile="${esc(n.id)}"><title>${esc(n.title)}: ${esc(v ?? "No value")}</title>`);
        rect(x2, y, w, h, fill, 0.2);
        label(`${n.title} · ${v ?? "—"}`, x2 + 12, y + 25, w - 24, 13, fg);
        out.push("</g>");
        let cx = x2 + 12;
        for (const k of children(n.id)) {
          const kw = (w - 24) * leaves(k) / leaves(n);
          tile(k, cx, y + 45, kw - 8, h - 57, composite(fill, backdrop, 0.2));
          cx += kw;
        }
      };
      let x = 20;
      for (const n of roots) {
        const w = leaves(n) * 250;
        tile(n, x, 20, w - 15, height - 105);
        x += w;
      }
      for (let i = 0; i <= 10; i++) rect(25 + i * 28, height - 55, 28, 18, mix(c.colorLow ?? "#fee2e2", c.colorHigh ?? "#16a34a", i / 10), 0.2, 0);
      label(`${min} → ${max} · — = no value`, 25, height - 12, 450, 12, muted);
    } else if (type === "timeline") {
      const data = nodes.map((n) => ({ n, start: Date.parse(value(n, c.startAttribute ?? "start")), end: Date.parse(value(n, c.endAttribute ?? "end")) }));
      const min = Math.min(...data.map((d) => d.start), 0 === data.length ? 0 : Infinity), max = Math.max(min + 864e5, ...data.map((d) => d.end));
      width = 1200;
      height = 130 + data.length * 90;
      const scale = (t) => 260 + (t - min) / (max - min) * 850, ys = /* @__PURE__ */ new Map();
      for (let i = 0; i <= 5; i++) {
        const x = 260 + i * 170;
        path(`M${x} 65 V${height - 25}`, false, true);
        label(new Date(min + (max - min) * i / 5).toISOString().slice(0, 10), x, 35, 140, 11, text, "middle");
      }
      data.forEach(({ n, start, end }, i) => {
        const y = 85 + i * 90;
        ys.set(n.id, y + 20);
        label(n.title, 10, y + 20, 230, 13);
        out.push(`<g data-bar="${esc(n.id)}"><title>${esc(n.title)}: ${esc(value(n, c.startAttribute ?? "start"))} – ${esc(value(n, c.endAttribute ?? "end"))}</title>`);
        const x = scale(start), w = scale(end) - x;
        if (!w) out.push(`<path d="M${x} ${y} l12 20 -12 20 -12 -20Z" fill="${text}"/>`);
        else rect(x, y, w, 40, n.backgroundColor ?? "#6366f1", 0.2);
        out.push("</g>");
        label(new Date(start).toISOString().slice(0, 10), x, y + 60, 160, 10, muted);
      });
      for (const e of edges) {
        const a = data.find((d) => d.n.id === e.source), b = data.find((d) => d.n.id === e.target);
        if (a && b) path(`M${scale(a.end)} ${ys.get(e.source)} H${scale(a.end) + 15} V${ys.get(e.target)} H${scale(b.start)}`, true);
      }
    } else if (type === "class") {
      const memberIds = new Set(members.flatMap((k) => c[k] ?? [])), classes = nodes.filter((n) => !memberIds.has(n.id)), pos = /* @__PURE__ */ new Map(), portPositions = /* @__PURE__ */ new Map();
      const owner = (n) => value(n, c.ownerAttribute ?? "owner"), signature = (n) => value(n, c.signatureAttribute ?? "signature") ?? n.title;
      const memberText = (m) => {
        const params = (c.parameters ?? []).map((id) => byId.get(id)).filter((p) => owner(p) === m.id).map(signature).join(", ");
        const s = String(signature(m));
        return params ? s.includes("()") ? s.replace("()", `(${params})`) : `${s} (${params})` : s;
      };
      const cardWidth = 380, cardBorder = dark ? "#37465d" : "#dce3ed";
      const sectionColor = dark ? "#a9b6cc" : "#66758c";
      const symbols = { attributes: "−", methods: "ƒ", functions: "ƒ", interfaces: "◇", ports: "□" };
      let x = 30;
      height = 220;
      for (const n of classes) {
        const sections = members.filter((k) => k !== "parameters").map((kind) => ({ kind, items: (c[kind] ?? []).map((id) => byId.get(id)).filter((m) => owner(m) === n.id) })).filter((s) => s.items.length);
        const lines = sections.map((s) => ({ ...s, rows: s.items.map((m) => ({ id: m.id, full: memberText(m), lines: wrap2(memberText(m), 32) })) }));
        const ownPorts = (c.ports ?? []).map((id) => byId.get(id)).filter((p) => owner(p) === n.id);
        const h = Math.max(148, 90 + ownPorts.length * 24, 110 + lines.reduce((sum, s) => sum + 50 + s.rows.reduce((count, r) => count + r.lines.length * 21, 0), 0));
        const fill = n.backgroundColor ?? (dark ? "#1e293b" : "#ffffff"), opacity = n.backgroundColor ? 0.2 : 1;
        const visible = composite(fill, bg, opacity), fg = n.backgroundColor ? foreground(visible) : text;
        const subdued = n.backgroundColor ? fg : sectionColor;
        const accent = n.accent && contrast(n.accent, visible) >= 4.5 ? n.accent : n.backgroundColor ? fg : dark ? "#a5b4fc" : "#6366f1";
        Object.assign(n, { x, y: 40, width: cardWidth, height: h });
        pos.set(n.id, { x, y: 40, width: cardWidth, height: h });
        out.push(`<g data-node="${esc(n.id)}" data-type="${esc(n.type)}" data-class-card="true" transform="translate(${x} 40)"><title>${esc(n.title)}</title>`);
        out.push(`<rect width="${cardWidth}" height="${h}" rx="16" fill="${fill}" fill-opacity="${opacity}" stroke="${cardBorder}" filter="url(#${prefix}-class-shadow)"/>`);
        out.push(`<path d="M16 1 H${cardWidth - 16} Q${cardWidth - 1} 1 ${cardWidth - 1} 16 V95 H1 V16 Q1 1 16 1Z" fill="${accent}" fill-opacity="0.055"/>`);
        out.push(`<rect x="20" y="18" width="26" height="26" rx="7" fill="${accent}" fill-opacity="0.1"/><g font-family="ui-monospace,SFMono-Regular,Consolas,monospace" font-weight="600">`);
        label("{}", 33, 36, 24, 12, accent, "middle");
        out.push('</g><g font-weight="600" letter-spacing="1">');
        label(String(n.stereotype ?? n.type).toUpperCase(), 58, 35, cardWidth - 80, 10, subdued);
        out.push('</g><g font-weight="650">');
        label(n.title, 20, 65, cardWidth - 40, 18, fg);
        out.push("</g>");
        let y = 116;
        for (const s of lines) {
          out.push(`<g data-compartment="${s.kind}"><title>${esc(s.items.map(memberText).join("\n"))}</title>`);
          out.push(`<path d="M20 ${y - 16} H${cardWidth - 20}" fill="none" stroke="${cardBorder}" stroke-width="0.8"/>`);
          out.push('<g font-weight="600" letter-spacing="1.2">');
          label(s.kind.toUpperCase(), 22, y, cardWidth - 85, 9.5, subdued);
          out.push("</g>");
          out.push(`<rect x="${cardWidth - 47}" y="${y - 12}" width="25" height="17" rx="8.5" fill="${subdued}" fill-opacity="0.08"/>`);
          label(s.items.length, cardWidth - 34.5, y, 22, 9, subdued, "middle");
          y += 30;
          for (const row of s.rows) {
            out.push(`<g data-member="${esc(row.id)}"><title>${esc(row.full)}</title>`);
            label(symbols[s.kind], 24, y, 16, 12, accent);
            out.push('<g font-family="ui-monospace,SFMono-Regular,Consolas,monospace">');
            for (const line of row.lines) {
              label(line, 46, y, cardWidth - 68, 12.5, fg);
              y += 21;
            }
            out.push("</g></g>");
          }
          y += 20;
          out.push("</g>");
        }
        out.push("</g>");
        ownPorts.forEach((p, index) => {
          const py = 64 + index * 24;
          out.push(`<g data-port="${esc(p.id)}"><title>${esc(p.title)}</title><rect x="${x + cardWidth - 6}" y="${py - 6}" width="12" height="12" rx="3" fill="${dark ? "#1e293b" : "#ffffff"}" stroke="${accent}" stroke-width="1.5"/><circle cx="${x + cardWidth}" cy="${py}" r="2" fill="${accent}"/></g>`);
          portPositions.set(p.id, { x: x + cardWidth, y: py });
        });
        x += 470;
        height = Math.max(height, h + 120);
      }
      width = Math.max(500, x);
      for (const e of edges) {
        const a = pos.get(e.source), b = pos.get(e.target), pa = portPositions.get(e.source), pb = portPositions.get(e.target);
        if ((a || pa) && (b || pb)) {
          const start = pa ?? { x: a.x + a.width, y: a.y + 56 }, end = pb ?? { x: b.x, y: b.y + 56 };
          path(`M${start.x} ${start.y} L${end.x} ${end.y}`, ["generalization", "realization"].includes(e.style) ? "triangle" : !["association", "composition"].includes(e.style), ["dependency", "realization"].includes(e.style));
          edgeLabel(e, (start.x + end.x) / 2, 25);
        }
      }
    } else {
      const laneIds = c.lanes ?? [], tasks = nodes.filter((n) => !laneIds.includes(n.id)), pos = /* @__PURE__ */ new Map();
      const lanes = laneIds.length ? laneIds : [null];
      width = Math.max(850, lanes.length * 330 + 160);
      height = 130 + tasks.length * 145;
      lanes.forEach((id, i) => {
        if (id) {
          rect(25 + i * 330, 20, 320, height - 45, bg, 1, 0);
          label(byId.get(id).title, 40 + i * 330, 48, 290, 14);
          path(`M${25 + i * 330} 65 h320`);
        }
      });
      tasks.forEach((n, i) => {
        const lane = laneIds.length ? lanes.indexOf(value(n, c.laneAttribute ?? "owner")) : 0, x = laneIds.length ? 65 + lane * 330 : Math.max(80, width / 2 - 110), y = 95 + i * 145;
        pos.set(n.id, { x, y, width: 220, height: 80, inY: y + (n.id === c.initial ? 29 : (c.finals ?? []).includes(n.id) ? 20 : [...c.forks ?? [], ...c.joins ?? []].includes(n.id) ? 30 : 0), outY: y + (n.id === c.initial ? 51 : (c.finals ?? []).includes(n.id) ? 60 : [...c.forks ?? [], ...c.joins ?? []].includes(n.id) ? 42 : 80) });
        out.push(`<g data-state="${esc(n.id)}">`);
        if (n.id === c.initial || (c.finals ?? []).includes(n.id)) {
          out.push(`<circle cx="${x + 110}" cy="${y + 40}" r="${n.id === c.initial ? 11 : 15}" fill="${text}"/>`);
          if (n.id !== c.initial) out.push(`<circle cx="${x + 110}" cy="${y + 40}" r="20" fill="none" stroke="${text}"/>`);
          label(n.title, x + 140, y + 44, 110, 11);
        } else if ((c.decisions ?? []).includes(n.id)) {
          out.push(`<path d="M${x + 110} ${y} l100 40 -100 40 -100 -40Z" fill="${bg}" stroke="${border}"/>`);
          label(n.title, x + 110, y + 44, 150, 12, text, "middle");
        } else if ([...c.forks ?? [], ...c.joins ?? []].includes(n.id)) {
          rect(x, y + 30, 220, 12, text, 1, 0);
          label(n.title, x, y + 70, 220, 11);
        } else card(n, x, y, 220, 80);
        out.push("</g>");
      });
      edges.forEach((e, index) => {
        const a = pos.get(e.source), b = pos.get(e.target);
        if (!a || !b) return;
        out.push(`<g data-edge="${esc(e.id)}">`);
        if (e.source === e.target) {
          path(`M${a.x + 220} ${a.y + 20} h45 v50 h-45`, true);
          edgeLabel(e, a.x + 300, a.y + 45);
        } else if (b.y > a.y) {
          const y = (a.outY + b.inY) / 2;
          path(`M${a.x + 110} ${a.outY} V${y} H${b.x + 110} V${b.inY}`, true);
          if (e.title) edgeLabel(e, (a.x + b.x) / 2 + 110, y - 4);
        } else {
          const x = 25 + index % 3 * 14;
          path(`M${a.x} ${a.y + 40} H${x} V${b.y + 40} H${b.x}`, true);
          if (e.title) edgeLabel(e, Math.max(110, a.x - 90), (a.y + b.y) / 2 + 40);
        }
        out.push("</g>");
      });
    }
    return { body: out.join(""), width: Math.max(300, width), height: Math.max(180, height) };
  }
  function layoutDiagram(model, profile, view, nodes, edges) {
    const graph = { title: model.title, description: model.description, profile: { id: profile.id, version: profile.version }, profileRules: profile, view, nodes, edges };
    const result = scene(graph, view.theme, "measure");
    graph.bounds = { x: -20, y: -20, width: result.width + 40, height: result.height + 40 };
    return graph;
  }
  function toDiagramSVG(graph, { theme, idPrefix }) {
    const result = scene(graph, theme, idPrefix), bg = theme === "dark" ? "#111827" : "#fafbfe", stroke = theme === "dark" ? "#8b9ab2" : "#64748b";
    return `<svg xmlns="http://www.w3.org/2000/svg" id="${idPrefix}-diagram" data-arch-svg="${theme}" data-diagram="${graph.view.diagram.type}" role="img" aria-labelledby="${idPrefix}-title" width="${result.width + 40}" height="${result.height + 40}" viewBox="-20 -20 ${result.width + 40} ${result.height + 40}" style="max-width:100%;height:auto;font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:${bg}"><title id="${idPrefix}-title">${esc(graph.title)} — ${esc(graph.view.title)}</title><defs><filter id="${idPrefix}-class-shadow" x="-15%" y="-10%" width="130%" height="130%"><feDropShadow dx="0" dy="5" stdDeviation="7" flood-color="#0f172a" flood-opacity="${theme === "dark" ? 0.22 : 0.07}"/></filter><marker id="${idPrefix}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1 L9 5 L1 9Z" fill="${stroke}"/></marker><marker id="${idPrefix}-triangle" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="9" markerHeight="9" orient="auto"><path d="M1 1 L11 6 L1 11Z" fill="${bg}" stroke="${stroke}"/></marker></defs><rect x="-20" y="-20" width="${result.width + 40}" height="${result.height + 40}" fill="${bg}"/>${result.body}</svg>`;
  }

  // src/parser.js
  var dict = () => /* @__PURE__ */ Object.create(null);
  var fail3 = (message, loc, code = "ARCH_VALIDATION") => {
    throw new ArchError(message, loc, code);
  };
  function tokenize(source) {
    const tokens = [];
    let i = 0, line = 1, column = 1;
    const advance = (n) => {
      for (let j = 0; j < n; j++) {
        if (source[i++] === "\n") {
          line++;
          column = 1;
        } else column++;
      }
    };
    while (i < source.length) {
      const c = source[i], loc = { line, column };
      if (/\s/.test(c) || c === ";") {
        advance(1);
        continue;
      }
      if (c === "#" || source.slice(i, i + 2) === "//") {
        while (i < source.length && source[i] !== "\n") advance(1);
        continue;
      }
      if (source.slice(i, i + 2) === "->") {
        tokens.push({ type: "->", value: "->", ...loc });
        advance(2);
        continue;
      }
      if ("{}(),[]".includes(c)) {
        tokens.push({ type: c, value: c, ...loc });
        advance(1);
        continue;
      }
      if (c === '"') {
        let end = i + 1;
        while (end < source.length) {
          if (source[end] === "\\") {
            end += 2;
            continue;
          }
          if (source[end] === '"') break;
          end++;
        }
        if (end >= source.length) fail3("Nicht abgeschlossener String", loc, "ARCH_SYNTAX");
        const raw = source.slice(i, end + 1);
        let value2;
        try {
          value2 = JSON.parse(raw);
        } catch {
          fail3("Ungültiger String oder Escape", loc, "ARCH_SYNTAX");
        }
        if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/u.test(value2) || [...value2].some((char) => {
          const code = char.codePointAt(0);
          return code >= 55296 && code <= 57343;
        }))
          fail3("String enthält ein in SVG ungültiges Unicode-Zeichen", loc, "ARCH_SYNTAX");
        tokens.push({ type: "string", value: value2, ...loc });
        advance(raw.length);
        continue;
      }
      const number = source.slice(i).match(/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
      if (number) {
        const value2 = Number(number[0]);
        if (!Number.isFinite(value2)) fail3("Zahl muss endlich sein", loc);
        tokens.push({ type: "number", value: value2, ...loc });
        advance(number[0].length);
        continue;
      }
      const word = source.slice(i).match(/^[A-Za-z_][A-Za-z0-9_.-]*/);
      if (word) {
        const value2 = word[0].replace(/-$/, (match) => source[i + word[0].length] === ">" ? "" : match);
        tokens.push({ type: "word", value: value2, ...loc });
        advance(value2.length);
        continue;
      }
      fail3(`Unerwartetes Zeichen ${JSON.stringify(c)}`, loc, "ARCH_SYNTAX");
    }
    tokens.push({ type: "eof", value: "", line, column });
    return tokens;
  }
  function parseDocument(source) {
    if (typeof source !== "string") fail3("Quelltext muss ein String sein");
    if (source.length > 2e6) fail3("Quelltext ist größer als 2 MB");
    const tokens = tokenize(source);
    let cursor = 0;
    const peek = () => tokens[cursor];
    const is = (value2) => peek().value === value2;
    const take = () => tokens[cursor++];
    const expect = (value2) => {
      if (!is(value2)) fail3(`Erwartet: ${value2}; gefunden: ${peek().value || "Dateiende"}`, peek(), "ARCH_SYNTAX");
      return take();
    };
    const typed = (type, label = type) => {
      if (peek().type !== type) fail3(`Erwartet: ${label}; gefunden: ${peek().value || "Dateiende"}`, peek(), "ARCH_SYNTAX");
      return take();
    };
    const word = () => typed("word", "Bezeichner").value;
    const text = () => {
      if (!["word", "string"].includes(peek().type)) fail3("String oder Wort erwartet", peek(), "ARCH_SYNTAX");
      return take().value;
    };
    const scalar = () => {
      if (is("[")) {
        take();
        const values = [];
        if (!is("]")) {
          if (is("[")) fail3("Verschachtelte Listen sind nicht erlaubt", peek());
          values.push(scalar());
          while (is(",")) {
            take();
            if (is("[")) fail3("Verschachtelte Listen sind nicht erlaubt", peek());
            values.push(scalar());
            if (values.length > 4e3) fail3("Maximal 4000 Listeneinträge erlaubt", peek());
          }
        }
        expect("]");
        return values;
      }
      if (peek().type === "number" || peek().type === "string") return take().value;
      const value2 = word();
      return value2 === "true" ? true : value2 === "false" ? false : value2;
    };
    const point = () => {
      expect("(");
      const x = typed("number");
      expect(",");
      const y = typed("number");
      expect(")");
      for (const token of [x, y]) if (Math.abs(token.value) > 1e7) fail3("Koordinate außerhalb des Bereichs ±10000000", token);
      return { x: x.value, y: y.value };
    };
    const list = (fn) => {
      const result = [fn()];
      while (is(",")) {
        take();
        result.push(fn());
      }
      return result;
    };
    const block = (fn) => {
      expect("{");
      while (!is("}")) {
        if (peek().type === "eof") fail3("Nicht abgeschlossener Block; erwartet: }", peek(), "ARCH_SYNTAX");
        fn();
      }
      expect("}");
    };
    const property = (object, allowed) => {
      const key = typed("word");
      if (!allowed.includes(key.value)) fail3(`Unbekanntes Attribut: ${key.value}`, key);
      if (Object.hasOwn(object, key.value)) fail3(`Doppeltes Attribut: ${key.value}`, key);
      object[key.value] = text();
    };
    const modelProperty = (object, builtins, relation = false) => {
      const key = typed("word");
      object.attributes ?? (object.attributes = dict());
      object.attributeLocs ?? (object.attributeLocs = dict());
      if (Object.hasOwn(object.attributes, key.value) || (builtins.includes(key.value) || relation && key.value === "type") && Object.hasOwn(object, key.value))
        fail3(`Doppeltes Attribut: ${key.value}`, key);
      object.attributeLocs[key.value] = key;
      if (builtins.includes(key.value) || relation && key.value === "type") object[key.value] = text();
      else object.attributes[key.value] = scalar();
    };
    expect("architecture");
    const model = { title: typed("string", "Architekturtitel").value, description: "", nodes: [], edges: [], views: [] };
    let hasModel = false, hasDescription = false;
    const element = (parent = null, depth = 0) => {
      if (depth > 32) fail3("Packages dürfen maximal 32 Ebenen tief verschachtelt sein", peek());
      const token = typed("word");
      if (token.value === "relation") {
        const edge = { id: word(), source: word(), loc: token };
        expect("->");
        edge.target = word();
        edge.title = typed("string", "Beziehungsbeschriftung").value;
        if (is("{")) block(() => modelProperty(edge, EDGE_PROPERTIES, true));
        model.edges.push(edge);
        return;
      }
      const node = { type: token.value, id: word(), title: typed("string", "Elementtitel").value, parent, loc: token };
      model.nodes.push(node);
      if (is("{")) block(() => {
        if (is("relation") || peek().type === "word" && tokens[cursor + 1]?.type === "word" && tokens[cursor + 2]?.type === "string") element(node.id, depth + 1);
        else modelProperty(node, NODE_PROPERTIES);
      });
    };
    const readView = () => {
      const token = expect("view");
      const view = {
        id: word(),
        title: typed("string", "Ansichtstitel").value,
        places: dict(),
        styles: dict(),
        routes: dict(),
        loc: token
      };
      const seen = /* @__PURE__ */ new Set();
      block(() => {
        const key = typed("word");
        if (["place", "style", "route"].includes(key.value)) {
          const id = word(), collection = view[{ place: "places", style: "styles", route: "routes" }[key.value]];
          if (Object.hasOwn(collection, id)) fail3(`Doppelte ${key.value}-Anweisung: ${id}`, key);
          const item = { loc: key };
          if (key.value === "place") {
            expect("at");
            item.at = point();
            if (is("size")) {
              take();
              item.size = point();
            }
          } else if (key.value === "style") {
            block(() => property(item, ["template", "accent", "icon", "backgroundColor"]));
          } else {
            block(() => {
              const attr = typed("word");
              if (!["from", "to", "via", "curve", "label", "path"].includes(attr.value)) fail3(`Unbekanntes Routing-Attribut: ${attr.value}`, attr);
              if (Object.hasOwn(item, attr.value)) fail3(`Doppeltes Routing-Attribut: ${attr.value}`, attr);
              if (attr.value === "via") item.via = list(point);
              else if (attr.value === "label") item.label = point();
              else if (["from", "to"].includes(attr.value) && is("(")) item[attr.value] = point();
              else item[attr.value] = text();
            });
          }
          collection[id] = item;
        } else {
          if (seen.has(key.value)) fail3(`Doppelte Ansichtseinstellung: ${key.value}`, key);
          seen.add(key.value);
          if (key.value === "diagram") {
            view.diagram = { type: word() };
            if (is("{")) block(() => {
              const option = typed("word");
              if (Object.hasOwn(view.diagram, option.value)) fail3(`Doppelte Diagrammeinstellung: ${option.value}`, option);
              view.diagram[option.value] = scalar();
            });
          } else if (key.value === "include") view.include = list(word);
          else if (key.value === "spacing") view.spacing = typed("number").value;
          else if (["direction", "theme", "viewpoint"].includes(key.value)) view[key.value] = word();
          else fail3(`Unbekannte Ansichtseinstellung: ${key.value}`, key);
        }
      });
      view.direction ?? (view.direction = "right");
      view.theme ?? (view.theme = "light");
      view.spacing ?? (view.spacing = 80);
      model.views.push(view);
    };
    const readConfig = () => {
      const loc = expect("config");
      if (model.config) fail3("Nur ein config-Block ist erlaubt", loc);
      const definition = { id: "inline", nodeTypes: dict(), relationTypes: dict(), viewpoints: dict(), styleGroups: dict() };
      const config = { loc, definition }, seen = /* @__PURE__ */ new Set();
      const once = (object, key, loc2) => {
        if (Object.hasOwn(object, key)) fail3(`Doppelte Profileinstellung: ${key}`, loc2);
      };
      const readAttribute = (attributes2, keyword) => {
        const name = word();
        once(attributes2, name, keyword);
        const rule = dict();
        block(() => {
          const key = typed("word");
          once(rule, key.value, key);
          if (key.value === "enum") rule.enum = list(scalar);
          else if (key.value === "targets") rule.targets = list(text);
          else if (["type", "required", "min", "max", "minLength", "maxLength", "format", "many", "minItems", "maxItems", "uniqueItems"].includes(key.value)) rule[key.value] = scalar();
          else fail3(`Unbekannte Attributregel: ${key.value}`, key);
        });
        attributes2[name] = rule;
      };
      block(() => {
        const key = typed("word");
        if (["type", "relation", "viewpoint", "styleGroup"].includes(key.value)) {
          const name = word(), collection = definition[{ type: "nodeTypes", relation: "relationTypes", viewpoint: "viewpoints", styleGroup: "styleGroups" }[key.value]];
          once(collection, name, key);
          const rule = dict();
          block(() => {
            const attr = typed("word");
            if (attr.value === "attribute" && key.value !== "viewpoint") {
              rule.attributes ?? (rule.attributes = dict());
              readAttribute(rule.attributes, attr);
            } else if (attr.value === "attributes" && key.value !== "viewpoint") {
              once(rule, "attributes", attr);
              rule.attributes = dict();
              block(() => {
                const keyword = expect("attribute");
                readAttribute(rule.attributes, keyword);
              });
            } else if (["incoming", "outgoing"].includes(attr.value) && key.value === "relation") {
              once(rule, attr.value, attr);
              const count = dict();
              block(() => {
                const bound = typed("word");
                once(count, bound.value, bound);
                if (!["min", "max"].includes(bound.value)) fail3("Erwartet: min oder max", bound);
                count[bound.value] = typed("number").value;
              });
              rule[attr.value] = count;
            } else {
              once(rule, attr.value, attr);
              const listKeys = key.value === "type" ? ["contains"] : key.value === "relation" ? ["from", "to"] : ["nodes", "relations", "requiredNodes", "requiredRelations"];
              const scalarKeys = key.value === "type" ? ["extends", "template", "container", "abstract", "icon", "accent", "backgroundColor", "styleGroup"] : key.value === "relation" ? ["extends", "style", "abstract", "allowSelf", "acyclic"] : key.value === "styleGroup" ? ["backgroundColor"] : [];
              if (attr.value === "extends") {
                const parents = list(text);
                rule.extends = parents.length === 1 ? parents[0] : parents;
              } else if (listKeys.includes(attr.value)) rule[attr.value] = list(text);
              else if (scalarKeys.includes(attr.value)) rule[attr.value] = scalar();
              else fail3(`Unbekannte Profilregel: ${attr.value}`, attr);
            }
          });
          collection[name] = rule;
        } else {
          if (seen.has(key.value)) fail3(`Doppelte Profileinstellung: ${key.value}`, key);
          seen.add(key.value);
          if (key.value === "profile") config.profile = text();
          else if (["id", "title", "version", "extends", "defaultRelation", "requireViewpoint"].includes(key.value)) definition[key.value] = scalar();
          else fail3(`Unbekannte config-Einstellung: ${key.value}`, key);
        }
      });
      const hasDefinition = Object.keys(definition.nodeTypes).length || Object.keys(definition.relationTypes).length || Object.keys(definition.viewpoints).length || Object.keys(definition.styleGroups).length || definition.extends;
      if (config.profile && (hasDefinition || [...seen].some((key) => key !== "profile"))) fail3("config profile und Inline-Profildefinition sind Alternativen", loc);
      if (config.profile) delete config.definition;
      model.config = config;
    };
    block(() => {
      if (is("description")) {
        if (hasDescription) fail3("Doppelte Architekturbeschreibung", peek());
        take();
        model.description = text();
        hasDescription = true;
      } else if (is("model")) {
        if (hasModel) fail3("Nur ein model-Block ist erlaubt", peek());
        take();
        block(() => element());
        hasModel = true;
      } else if (is("view")) readView();
      else if (is("config")) readConfig();
      else fail3("Erwartet: model, view, config oder description", peek(), "ARCH_SYNTAX");
    });
    typed("eof", "Dateiende");
    if (!hasModel) fail3("model-Block fehlt");
    if (model.nodes.length > 1e3 || model.edges.length > 4e3) fail3("Maximal 1000 Elemente und 4000 Beziehungen erlaubt");
    if (!model.views.length) model.views.push({
      id: "default",
      title: model.title,
      direction: "right",
      theme: "light",
      spacing: 80,
      places: dict(),
      styles: dict(),
      routes: dict()
    });
    return model;
  }
  function parse(source, options = {}) {
    const model = parseDocument(source);
    model.profile = resolveProfile(model, options);
    for (const edge of model.edges) if (edge.type === void 0 && model.profile.defaultRelation !== null) edge.type = model.profile.defaultRelation;
    validateModel(model);
    return model;
  }
  function validateModel(model, options = {}) {
    if (!model || !Array.isArray(model.nodes) || !Array.isArray(model.edges) || !Array.isArray(model.views) || !model.views.length)
      fail3("Ungültiges Modell; verwende parse(source)");
    const profile = resolveProfile(model, options);
    const ids = /* @__PURE__ */ new Set(), nodes = new Map(model.nodes.map((n) => [n.id, n]));
    for (const item of [...model.nodes, ...model.edges]) {
      if (ids.has(item.id)) fail3(`Doppelte ID: ${item.id}`, item.loc);
      ids.add(item.id);
    }
    for (const node of model.nodes) {
      if (node.parent && !nodes.has(node.parent)) fail3(`Unbekannter Container: ${node.parent}`, node.loc);
      const ancestry = /* @__PURE__ */ new Set([node.id]);
      let parent = nodes.get(node.parent);
      while (parent) {
        if (ancestry.has(parent.id)) fail3(`Zyklische Package-Hierarchie: ${node.id}`, node.loc);
        ancestry.add(parent.id);
        parent = nodes.get(parent.parent);
      }
    }
    for (const edge of model.edges) {
      for (const id of [edge.source, edge.target]) if (!nodes.has(id)) fail3(`Unbekannter Endpunkt: ${id}`, edge.loc);
    }
    const views = /* @__PURE__ */ new Set();
    for (const view of model.views) {
      if (views.has(view.id)) fail3(`Doppelte Ansichts-ID: ${view.id}`, view.loc);
      views.add(view.id);
      if (!["right", "down"].includes(view.direction)) fail3("direction muss right oder down sein", view.loc);
      if (!["light", "dark"].includes(view.theme)) fail3("theme muss light oder dark sein", view.loc);
      if (!Number.isFinite(view.spacing) || view.spacing < 24 || view.spacing > 400) fail3("spacing muss zwischen 24 und 400 liegen", view.loc);
      for (const id of [...view.include ?? [], ...Object.keys(view.places), ...Object.keys(view.styles)])
        if (!nodes.has(id)) fail3(`Unbekanntes Element in Ansicht ${view.id}: ${id}`, view.loc);
      for (const [id, place] of Object.entries(view.places))
        if (place.size && (place.size.x < 160 || place.size.y < 96)) fail3(`Größe von ${id} muss mindestens (160, 96) sein`, place.loc);
      for (const [id, style] of Object.entries(view.styles)) {
        if (style.template !== void 0 && (!TEMPLATES.includes(style.template) || !!profile.nodeTypes[nodes.get(id).type]?.container !== (style.template === "package")))
          fail3(`Ungültiges Template für ${id}: ${style.template}`, style.loc);
        if (style.accent !== void 0 && !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(style.accent)) fail3("accent muss eine Hexfarbe sein", style.loc);
        if (style.backgroundColor !== void 0 && !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(style.backgroundColor)) fail3("backgroundColor muss eine Hexfarbe sein", style.loc);
      }
      const edges = new Set(model.edges.map((e) => e.id));
      for (const [id, route] of Object.entries(view.routes)) {
        if (!edges.has(id)) fail3(`Unbekannte Beziehung: ${id}`, route.loc);
        for (const key of ["from", "to"]) if (typeof route[key] === "string" && !["auto", "top", "right", "bottom", "left"].includes(route[key]))
          fail3(`Unbekannter Port: ${route[key]}`, route.loc);
        if (route.curve !== void 0 && !["orthogonal", "straight", "rounded", "bezier"].includes(route.curve)) fail3(`Unbekannte Kurve: ${route.curve}`, route.loc);
        if (route.curve === "bezier" && route.via && route.via.length !== 2) fail3("bezier benötigt genau zwei Kontrollpunkte", route.loc);
      }
    }
    const diagnostics = profileDiagnostics(model, profile);
    if (diagnostics.length) {
      const first = diagnostics[0], error = new ArchError(first.message, first, first.code);
      error.diagnostics = diagnostics;
      throw error;
    }
    for (const view of model.views) validateDiagramView(model, profile, view);
    return model;
  }
  function validate(sourceOrModel, options = {}) {
    let model, profile;
    try {
      model = typeof sourceOrModel === "string" ? parseDocument(sourceOrModel) : sourceOrModel;
      if (!model || !Array.isArray(model.nodes) || !Array.isArray(model.edges) || !Array.isArray(model.views))
        throw new ArchError("Ungültiges Modell; verwende parse(source)", {}, "ARCH_VALIDATION");
      profile = resolveProfile(model, options);
      validateModel(model, { profile });
      return { valid: true, profile: { id: profile.id, version: profile.version }, diagnostics: [] };
    } catch (error) {
      if (!(error instanceof ArchError)) throw error;
      return {
        valid: false,
        profile: profile ? { id: profile.id, version: profile.version } : null,
        diagnostics: error.diagnostics ?? [{ severity: "error", code: error.code, message: error.message, line: error.line, column: error.column }]
      };
    }
  }

  // src/geometry.js
  var num = (n) => String(Math.round(n * 1e3) / 1e3);
  var pt = (p) => `${num(p.x)} ${num(p.y)}`;
  var fail4 = (message, loc) => {
    throw new ArchError(message, loc, "ARCH_VALIDATION");
  };
  function inspectPath(path, loc) {
    if (typeof path !== "string" || !path.trim() || path.length > 1e5) fail4("Ungültiger SVG-Pfad", loc);
    const pattern = /[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g;
    const tokens = path.match(pattern) ?? [];
    if (path.replace(pattern, "").replace(/[\s,]/g, "") || !/^[Mm]$/.test(tokens[0] ?? "")) fail4("SVG-Pfad muss mit M beginnen und gültige Pfaddaten enthalten", loc);
    const arities = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 };
    const points = [];
    let index = 0, command, current = { x: 0, y: 0 }, start = current, previousControl = null, previousCommand = "";
    while (index < tokens.length) {
      if (/^[A-Za-z]$/.test(tokens[index])) command = tokens[index++];
      else if (!command) fail4("Fehlender SVG-Pfadbefehl", loc);
      const upper = command.toUpperCase(), relative = command !== upper;
      if (upper === "Z") {
        current = start;
        points.push(current);
        previousControl = null;
        previousCommand = upper;
        command = null;
        continue;
      }
      const count = arities[upper], args = tokens.slice(index, index + count).map(Number);
      if (args.length !== count || args.some((n) => !Number.isFinite(n) || Math.abs(n) > 1e7)) fail4("Ungültige Anzahl oder Größe von SVG-Pfadparametern", loc);
      index += count;
      const origin = current;
      const pair = (offset) => ({ x: args[offset] + (relative ? origin.x : 0), y: args[offset + 1] + (relative ? origin.y : 0) });
      if (upper === "H") current = { x: args[0] + (relative ? origin.x : 0), y: origin.y };
      else if (upper === "V") current = { x: origin.x, y: args[0] + (relative ? origin.y : 0) };
      else if (upper === "A") {
        if (args[0] < 0 || args[1] < 0 || ![0, 1].includes(args[3]) || ![0, 1].includes(args[4])) fail4("Ungültige SVG-Bogenparameter", loc);
        current = pair(5);
        const angle = args[2] * Math.PI / 180;
        const dx = (origin.x - current.x) / 2, dy = (origin.y - current.y) / 2;
        const xp = Math.cos(angle) * dx + Math.sin(angle) * dy;
        const yp = -Math.sin(angle) * dx + Math.cos(angle) * dy;
        const correction = args[0] && args[1] ? Math.max(1, Math.hypot(xp / args[0], yp / args[1])) : 0;
        const radius = correction * Math.max(args[0], args[1]) * 2;
        if (!Number.isFinite(radius) || radius > 1e10) fail4("SVG-Bogen überschreitet den unterstützten Koordinatenbereich", loc);
        for (const p of [origin, current]) points.push({ x: p.x - radius, y: p.y - radius }, { x: p.x + radius, y: p.y + radius });
      } else {
        for (let j = 0; j < count; j += 2) points.push(pair(j));
        current = pair(count - 2);
        if (upper === "S" && ["C", "S"].includes(previousCommand) || upper === "T" && ["Q", "T"].includes(previousCommand)) {
          if (previousControl) points.push({ x: origin.x * 2 - previousControl.x, y: origin.y * 2 - previousControl.y });
        }
      }
      if (upper === "M") {
        start = current;
        command = relative ? "l" : "L";
      }
      if (["C", "S", "Q"].includes(upper)) previousControl = pair(count - 4);
      else if (upper === "T" && ["Q", "T"].includes(previousCommand) && previousControl)
        previousControl = { x: origin.x * 2 - previousControl.x, y: origin.y * 2 - previousControl.y };
      else previousControl = null;
      previousCommand = upper;
      points.push(current);
    }
    return points;
  }
  function textLength(text) {
    return [...String(text)].reduce((sum, c) => sum + (/[MWmw@#%&]/.test(c) ? 1 : /[il.,' :!]/.test(c) ? 0.3 : c.codePointAt(0) > 12287 ? 1.15 : /[A-Z]/.test(c) ? 0.76 : c.codePointAt(0) > 767 ? 0.9 : 0.62), 0);
  }
  function wrap(text, width, fontSize = 13) {
    if (!text) return [];
    const result = [];
    for (const paragraph of String(text).split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        if (line && textLength(`${line} ${word}`) * fontSize > width) {
          result.push(line);
          line = "";
        }
        for (const char of word) {
          if (textLength(line + char) * fontSize > width && line) {
            result.push(line);
            line = "";
          }
          line += char;
        }
        line += " ";
      }
      result.push(line.trimEnd());
    }
    return result.map((line) => line.trim());
  }
  var intersects = (a, b, margin = 24) => a.x < b.x + b.width + margin && a.x + a.width + margin > b.x && a.y < b.y + b.height + margin && a.y + a.height + margin > b.y;
  function arrange(items, edges, direction, spacing, places, nodesById) {
    if (!items.length) return;
    const itemIds = new Set(items.map((n) => n.id)), incoming = new Map(items.map((n) => [n.id, /* @__PURE__ */ new Set()]));
    const outgoing = new Map(items.map((n) => [n.id, /* @__PURE__ */ new Set()]));
    const representative = (id) => {
      let node = nodesById.get(id);
      while (node && !itemIds.has(node.id)) node = nodesById.get(node.parent);
      return node?.id;
    };
    for (const edge of edges) {
      const a = representative(edge.source), b = representative(edge.target);
      if (a && b && a !== b) {
        incoming.get(b).add(a);
        outgoing.get(a).add(b);
      }
    }
    const remaining = new Set(itemIds), ranks = new Map(items.map((n) => [n.id, 0]));
    while (remaining.size) {
      const ready = [...remaining].filter((id) => [...incoming.get(id)].every((a) => !remaining.has(a)));
      for (const id of ready.length ? ready : [remaining.values().next().value]) {
        remaining.delete(id);
        for (const target of outgoing.get(id)) if (remaining.has(target)) ranks.set(target, Math.max(ranks.get(target), ranks.get(id) + 1));
      }
    }
    const down = direction === "down", primarySize = down ? "height" : "width", secondarySize = down ? "width" : "height";
    const rankWidths = /* @__PURE__ */ new Map();
    for (const item of items) rankWidths.set(ranks.get(item.id), Math.max(rankWidths.get(ranks.get(item.id)) ?? 0, item[primarySize]));
    const offsets = /* @__PURE__ */ new Map();
    let offset = 0;
    for (const rank of [...rankWidths.keys()].sort((a, b) => a - b)) {
      offsets.set(rank, offset);
      offset += rankWidths.get(rank) + spacing;
    }
    const used = items.filter((n) => places[n.id]).map((n) => Object.assign(n, places[n.id].at));
    const stacks = /* @__PURE__ */ new Map();
    for (const item of items) {
      if (places[item.id]) continue;
      const rank = ranks.get(item.id), primary = offsets.get(rank);
      let secondary = stacks.get(rank) ?? 0;
      const setPosition = () => {
        item.x = down ? secondary : primary;
        item.y = down ? primary : secondary;
      };
      setPosition();
      let collision;
      while (collision = used.find((other) => intersects(item, other))) {
        secondary = (down ? collision.x + collision.width : collision.y + collision.height) + spacing / 2;
        setPosition();
      }
      stacks.set(rank, secondary + item[secondarySize] + spacing / 2);
      used.push(item);
    }
  }
  function port(box, side, other) {
    if (typeof side === "object") return side;
    if (!side || side === "auto") {
      const dx = other.x + other.width / 2 - box.x - box.width / 2;
      const dy = other.y + other.height / 2 - box.y - box.height / 2;
      side = Math.abs(dx) >= Math.abs(dy) ? dx >= 0 ? "right" : "left" : dy >= 0 ? "bottom" : "top";
    }
    return {
      left: { x: box.x, y: box.y + box.height / 2 },
      right: { x: box.x + box.width, y: box.y + box.height / 2 },
      top: { x: box.x + box.width / 2, y: box.y },
      bottom: { x: box.x + box.width / 2, y: box.y + box.height }
    }[side];
  }
  function polyPath(points, rounded) {
    let d = `M ${pt(points[0])}`;
    for (let i = 1; i < points.length; i++) {
      const before = points[i - 1], current = points[i], after = points[i + 1];
      if (!rounded || !after) {
        d += ` L ${pt(current)}`;
        continue;
      }
      const a = Math.hypot(current.x - before.x, current.y - before.y), b = Math.hypot(after.x - current.x, after.y - current.y);
      if (!a || !b) continue;
      const r = Math.min(10, a / 2, b / 2);
      const enter = { x: current.x + (before.x - current.x) * r / a, y: current.y + (before.y - current.y) * r / a };
      const leave = { x: current.x + (after.x - current.x) * r / b, y: current.y + (after.y - current.y) * r / b };
      d += ` L ${pt(enter)} Q ${pt(current)} ${pt(leave)}`;
    }
    return d;
  }
  function middle(points) {
    const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
    let left = lengths.reduce((a, b) => a + b, 0) / 2;
    for (let i = 0; i < lengths.length; i++) {
      if (left <= lengths[i]) {
        const ratio = lengths[i] ? left / lengths[i] : 0;
        return { x: points[i].x + (points[i + 1].x - points[i].x) * ratio, y: points[i].y + (points[i + 1].y - points[i].y) * ratio };
      }
      left -= lengths[i];
    }
    return points[0];
  }
  function routeEdge(edge, source, target, route, parallel) {
    const curve = route.curve ?? "orthogonal";
    let a = port(source, route.from, target), b = port(target, route.to, source), points = [a], d;
    if (route.path !== void 0) {
      const pathPoints = inspectPath(route.path, route.loc);
      return { ...edge, d: route.path, points: pathPoints, label: route.label ?? middle([a, b]) };
    }
    if (route.via) points.push(...route.via);
    else if (source.id === target.id) {
      a = port(source, route.from ?? "right", target);
      b = port(target, route.to ?? "top", source);
      const reach = 48 + parallel * 24;
      points = [a, { x: a.x + reach, y: a.y }, { x: a.x + reach, y: source.y - reach }, { x: b.x, y: source.y - reach }];
    } else if (curve !== "straight") {
      const shift = parallel * 22;
      if (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)) {
        const x = (a.x + b.x) / 2 + shift;
        if (parallel && a.y === b.y) {
          const stub = Math.sign(b.x - a.x || 1) * 24;
          points.push(
            { x: a.x + stub, y: a.y },
            { x: a.x + stub, y: a.y + shift },
            { x: b.x - stub, y: b.y + shift },
            { x: b.x - stub, y: b.y }
          );
        } else points.push({ x, y: a.y }, { x, y: b.y });
      } else {
        const y = (a.y + b.y) / 2 + shift;
        if (parallel && a.x === b.x) {
          const stub = Math.sign(b.y - a.y || 1) * 24;
          points.push(
            { x: a.x, y: a.y + stub },
            { x: a.x + shift, y: a.y + stub },
            { x: b.x + shift, y: b.y - stub },
            { x: b.x, y: b.y - stub }
          );
        } else points.push({ x: a.x, y }, { x: b.x, y });
      }
    } else if (parallel) points.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + parallel * 28 });
    points.push(b);
    if (route.via && ["orthogonal", "rounded"].includes(curve)) {
      const orthogonal = [points[0]];
      for (const next of points.slice(1)) {
        const previous = orthogonal.at(-1);
        if (previous.x !== next.x && previous.y !== next.y) orthogonal.push({ x: next.x, y: previous.y });
        orthogonal.push(next);
      }
      points = orthogonal;
    }
    if (curve === "bezier" && source.id !== target.id) {
      const controls = route.via ?? points.slice(1, 3);
      d = `M ${pt(a)} C ${pt(controls[0])} ${pt(controls[1])} ${pt(b)}`;
    } else d = polyPath(points, curve === "rounded");
    let label = route.label ?? middle(points);
    if (!route.label && curve === "bezier" && source.id !== target.id) {
      const controls = route.via ?? points.slice(1, 3);
      label = {
        x: (a.x + 3 * controls[0].x + 3 * controls[1].x + b.x) / 8,
        y: (a.y + 3 * controls[0].y + 3 * controls[1].y + b.y) / 8
      };
    }
    return { ...edge, d, points, label };
  }
  function layout(model, options = {}) {
    validateModel(model, options);
    const profile = resolveProfile(model, options);
    const view = options.view ? model.views.find((v) => v.id === options.view) : model.views[0];
    if (!view) fail4(`Unbekannte Ansicht: ${options.view}`);
    const visible = visibleNodeIds(model, view);
    const nodes = model.nodes.filter((n) => visible.has(n.id)).map((n) => {
      const definition = profile.nodeTypes[n.type], style = view.styles[n.id] ?? {};
      const template = style.template ?? definition.template;
      const width = view.places[n.id]?.size?.x ?? 220;
      const titleLines = wrap(n.title, width - 40, 15), descLines = wrap(n.description, width - 40, 12);
      const badgeLines = wrap(String(n.stereotype ?? n.type).toUpperCase(), width - 74, 9);
      const technologyLines = wrap(n.technology, width - 40, 10);
      const height = Math.max(
        view.places[n.id]?.size?.y ?? 0,
        96,
        (template === "database" ? 78 : 62) + (titleLines.length - 1) * 20 + Math.max(0, badgeLines.length - 1) * 12 + (descLines.length ? 25 + (descLines.length - 1) * 17 : 0) + (technologyLines.length ? 26 + (technologyLines.length - 1) * 13 : 0) + 22
      );
      return {
        ...n,
        icon: n.icon ?? definition.icon,
        accent: n.accent ?? definition.accent,
        backgroundColor: definition.backgroundColor ?? profile.styleGroups?.[definition.styleGroup]?.backgroundColor,
        ...style,
        container: definition.container,
        template,
        width,
        height,
        titleLines,
        badgeLines,
        descLines,
        technologyLines,
        x: 0,
        y: 0
      };
    });
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const edges = model.edges.filter((e) => visible.has(e.source) && visible.has(e.target)).map((edge) => {
      const type = edge.type ?? profile.defaultRelation;
      return { ...edge, type, style: profile.relationTypes[type].style };
    });
    if (view.diagram && view.diagram.type !== "connected") return layoutDiagram(model, profile, view, nodes, edges);
    const process = (parent) => {
      const children = nodes.filter((n) => n.parent === parent);
      for (const child of children) if (child.container) process(child.id);
      arrange(children, edges, view.direction, view.spacing, view.places, byId);
      if (parent) {
        const box = byId.get(parent);
        const minX2 = Math.min(0, ...children.map((n) => n.x)), minY2 = Math.min(0, ...children.map((n) => n.y));
        box.width = Math.max(box.width, ...children.map((n) => n.x + 28 - minX2 + n.width + 28));
        box.titleLines = wrap(box.title, box.width - 140, 14);
        box.headerHeight = Math.max(56, 28 + box.titleLines.length * 20);
        box.contentOffset = { x: 28 - minX2, y: box.headerHeight + 16 - minY2 };
        box.width = Math.max(box.width, ...children.map((n) => n.x + box.contentOffset.x + n.width + 28));
        box.height = Math.max(box.height, ...children.map((n) => n.y + box.contentOffset.y + n.height + 28));
      }
    };
    process(null);
    const absolute = (parent, x, y) => {
      for (const node of nodes.filter((n) => n.parent === parent)) {
        node.x += x;
        node.y += y;
        if (node.container) absolute(node.id, node.x + node.contentOffset.x, node.y + node.contentOffset.y);
      }
    };
    absolute(null, 0, 0);
    const parallel = /* @__PURE__ */ new Map();
    const routedEdges = edges.map((edge) => {
      const key = [edge.source, edge.target].sort().join("\0"), count = parallel.get(key) ?? 0;
      parallel.set(key, count + 1);
      const result = routeEdge(edge, byId.get(edge.source), byId.get(edge.target), view.routes[edge.id] ?? {}, count);
      result.labelLines = wrap(edge.title, 160, 11);
      result.labelWidth = Math.max(28, ...result.labelLines.map((line) => textLength(line) * 11 + 18));
      result.labelHeight = result.labelLines.length * 15 + 8;
      return result;
    });
    const extents = nodes.flatMap((n) => [{ x: n.x, y: n.y }, { x: n.x + n.width, y: n.y + n.height }]);
    for (const edge of routedEdges) {
      extents.push(...edge.points);
      if (edge.title) extents.push(
        { x: edge.label.x - edge.labelWidth / 2, y: edge.label.y - edge.labelHeight / 2 },
        { x: edge.label.x + edge.labelWidth / 2, y: edge.label.y + edge.labelHeight / 2 }
      );
    }
    const minX = Math.min(0, ...extents.map((p) => p.x)) - 48, minY = Math.min(0, ...extents.map((p) => p.y)) - 48;
    const maxX = Math.max(160, ...extents.map((p) => p.x)) + 48, maxY = Math.max(96, ...extents.map((p) => p.y)) + 48;
    return {
      title: model.title,
      description: model.description,
      profile: { id: profile.id, version: profile.version },
      view,
      nodes,
      edges: routedEdges,
      bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
    };
  }

  // src/icons.js
  var packs = /* @__PURE__ */ new Map();
  var paintDefaults = Object.freeze({
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    linecap: "round",
    linejoin: "round",
    fillRule: "nonzero",
    opacity: 1,
    fillOpacity: 1,
    strokeOpacity: 1
  });
  var paintKeys = Object.keys(paintDefaults);
  function registerIconPack(name, pack) {
    const error = (message) => {
      throw new ArchError(message, {}, "ARCH_ICON");
    };
    if (typeof name !== "string" || !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(name)) error("Ungültiger Iconpack-Name");
    if (!pack || !pack.icons || typeof pack.icons !== "object" || Array.isArray(pack.icons)) error("Iconpack benötigt ein icons-Objekt");
    const result = /* @__PURE__ */ new Map();
    if (Object.keys(pack.icons).length > 2e4) error("Maximal 20000 Icons pro Pack erlaubt");
    for (const [id, icon] of Object.entries(pack.icons)) {
      if (!/^[A-Za-z0-9_][A-Za-z0-9_-]*$/.test(id) || !icon) error(`Ungültiges Icon: ${id}`);
      const width = icon.width ?? pack.width ?? 24, height = icon.height ?? pack.height ?? 24;
      if (![width, height].every((n) => Number.isFinite(n) && n > 0 && n <= 4096)) error(`Ungültige Icongröße: ${id}`);
      if (!Array.isArray(icon.paths) || !icon.paths.length || icon.paths.length > 64) error(`Ungültige paths für Icon: ${id}`);
      const paths = icon.paths.map((path) => {
        const value2 = typeof path === "string" ? { d: path } : path;
        if (!value2 || typeof value2 !== "object" || Object.keys(value2).some((key) => !["d", ...paintKeys].includes(key)))
          error(`Ungültiges Pfadobjekt: ${id}`);
        inspectPath(value2.d);
        const paint = Object.fromEntries(paintKeys.map((key) => [key, value2[key] ?? paintDefaults[key]]));
        for (const key of ["fill", "stroke"]) if (!["none", "currentColor"].includes(paint[key])) error(`Ungültige Iconfarbe: ${id}.${key}`);
        if (!["butt", "round", "square"].includes(paint.linecap) || !["miter", "round", "bevel"].includes(paint.linejoin) || !["nonzero", "evenodd"].includes(paint.fillRule)) error(`Ungültiger Zeichenstil: ${id}`);
        if (!Number.isFinite(paint.strokeWidth) || paint.strokeWidth < 0 || paint.strokeWidth > 64 || ["opacity", "fillOpacity", "strokeOpacity"].some((key) => !Number.isFinite(paint[key]) || paint[key] < 0 || paint[key] > 1))
          error(`Ungültige Strichstärke oder Deckkraft: ${id}`);
        return Object.freeze({ d: value2.d, ...paint });
      });
      result.set(id, Object.freeze({ width, height, paths: Object.freeze(paths) }));
    }
    if (!result.size) error("Iconpack ist leer");
    packs.set(name, result);
  }
  function getIconPacks() {
    return [...packs.keys()];
  }
  function getIcon(name, loc) {
    const [pack, id, ...rest] = String(name).split(".");
    const result = !rest.length && packs.get(pack)?.get(id);
    if (!result) throw new ArchError(`Unbekanntes Icon: ${name}`, loc, "ARCH_ICON");
    return result;
  }
  registerIconPack("core", { icons: {
    person: { paths: ["M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z", "M4 21v-2a8 8 0 0 1 16 0v2"] },
    system: { paths: ["M3 4h18v13H3Z", "M8 21h8M12 17v4M7 8h10M7 12h6"] },
    browser: { paths: ["M3 4h18v16H3ZM3 9h18M7 6.5h.01M10 6.5h.01", "m9 12-3 2 3 2m6-4 3 2-3 2"] },
    service: { paths: ["m12 2 9 5v10l-9 5-9-5V7Z", "m3 7 9 5 9-5M12 12v10M8 4l9 5"] },
    component: { paths: ["M8 3h13v18H8v-4M8 13V9M8 5V3", "M3 5h8v4H3ZM3 13h8v4H3Z"] },
    database: { paths: ["M21 5c0 4-18 4-18 0s18-4 18 0ZM3 5v14c0 4 18 4 18 0V5", "M3 12c0 4 18 4 18 0"] },
    queue: { paths: ["M3 5h18v14H3ZM8 5v14M16 5v14", "m10 10 3 2-3 2"] },
    interface: { paths: ["M16 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0ZM16 12h6M1 12h5"] },
    capability: { paths: ["m12 2 2.8 6 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 8.9 9.2 8Z"] },
    process: { paths: ["M3 5h13l5 7-5 7H3l5-7Z"] },
    artifact: { paths: ["M5 2h9l5 5v15H5ZM14 2v6h5M8 12h8M8 16h6"] },
    node: { paths: ["M3 4h18v16H3ZM3 9h18M7 6.5h.01M7 13h.01M7 17h.01M11 13h6M11 17h6"] },
    package: { paths: ["M3 7V4h7l3 3h8v13H3ZM3 7h18"] },
    cloud: { paths: ["M6 18h12a4 4 0 0 0 0-8 6 6 0 0 0-11-1A5 5 0 0 0 6 18Z"] },
    shield: { paths: ["m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6Z", "m8 12 3 3 5-6"] },
    globe: { paths: ["M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM2 12h20", "M12 2c6 6 6 14 0 20-6-6-6-14 0-20Z"] }
  } });
  var defaultIcon = (type) => `core.${type === "application" ? "browser" : type}`;

  // src/svg.js
  var escape = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
  var serial = 0;
  var accents = {
    person: "#64748b",
    system: "#4f46e5",
    application: "#6366f1",
    service: "#0d9488",
    component: "#8b5cf6",
    database: "#d97706",
    queue: "#db8b22",
    interface: "#0891b2",
    capability: "#9333ea",
    process: "#0284c7",
    artifact: "#64748b",
    node: "#475569",
    package: "#64748b"
  };
  function iconMarkup(name, x, y, size, loc) {
    const icon = getIcon(name, loc), scale = size / Math.max(icon.width, icon.height);
    return `<g data-icon="${escape(name)}" transform="translate(${num(x)} ${num(y)}) scale(${num(scale)})">${icon.paths.map((p) => `<path d="${escape(p.d)}" fill="${p.fill}" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" stroke-linecap="${p.linecap}" stroke-linejoin="${p.linejoin}" fill-rule="${p.fillRule}" opacity="${p.opacity}" fill-opacity="${p.fillOpacity}" stroke-opacity="${p.strokeOpacity}"/>`).join("")}</g>`;
  }
  function renderIconToString(name, { size = 24, title = name } = {}) {
    if (!Number.isFinite(size) || size <= 0 || size > 512) throw new ArchError("Icongröße muss zwischen 0 und 512 liegen");
    const icon = getIcon(name), longest = Math.max(icon.width, icon.height);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${icon.width} ${icon.height}" width="${num(size * icon.width / longest)}" height="${num(size * icon.height / longest)}" role="img" aria-label="${escape(title)}"><title>${escape(title)}</title>${iconMarkup(name, 0, 0, longest)}</svg>`;
  }
  function linesMarkup(lines, x, y, size, color, weight = 400, lineHeight = 17, anchor = "start") {
    return `<text x="${num(x)}" y="${num(y)}" fill="${color}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${lines.map((line, i) => `<tspan x="${num(x)}" dy="${i ? lineHeight : 0}">${escape(line)}</tspan>`).join("")}</text>`;
  }
  function nodeMarkup(node, palette, prefix, backdrop = palette.bg) {
    const { width: w, height: h } = node;
    let accent = node.accent ?? accents[node.template] ?? accents.node;
    if (palette.dark) {
      const hex = accent.slice(1), full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
      accent = "#" + full.match(/../g).map((c) => Math.round(parseInt(c, 16) * 0.62 + 255 * 0.38).toString(16).padStart(2, "0")).join("");
    }
    if (node.backgroundColor) {
      const visibleColor = composite(node.backgroundColor, backdrop, 0.2);
      const text = foreground(visibleColor);
      palette = { ...palette, card: node.backgroundColor, package: node.backgroundColor, text, muted: text, border: text };
      if (contrast(accent, visibleColor) < 4.5 || contrast(accent, composite(accent, visibleColor, 0.1)) < 4.5) accent = text;
    }
    const fillOpacity = node.backgroundColor ? ' fill-opacity="0.2"' : "";
    const title = `<title>${escape(node.title)} — ${escape(node.type)}${node.description ? `: ${escape(node.description)}` : ""}</title>`;
    const attrs = `data-node="${escape(node.id)}" data-type="${escape(node.type)}" data-template="${node.template}" transform="translate(${num(node.x)} ${num(node.y)})"`;
    const iconName = node.icon ?? defaultIcon(node.template);
    if (node.container) {
      return `<g class="arch-package" ${attrs}>${title}
      <rect width="${num(w)}" height="${num(h)}" rx="18" fill="${palette.package}"${fillOpacity} stroke="${palette.border}" stroke-dasharray="5 4"/>
      <path d="M 0 ${num(node.headerHeight)} H ${num(w)}" stroke="${palette.border}"/>
      <g color="${accent}">${iconMarkup(iconName, 20, 17, 22, node.loc)}</g>
      ${linesMarkup(node.titleLines, 53, 32, 14, palette.text, 650, 20)}
      ${linesMarkup([node.type === "package" ? "PACKAGE" : "CONTAINER"], w - 18, 32, 9, palette.muted, 600, 17, "end")}
    </g>`;
    }
    let shape;
    const standard = `<rect x="0.75" y="0.75" width="${num(w - 1.5)}" height="${num(h - 1.5)}" rx="13" fill="${palette.card}"${fillOpacity} stroke="${palette.border}"/>`;
    switch (node.template) {
      case "database":
        shape = `<path d="M1 15 C1 -3 ${num(w - 1)} -3 ${num(w - 1)} 15 V${num(h - 15)} C${num(w - 1)} ${num(h + 3)} 1 ${num(h + 3)} 1 ${num(h - 15)}Z" fill="${palette.card}"${fillOpacity} stroke="${palette.border}"/>
        <path d="M1 15 C1 33 ${num(w - 1)} 33 ${num(w - 1)} 15" fill="none" stroke="${palette.border}"/>`;
        break;
      case "process":
        shape = `<path d="M1 1 H${num(w - 20)} L${num(w - 1)} ${num(h / 2)} L${num(w - 20)} ${num(h - 1)} H1 L13 ${num(h / 2)}Z" fill="${palette.card}"${fillOpacity} stroke="${palette.border}"/>`;
        break;
      case "artifact":
        shape = `<path d="M1 1 H${num(w - 23)} L${num(w - 1)} 23 V${num(h - 1)} H1Z" fill="${palette.card}"${fillOpacity} stroke="${palette.border}"/><path d="M${num(w - 23)} 1 V23 H${num(w - 1)}" fill="none" stroke="${palette.border}"/>`;
        break;
      case "interface":
        shape = standard.replace('rx="13"', 'rx="36"');
        break;
      case "capability":
        shape = standard.replace('rx="13"', 'rx="24"');
        break;
      default:
        shape = standard;
    }
    const extras = {
      system: `<rect x="5" y="5" width="${num(w - 10)}" height="${num(h - 10)}" rx="9" fill="none" stroke="${palette.border}" opacity=".65"/>`,
      component: `<path d="M${num(w - 22)} 18h12v8h-12ZM${num(w - 22)} 31h12v8h-12Z" fill="${palette.card}"${fillOpacity} stroke="${accent}"/>`,
      queue: `<path d="M${num(w - 17)} 14V${num(h - 14)}M${num(w - 12)} 14V${num(h - 14)}" stroke="${accent}" opacity=".35"/>`,
      node: `<circle cx="${num(w - 18)}" cy="22" r="3" fill="${accent}"/>`
    }[node.template] ?? "";
    const top = node.template === "database" ? 34 : 18;
    const textY = top + 44 + Math.max(0, node.badgeLines.length - 1) * 12;
    let descriptionY = textY + (node.titleLines.length - 1) * 20 + 25;
    return `<g class="arch-node" ${attrs} tabindex="0" role="group" aria-label="${escape(`${node.title}, ${node.type}`)}">${title}
    <g filter="url(#${prefix}-shadow)">${shape}</g>${extras}
    <rect x="18" y="${top}" width="27" height="27" rx="7" fill="${accent}" opacity=".1"/>
    <g color="${accent}">${iconMarkup(iconName, 23, top + 5, 17, node.loc)}</g>
    ${linesMarkup(node.badgeLines, 54, top + 18, 9, accent, 650, 12)}
    ${linesMarkup(node.titleLines, 20, textY, 15, palette.text, 650, 20)}
    ${linesMarkup(node.descLines, 20, descriptionY, 12, palette.muted, 400, 17)}
    ${linesMarkup(node.technologyLines, 20, h - 18 - (node.technologyLines.length - 1) * 13, 10, accent, 500, 13)}
  </g>`;
  }
  function toSVG(graph, options = {}) {
    const theme = options.theme ?? graph.view.theme;
    if (!["light", "dark"].includes(theme)) throw new ArchError("theme muss light oder dark sein");
    const prefix = options.idPrefix ?? `arch-${++serial}`;
    if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(prefix)) throw new ArchError("Ungültiges idPrefix");
    if (graph.view.diagram && graph.view.diagram.type !== "connected") return toDiagramSVG(graph, { theme, idPrefix: prefix });
    const palette = theme === "dark" ? { dark: true, bg: "#111827", card: "#1e293b", package: "#162032", border: "#3b4960", text: "#f1f5f9", muted: "#a4b2c7", edge: "#9caac0" } : { bg: "#fafbfe", card: "#ffffff", package: "#f0f3fa", border: "#d8dfec", text: "#1e293b", muted: "#738198", edge: "#94a3b8" };
    const b = graph.bounds;
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node])), backdrops = /* @__PURE__ */ new Map();
    const backdropFor = (node) => {
      if (backdrops.has(node.id)) return backdrops.get(node.id);
      const parent = nodeById.get(node.parent);
      const color = parent ? parent.backgroundColor ? composite(parent.backgroundColor, backdropFor(parent), 0.2) : palette.package : palette.bg;
      backdrops.set(node.id, color);
      return color;
    };
    const definitions = `<defs>
    <filter id="${prefix}-shadow" x="-15%" y="-15%" width="130%" height="145%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#0f172a" flood-opacity=".045"/></filter>
    <marker id="${prefix}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="m1 1 8 4-8 4" fill="none" stroke="${palette.edge}" stroke-width="1.5"/></marker>
    <marker id="${prefix}-triangle" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="9" markerHeight="9" orient="auto"><path d="M1 1 11 6 1 11Z" fill="${palette.bg}" stroke="${palette.edge}"/></marker>
    <marker id="${prefix}-diamond" viewBox="0 0 14 10" refX="1" refY="5" markerWidth="10" markerHeight="8" orient="auto"><path d="m1 5 6-4 6 4-6 4Z" fill="${palette.edge}"/></marker>
  </defs>`;
    const edgePaths = graph.edges.map((edge) => {
      const dash = ["dependency", "realization"].includes(edge.style) ? ' stroke-dasharray="6 5"' : "";
      const start = edge.style === "composition" ? ` marker-start="url(#${prefix}-diamond)"` : "";
      const end = ["association", "composition"].includes(edge.style) ? "" : ` marker-end="url(#${prefix}-${["realization", "generalization"].includes(edge.style) ? "triangle" : "arrow"})"`;
      return `<g class="arch-edge" data-edge="${escape(edge.id)}" data-type="${escape(edge.type)}" data-style="${edge.style}"><title>${escape(edge.title || edge.type)}</title><path d="${escape(edge.d)}" fill="none" stroke="${palette.edge}" stroke-width="1.5" stroke-linejoin="round"${dash}${start}${end}/></g>`;
    }).join("");
    const edgeLabels = graph.edges.filter((e) => e.title).map((edge) => {
      const { x, y } = edge.label;
      return `<g class="arch-edge-label" data-label-for="${escape(edge.id)}"><rect x="${num(x - edge.labelWidth / 2)}" y="${num(y - edge.labelHeight / 2)}" width="${num(edge.labelWidth)}" height="${num(edge.labelHeight)}" rx="5" fill="${palette.bg}" stroke="${palette.border}" stroke-width=".6"/>${linesMarkup(edge.labelLines, x, y - (edge.labelLines.length - 1) * 7.5 + 3.5, 11, palette.muted, 450, 15, "middle")}</g>`;
    }).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" id="${prefix}-diagram" data-arch-svg="${theme}" role="img" aria-labelledby="${prefix}-title ${prefix}-desc" viewBox="${num(b.x)} ${num(b.y)} ${num(b.width)} ${num(b.height)}" width="${num(b.width)}" height="${num(b.height)}" style="max-width:100%;height:auto;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:${palette.bg};color:${palette.text}">
    <title id="${prefix}-title">${escape(graph.title)} — ${escape(graph.view.title)}</title>
    <desc id="${prefix}-desc">${escape(graph.description || `${graph.nodes.length} architecture elements, ${graph.edges.length} relationships`)}</desc>
    ${definitions}<style>#${prefix}-diagram .arch-node{outline:none}#${prefix}-diagram .arch-node:focus>g:first-of-type{filter:none}#${prefix}-diagram .arch-node:focus{outline:2px solid #818cf8;outline-offset:5px;border-radius:12px}</style>
    <rect x="${num(b.x)}" y="${num(b.y)}" width="${num(b.width)}" height="${num(b.height)}" fill="${palette.bg}"/>
    ${graph.nodes.filter((n) => n.container).map((n) => nodeMarkup(n, palette, prefix, backdropFor(n))).join("")}
    ${edgePaths}${graph.nodes.filter((n) => !n.container).map((n) => nodeMarkup(n, palette, prefix, backdropFor(n))).join("")}${edgeLabels}
  </svg>`;
  }

  // src/arch.js
  var version = "0.1.0";
  function renderToString(sourceOrModel, options = {}) {
    const model = typeof sourceOrModel === "string" ? parse(sourceOrModel, options) : sourceOrModel;
    return toSVG(layout(model, options), options);
  }
  function render(target, sourceOrModel, options = {}) {
    const element = typeof target === "string" ? globalThis.document?.querySelector(target) : target;
    if (!element || typeof element.replaceChildren !== "function") throw new ArchError("Gültiges DOM-Zielelement erforderlich");
    const svg = renderToString(sourceOrModel, options);
    const template = element.ownerDocument.createElement("template");
    template.innerHTML = svg;
    element.replaceChildren(template.content.firstElementChild);
    return element.firstElementChild;
  }
  function renderAll(options = {}) {
    const { root = globalThis.document, selector = "pre > code.language-arch, [data-arch]", ...renderOptions } = options;
    if (!root?.querySelectorAll) throw new ArchError("DOM-root für renderAll erforderlich");
    const results = [];
    for (const element of root.querySelectorAll(selector)) {
      const target = element.matches("pre > code") ? element.parentElement : element;
      if (!root.contains(element) || !target || target.dataset.archRendered) continue;
      const source = element.textContent;
      try {
        results.push(render(target, source, renderOptions));
      } catch (error) {
        const pre = target.ownerDocument.createElement("pre");
        pre.className = "arch-error";
        pre.setAttribute("role", "alert");
        pre.textContent = error.message;
        target.replaceChildren(pre);
      }
      target.dataset.archRendered = "true";
    }
    return results;
  }
  function renderMarkdown(markdown, options = {}) {
    if (typeof markdown !== "string") throw new ArchError("Markdown muss ein String sein");
    const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
    const html = [], paragraph = [];
    const flush = () => {
      if (paragraph.length) html.push(`<p>${escape(paragraph.splice(0).join(" "))}</p>`);
    };
    for (let i = 0; i < lines.length; i++) {
      const fence = lines[i].match(/^\s{0,3}(`{3,}|~{3,})\s*([\w-]*)\s*$/);
      if (fence) {
        flush();
        const body = [], opening = i, char = fence[1][0], length = fence[1].length;
        while (++i < lines.length && !new RegExp(`^\\s{0,3}${char}{${length},}\\s*$`).test(lines[i])) body.push(lines[i]);
        if (i >= lines.length) throw new ArchError("Nicht abgeschlossener Markdown-Codeblock", { line: opening + 1, column: 1 });
        if (fence[2] === "arch") html.push(`<figure class="arch-diagram">${renderToString(body.join("\n"), options)}</figure>`);
        else html.push(`<pre><code class="language-${escape(fence[2])}">${escape(body.join("\n"))}</code></pre>`);
      } else if (/^#{1,6} /.test(lines[i])) {
        flush();
        const heading = lines[i].match(/^(#{1,6}) (.*)$/);
        html.push(`<h${heading[1].length}>${escape(heading[2])}</h${heading[1].length}>`);
      } else if (!lines[i].trim()) flush();
      else paragraph.push(lines[i]);
    }
    flush();
    return html.join("\n");
  }
  return __toCommonJS(arch_exports);
})();
