#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function main(args) {
  const result = require("../dist/lib/index").gen({
    name: args.name,
    input: args.input,
  });

  const outDir = path.join(process.cwd(), args.out);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir);
  }
  result.files.forEach(({ filename, content }) => {
    fs.writeFileSync(path.join(outDir, filename), content);
  });
}

main(require("minimist")(process.argv.slice(2)));
