#!/usr/bin/env node

const argv = require("minimist")(process.argv.slice(2));

require("dist/lib/index").gen({
  name: argv.name,
  input: argv.input,
  outDir: argv.outDir,
});
