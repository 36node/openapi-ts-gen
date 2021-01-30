import Writer from "code-block-writer";

export function renderExports(writer?: Writer) {
  writer ||= new Writer({ indentNumberOfSpaces: 2 });
  writer.writeLine(`export * from './client';`);
  writer.writeLine(`export * from './schemas';`);
  return writer.toString();
}
