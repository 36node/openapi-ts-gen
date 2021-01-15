export interface GenerateOptions {
  name: string;
  input: string;
  outDir: string;
}

export interface Data {
  api: string;
  apis: OperationDeclaration[];
  components: ComponentDeclaration[];
}

export type ComponentDeclaration = SchemaDeclaration | RequestDeclaration;

export interface OperationDeclaration {
  path: string;
  name: string;
  summary?: string;
  method: string;
  request: string;
  response: string;
  queryParams?: string[];
  pathParams?: string[];
  hasBody?: boolean;
}

export interface SchemaDeclaration {
  name: string;
  parents: string[];
  fields?: FieldDeclaration[];
  description?: string;
}

export interface RequestDeclaration {
  name: string;
  isRequest: true;
  query?: string;
  queryFields?: FieldDeclaration[];
  pathFields?: FieldDeclaration[];
  body?: string;
}

export interface FieldDeclaration {
  name: string;
  type: string;
  description: string;
  required: boolean;
}
