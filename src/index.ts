import * as fs from "fs";
import * as yaml from "yaml";

import * as types from "./types";
import { GeneratorContext } from "./generator";
import { renderClient, renderSchemas, renderExports } from "./render";

export function gen({ name, input }: types.GenerateOptions): types.GenerateResult {
  let doc: any;
  if (input.endsWith(".json")) {
    doc = JSON.parse(fs.readFileSync(input).toString());
  } else if (input.endsWith(".yml") || input.endsWith(".yaml")) {
    doc = yaml.parse(fs.readFileSync(input).toString());
  }

  const ctx: GeneratorContext = new GeneratorContext(name, doc);

  return {
    version: doc.info.version,
    files: [
      { filename: "client.ts", content: renderClient(ctx) },
      { filename: "schemas.ts", content: renderSchemas(ctx) },
      { filename: "index.ts", content: renderExports() },
    ],
  };
}
