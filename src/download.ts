import * as https from "https";

import { OpenAPIV3 } from "openapi-types";
import * as yaml from "yaml";

export function downloadYaml(url: string): Promise<OpenAPIV3.Document> {
  return new Promise((resolve, reject) => {
    const data = [];

    https
      .get(url, (response) => {
        response
          .on("data", (chunk) => data.push(chunk))
          .on("end", () => resolve(yaml.parse(Buffer.concat(data).toString())));
      })
      .on("error", (err) => {
        console.error(`download failed: ${err.message}`);
        reject(err);
      });
  });
}
