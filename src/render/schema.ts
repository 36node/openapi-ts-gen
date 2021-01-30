import * as ts from "typescript";
import Writer from "code-block-writer";

import * as types from "../types";

export function renderSchemas(ctx: { schemas: types.Schema[] }, writer?: Writer) {
  writer ||= new Writer({ indentNumberOfSpaces: 2 });
  for (const schema of ctx.schemas) {
    switch (schema.kind) {
      case ts.SyntaxKind.EnumDeclaration:
        renderEnumDeclaration(writer, schema);
        break;
      case ts.SyntaxKind.IntersectionType:
      case ts.SyntaxKind.UnionType:
        renderTypeAliasDeclaration(writer, schema);
        break;
      case ts.SyntaxKind.ObjectLiteralExpression:
        renderInterfaceDeclaration(writer, schema);
        break;
      case ts.SyntaxKind.StringLiteral:
        renderStringSchema(writer, schema);
        break;
      case ts.SyntaxKind.NumericLiteral:
        renderNumericSchema(writer, schema);
        break;
      case ts.SyntaxKind.BooleanKeyword:
        renderBooleanKeyword(writer, schema);
        break;
      case ts.SyntaxKind.TypeReference:
        renderTypeReference(writer, schema);
        break;
    }
  }
  return writer.toString();
}

function renderEnumDeclaration(writer: Writer, schema: types.EnumSchema) {
  const items = schema.items.map((item) => ({
    name: schema.enumType === "string" ? item : `${schema.name}_${item}`,
    value: item,
  }));
  writer.write(`export enum ${schema.name}`).block(() => {
    items.forEach((item) => {
      writer.writeLine(`${item.name} = ${JSON.stringify(item.value)},`);
    });
  });
}

function renderInterfaceDeclaration(writer: Writer, schema: types.ObjectSchema) {
  writer.write(`export interface ${schema.name}`).block(() => {
    renderProperties(writer, schema);
  });
  if (schema.schemas?.length > 0) {
    writer.write(`export namespace ${schema.name}`).block(() => {
      renderSchemas(schema as any, writer);
    });
  }
}

function renderTypeAliasDeclaration(writer: Writer, schema: types.TypeAliasSchemas) {
  writer.write(`export type ${schema.name} = `);
  renderTypeAlias(writer, schema);
  writer.newLine();
  if (schema.schemas?.length > 0) {
    writer.write(`export namespace ${schema.name}`).block(() => {
      renderSchemas(schema as any, writer);
    });
  }
}

function renderTypeAlias(writer: Writer, schema: types.TypeAliasSchemas) {
  return schema.types.map((subSchema, i) => {
    switch (subSchema.kind) {
      case ts.SyntaxKind.ObjectLiteralExpression:
        writer
          .block(() => renderProperties(writer, subSchema))
          .conditionalWrite(subSchema.repeated, "[]");
        break;
      case ts.SyntaxKind.EnumDeclaration:
        writer.write(subSchema.name).conditionalWrite(subSchema.repeated, "[]");
        break;
      case ts.SyntaxKind.UnionType:
        renderTypeAlias(writer, subSchema);
        break;
      case ts.SyntaxKind.NumericLiteral:
        writer.write(subSchema.typeName);
        break;
      default:
        writer.write(subSchema.typeName).conditionalWrite(subSchema.repeated, "[]");
        break;
    }
    writer.conditionalWrite(i !== schema.types.length - 1, joiner[schema.kind]);
  });
}

function renderStringSchema(writer: Writer, schema: types.StringSchema) {
  writer.writeLine(`export type ${schema.name} = string`);
}

function renderNumericSchema(writer: Writer, schema: types.NumericSchema) {
  writer.writeLine(`export type ${schema.name} = number`);
}

function renderBooleanKeyword(writer: Writer, schema: types.BoolSchema) {
  writer.writeLine(`export type ${schema.name} = boolean`);
}

function renderTypeReference(writer: Writer, schema: types.TypeReferenceSchema) {
  writer.writeLine(`export type ${schema.name} = ${schema.typeName}`);
}

function renderProperties(writer: Writer, schema: types.ObjectSchema) {
  for (const [propName, prop] of schema.properties) {
    switch (prop.schema.kind) {
      case ts.SyntaxKind.UnionType:
      case ts.SyntaxKind.IntersectionType:
        writer.write(`${propName}: `);
        renderTypeAlias(writer, prop.schema);
        break;
      case ts.SyntaxKind.EnumDeclaration:
      case ts.SyntaxKind.ObjectLiteralExpression:
        writer
          .write(`${propName}: ${schema.name}.${prop.schema.name}`)
          .conditionalWrite(prop.schema.repeated, "[]");
        break;
      case ts.SyntaxKind.TypeReference:
        writer
          .write(`${propName}: ${prop.schema.typeName}`)
          .conditionalWrite(prop.schema.repeated, "[]");
        break;
      case ts.SyntaxKind.StringLiteral:
        writer.write(`${propName}: string`).conditionalWrite(prop.schema.repeated, "[]");
        break;
      case ts.SyntaxKind.NumericLiteral:
        writer.write(`${propName}: number`).conditionalWrite(prop.schema.repeated, "[]");
        break;
      case ts.SyntaxKind.BooleanKeyword:
        writer.write(`${propName}: boolean`).conditionalWrite(prop.schema.repeated, "[]");
        break;
    }
    writer.newLine();
  }
}

const joiner = {
  [ts.SyntaxKind.IntersectionType]: " & ",
  [ts.SyntaxKind.UnionType]: " | ",
};
