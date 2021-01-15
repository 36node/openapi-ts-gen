import * as fs from "fs";
import * as path from "path";

import handlebars from "handlebars";
import * as changeCase from "change-case";

handlebars.registerHelper("camelCase", (s) => changeCase.camelCase(s));
handlebars.registerHelper("capitalCase", (s) => changeCase.capitalCase(s));
handlebars.registerHelper("constantCase", (s) => changeCase.constantCase(s));
handlebars.registerHelper("dotCase", (s) => changeCase.dotCase(s));
handlebars.registerHelper("headerCase", (s) => changeCase.headerCase(s));
handlebars.registerHelper("noCase", (s) => changeCase.noCase(s));
handlebars.registerHelper("paramCase", (s) => changeCase.paramCase(s));
handlebars.registerHelper("pascalCase", (s) => changeCase.pascalCase(s));
handlebars.registerHelper("pathCase", (s) => changeCase.pathCase(s));
handlebars.registerHelper("sentenceCase", (s) => changeCase.sentenceCase(s));
handlebars.registerHelper("snakeCase", (s) => changeCase.snakeCase(s));
handlebars.registerHelper("snakeCase", (s) => changeCase.snakeCase(s));
handlebars.registerHelper(
  "asArrayLiteral",
  (arr) => `[${arr.map((i) => JSON.stringify(i)).join(", ")}]`
);
handlebars.registerHelper("asExtends", (arr) => `extends ${arr.join(", ")}`);
handlebars.registerHelper("isMutate", function (operation, options) {
  return ["post", "put", "patch"].includes(operation.method)
    ? options.fn(this)
    : options.inverse(this);
});
handlebars.registerHelper("isVoid", function (type, options) {
  return type === "void" ? options.fn(this) : options.inverse(this);
});
handlebars.registerHelper("replacePathParameter", (path) => {
  const reg = /\{(\w+)\}/;
  return (
    "/" +
    path
      .split("/")
      .slice(1)
      .map((seg) => {
        if (reg.test(seg)) {
          return seg.replace(reg, (match: string, $1: string) => "${req." + $1 + "}");
        }
        return seg;
      })
      .join("/")
  );
});

export const apiTemplate = handlebars.compile(
  fs.readFileSync(path.join(__dirname, "api.ts.hbs")).toString()
);

export const indexTemplate = handlebars.compile(
  fs.readFileSync(path.join(__dirname, "index.ts.hbs")).toString()
);
export const typesTemplate = handlebars.compile(
  fs.readFileSync(path.join(__dirname, "types.ts.hbs")).toString()
);
