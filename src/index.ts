import * as fs from "fs";
import * as changeCase from "change-case";
import * as oai from "./openapi";
import * as pluralize from "pluralize";
import { apiTemplate, indexTemplate, typesTemplate } from "./templates";
import { downloadYaml } from "./download";

import Document = oai.HttpsSpecOpenapisOrgOas30Schema20190402;
import {
  Data,
  FieldDeclaration,
  OperationDeclaration,
  RequestDeclaration,
  SchemaDeclaration,
} from "./types";

export async function gen(name: string, url: string) {
  const doc = await downloadYaml(url);
  const data = resolve(name, doc);
  const apiContent = apiTemplate(data);
  const typesContent = typesTemplate(data);
  return {
    version: doc.info.version,
    files: [
      { name: "version", content: doc.info.version },
      { name: "api.ts", content: apiContent },
      { name: "types.ts", content: typesContent },
      { name: "index.ts", content: indexTemplate(data) },
    ],
  };
}

function resolve(name: string, doc: Document) {
  const res: Data = {
    api: name,
    apis: [],
    components: [],
  };
  Object.entries(doc.paths).forEach(([path, verbs]) => {
    Object.entries(verbs).forEach(([verb, operationNode]) => {
      const { api, components } = resolveOperation(operationNode, { path, verb });
      res.apis.push(api);
      res.components.push(...components);
    });
  });
  Object.entries(doc.components?.schemas || {}).forEach(([name, compDecl]) => {
    const { component } = resolveSchema(name, compDecl);
    res.components.push(component);
  });
  return res;
}

function resolveOperation(optDecl: oai.Operation, { path, verb }) {
  if (!optDecl.operationId) {
    throw new Error("operationId is required");
  }
  const api: OperationDeclaration = {
    path,
    name: optDecl.operationId,
    summary: optDecl.summary,
    method: verb.toLowerCase(),
    request: changeCase.pascalCase(`${optDecl.operationId}_request`),
    response: resolveResponseType(verb, optDecl),
  };
  const components = [];
  const req: RequestDeclaration = { isRequest: true, name: api.request };

  if (optDecl.parameters) {
    const { pathParams, pathFields, queryParams, queryFields } = resolveParameters(
      optDecl.parameters
    );
    if (queryParams.length) {
      req.query = `${api.request}.Query`;
      req.queryFields = queryFields;
    }
    req.pathFields = pathFields;
    api.queryParams = queryParams;
    api.pathParams = pathParams;
  }
  if (optDecl.requestBody) {
    req.body = typeNameFromSchema(optDecl.requestBody.content["application/json"].schema);
    api.hasBody = true;
  }
  components.push(req);
  return { api, components };
}

function resolveSchema(name: string, decl: oai.Schema) {
  const component: SchemaDeclaration = {
    name,
    parents: [],
    description: decl.description,
  };
  if (decl.allOf) {
    decl.allOf.forEach((def) => {
      if (def.$ref) {
        component.parents.push(def.$ref.split("/").pop());
      } else {
        Object.assign(component, resolveObjectDecl(def, { parent: component }));
      }
    });
  } else if (decl.properties) {
    Object.assign(component, resolveObjectDecl(decl, { parent: component }));
  }
  return { component };
}

function resolveParameters(decls: oai.Parameter[]) {
  const pathFields: FieldDeclaration[] = [];
  const queryFields: FieldDeclaration[] = [];
  const pathParams: string[] = [];
  const queryParams: string[] = [];
  decls.forEach((decl) => {
    if (decl.in === "path") {
      pathParams.push(decl.name);
      pathFields.push({
        name: decl.name,
        type: resolveParameterType(decl),
        description: decl.description,
        required: decl.required,
      });
    } else if (decl.in === "query") {
      queryParams.push(decl.name);
      queryFields.push({
        name: decl.name,
        type: resolveParameterType(decl),
        description: decl.description,
        required: decl.required,
      });
    }
  });
  return { pathParams, pathFields, queryParams, queryFields };
}

function resolveResponseType(verb: string, node: oai.Operation) {
  let resp;
  switch (verb) {
    case "get":
    case "patch":
    case "put":
      resp = node.responses["200"] || node.responses["201"];
      break;
    case "post":
      resp = node.responses["201"];
      break;
    case "delete":
      resp = node.responses["204"];
      return "void";
    default:
      throw new Error(
        `Can not handle the http verb "${verb}" of the operation "${node.operationId}"`
      );
  }
  const { type, items, $ref } = resp.content["application/json"].schema;
  if (type === "array" && items) {
    const t = items.$ref.split("/").pop();
    return `${t}[]`;
  }
  if ($ref) {
    return $ref.split("/").pop();
  }
  throw new Error(
    `Can not determine the response type of operation ${node.operationId}'s(${verb})`
  );
}

function resolveObjectDecl(objDecl: oai.Schema, { parent }) {
  const res = { fields: [], subTypes: [], enumTypes: [] };
  Object.entries(objDecl.properties).forEach(([name, propDecl]) => {
    const { field, subTypes, enumTypes } = resolvePropertyDecl(propDecl, {
      name,
      parent,
    });
    Object.assign(field, {
      name,
      description: propDecl.description,
      required: objDecl.required?.includes(name),
    });
    res.fields.push(field);
    res.subTypes.push(...subTypes);
    res.enumTypes.push(...enumTypes);
  });
  return res;
}

function resolvePropertyDecl(decl: oai.NonArraySchemaObject, { name, parent }) {
  const subTypes = [];
  const enumTypes = [];
  const field = {};
  if (decl.$ref) {
    field.type = decl.$ref.split("/").pop();
  } else if (decl.type === "array") {
    if (decl.items.type === "object") {
      const t = { name: changeCase.pascalCase(pluralize.singular(name)) };
      subTypes.push(t);
      field.type = `${parent.name}.${t.name}[]`;
    } else {
      field.type = `${convertType(decl.items.type)}[]`;
    }
  } else if (decl.enum) {
    if (decl.type === "number") {
      field.type = decl.enum.join(" | ");
    } else {
      const e = {
        name: changeCase.pascalCase(name),
        items: reservedEnumItems(decl.enum),
      };
      enumTypes.push(e);
      field.type = `${parent.name}.${e.name}`;
    }
  } else {
    field.type = convertType(decl.type);
  }
  return { field, subTypes, enumTypes };
}

function resolveParameterType(p: oai.Parameter) {
  let type = p.schema.items?.type || p.schema.type;
  if (type === "integer") {
    type = "number";
  }
  if (p.schema.type === "array") {
    return `${type}[]`;
  }
  return type;
}

function convertType(type: string) {
  switch (type) {
    case "integer":
      return "number";
    default:
      return type;
  }
}

function reservedEnumItems(items: string[]) {
  return items.map((item) => {
    if (/^\d/.test(item)) {
      return `_${item}`;
    }
    return item;
  });
}

function typeNameFromSchema(schema: oai.Schema) {
  if (schema.type === "array") {
    return `${schema.items.$ref.split("/").pop()}[]`;
  } else if (schema.$ref) {
    return schema.$ref.split("/").pop();
  }
}
