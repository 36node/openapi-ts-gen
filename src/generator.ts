import * as changeCase from "change-case";
import * as ts from "typescript";

import * as consts from "./consts";
import * as types from "./types";

export class GeneratorContext {
  doc: any;
  name: string;
  operations: types.Operation[] = [];
  schemas: types.Schema[];
  parameters = new Map<string, any>();

  constructor(name: string, doc: any) {
    this.name = name;
    this.doc = doc;
    this.resolve();
  }

  resolve() {
    this.resolveGlobalParameters();

    this.schemas = Object.entries(this.doc.components?.schemas || {}).map(([name, node]) => {
      return this.resolveSchema(node, { schemaName: name });
    });

    Object.entries(this.doc.paths).forEach(([path, v]) => {
      Object.entries(v).forEach(([v, o]) => {
        this.resolveOperation(path, v, o);
      });
    });
  }

  private resolveSchema(node: any, { schemaName }: any): types.Schema {
    if (node.$ref) {
      return {
        name: schemaName,
        kind: ts.SyntaxKind.TypeReference,
        typeName: node.$ref.split("/").pop(),
      };
    }
    if (node.allOf) {
      // TODO: inline subtypes definition because it is not possible to assign names to to all
      // subtypes.
      const types = [];
      const subSchemas = [];
      node.allOf.forEach((node) => {
        const res = this.resolveSchema(node, { schemaName });
        if (res.schemas) {
          subSchemas.push(...res.schemas);
        }
        types.push(res);
      });
      return {
        name: schemaName,
        kind: ts.SyntaxKind.IntersectionType,
        types,
        schemas: subSchemas,
      };
    }
    if (node.oneOf) {
      const types = [];
      const subSchemas = [];
      node.oneOf.forEach((node) => {
        const schema = this.resolveSchema(node, { schemaName });
        types.push(schema);
        if (schema.schemas) {
          subSchemas.push(...schema.schemas);
        }
      });
      return {
        name: schemaName,
        kind: ts.SyntaxKind.UnionType,
        types,
        schemas: subSchemas,
      };
    }
    if (node.enum) {
      return {
        name: schemaName,
        kind: ts.SyntaxKind.EnumDeclaration,
        enumType: node.type as any,
        items: node.enum,
      };
    }
    if (node.type === "array") {
      const itemSchema = this.resolveSchema(node.items, { schemaName });
      return {
        ...itemSchema,
        name: schemaName,
        repeated: true,
      };
    }
    if (node.type === "object") {
      const { properties, subSchemas } = this.resolveObjectSchema(node, { schemaName });
      return {
        name: schemaName,
        kind: ts.SyntaxKind.ObjectLiteralExpression,
        properties,
        schemas: subSchemas,
      };
    }
    if (node.type === "integer" || node.type === "number") {
      return {
        name: schemaName,
        kind: ts.SyntaxKind.NumericLiteral,
        typeName: "number",
      };
    }
    if (node.type === "string") {
      return {
        name: schemaName,
        kind: ts.SyntaxKind.StringLiteral,
        typeName: "string",
      };
    }
    if (node.type === "boolean") {
      return {
        name: schemaName,
        kind: ts.SyntaxKind.BooleanKeyword,
        typeName: "boolean",
      };
    }
    throw new Error(`${schemaName} resolve failed`);
  }

  private resolveObjectSchema(node: any, { schemaName }: any) {
    const subSchemas = [];
    const properties = new Map<string, types.Property>();
    Object.entries(node.properties || {}).forEach(([propName, propNode]: any) => {
      const schema = this.resolveSchema(propNode, {
        schemaName: changeCase.pascalCase(propName),
      });
      if (!schema) {
        console.warn(`${schemaName}.${propName} not resolved`);
        return;
      }
      const field: types.Property = {
        schema,
        description: propNode.description,
        required: node.required?.includes(propName),
        repeated: node.type === "array",
      };
      if (
        schema.kind === ts.SyntaxKind.ObjectLiteralExpression ||
        schema.kind === ts.SyntaxKind.EnumDeclaration
      ) {
        subSchemas.push(schema);
      }
      properties.set(propName, field);
    });
    return { properties, subSchemas };
  }

  private resolveGlobalParameters() {
    Object.entries(this.doc.components?.parameters || {}).forEach(([name, node]: any) => {
      this.parameters.set(name, node);
    });
  }

  private resolveOperation(path: string, verb: string, node: any) {
    if (!node.operationId) {
      throw new Error(`operation "${verb} ${path}" is missing operationId`);
    }
    const opt: types.Operation = {
      path,
      name: node.operationId,
      summary: node.summary,
      method: verb.toLowerCase(),
      request: changeCase.pascalCase(`${node.operationId}_request`),
      response: this.resolveResponse(verb, node),
      pathParams: [],
      queryParams: [],
    };
    const req: types.ObjectSchema = {
      name: opt.request,
      kind: ts.SyntaxKind.ObjectLiteralExpression,
      properties: new Map(),
      schemas: [],
    };
    if (node.parameters) {
      this.resolveParameters(opt, req, node);
    }
    if (node.requestBody) {
      this.resolveRequestBody(opt, req, node);
    }
    this.operations.push(opt);
    this.schemas.push(req);
  }

  private resolveParameters(opt: types.Operation, req: types.ObjectSchema, node: any) {
    node.parameters.forEach((paramNode) => {
      if (paramNode.$ref) {
        const globalParamType = paramNode.$ref.split("/").pop();
        if (!this.parameters.has(globalParamType)) {
          throw new Error(`${paramNode.$ref} not defined`);
        }
        paramNode = this.parameters.get(globalParamType);
      }
      const schema = this.resolveSchema(paramNode.schema, {
        schemaName: changeCase.pascalCase(paramNode.name),
      });
      const field: types.Property = {
        description: paramNode.description,
        required: paramNode.required,
        default: paramNode.schema.default,
        schema,
      };
      if (
        schema.kind === ts.SyntaxKind.ObjectLiteralExpression ||
        schema.kind === ts.SyntaxKind.EnumDeclaration
      ) {
        req.schemas.push(schema);
      }
      switch (paramNode.in) {
        case "path":
          opt.pathParams.push(paramNode.name);
          break;
        case "query":
          opt.queryParams.push(paramNode.name);
          break;
      }
      req.properties.set(paramNode.name, field);
    });
  }

  private resolveRequestBody(opt: types.Operation, req: types.ObjectSchema, node: any) {
    const schema = this.resolveSchema(node.requestBody.content[consts.MIME_JSON].schema, {
      schemaName: "",
    });
    const bodyField: types.Property = {
      schema,
    };
    req.properties.set("body", bodyField);
    opt.hasBody = true;
  }

  private resolveResponse(verb: string, node: any) {
    const response = getConventionalResponse(verb, node);
    if (!response) {
      return null;
    }
    const { code, resp } = response;
    if (code === "204") {
      return null;
    }
    const { schema } = resp.content[consts.MIME_JSON];
    return this.resolveSchema(schema, { schemaName: "" });
  }
}

function getConventionalResponse(
  method: string,
  node: any
): { code: string; resp: any } | undefined {
  // https://www.w3.org/Protocols/rfc2616/rfc2616-sec9.html
  const conventionalResponse: Record<string, string[]> = {
    get: ["200"],
    post: ["200", "201", "204"],
    put: ["200", "204"],
    patch: ["200", "204"],
    delete: ["200", "202", "204"],
  };
  const codes = conventionalResponse[method];
  if (!codes) {
    throw new Error(`unsupported method ${method}`);
  }
  const entry = Object.entries(node.responses).find(([code, resp]) => codes.includes(code));
  if (!entry) {
    throw new Error(`operation ${node.operationId} should include one of ${codes.join(", ")}`);
  }
  return { code: entry[0], resp: entry[1] };
}
