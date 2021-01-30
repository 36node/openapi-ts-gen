import * as ts from "typescript";

export interface GenerateOptions {
  name: string;
  input: string;
}

export interface GenerateResult {
  version: string;
  files: Array<{ filename: string; content: string }>;
}

export interface Operation {
  path: string;
  name: string;
  summary: string;
  method: string;
  request: string;
  response: Schema | null;
  pathParams: string[];
  queryParams: string[];
  hasBody?: boolean;
}

type UsedSyntaxKind =
  | ts.SyntaxKind.TypeReference
  | ts.SyntaxKind.IntersectionType
  | ts.SyntaxKind.UnionType
  | ts.SyntaxKind.EnumDeclaration
  | ts.SyntaxKind.ObjectLiteralExpression
  | ts.SyntaxKind.NumericLiteral
  | ts.SyntaxKind.StringLiteral
  | ts.SyntaxKind.BooleanKeyword
  | ts.SyntaxKind.StringKeyword
  | ts.SyntaxKind.NumberKeyword;

export interface BaseSchema {
  kind: UsedSyntaxKind;
  name?: string;
  typeName?: string;
  schemas?: Schema[];
  repeated?: boolean;
  required?: boolean;
}

export interface ExtendableSchema {
  schemas?: Schema[];
}

export interface TypeReferenceSchema extends BaseSchema {
  kind: ts.SyntaxKind.TypeReference;
}

export interface IntersectionTypeSchema extends BaseSchema, ExtendableSchema {
  kind: ts.SyntaxKind.IntersectionType;
  types: Schema[];
}

export interface UnionTypeSchema extends BaseSchema, ExtendableSchema {
  kind: ts.SyntaxKind.UnionType;
  types: Schema[];
}

export interface EnumSchema extends BaseSchema {
  kind: ts.SyntaxKind.EnumDeclaration;
  enumType: string | number;
  items: Array<string | number>;
}

export interface ObjectSchema extends BaseSchema, ExtendableSchema {
  kind: ts.SyntaxKind.ObjectLiteralExpression;
  properties: Map<string, Property>;
}

export interface NumericSchema extends BaseSchema {
  kind: ts.SyntaxKind.NumericLiteral;
}

export interface StringSchema extends BaseSchema {
  kind: ts.SyntaxKind.StringLiteral;
}

export interface BoolSchema extends BaseSchema {
  kind: ts.SyntaxKind.BooleanKeyword;
}

export type Schema =
  | TypeReferenceSchema
  | IntersectionTypeSchema
  | UnionTypeSchema
  | EnumSchema
  | ObjectSchema
  | NumericSchema
  | StringSchema
  | BoolSchema;

export type TypeAliasSchemas = IntersectionTypeSchema | UnionTypeSchema;

export interface Property {
  description?: string;
  required?: boolean;
  repeated?: boolean;
  schema: Schema;
  default?: any;
}
