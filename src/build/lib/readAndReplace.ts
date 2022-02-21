import { readFile, writeFile } from 'fs/promises';

async function readAndReplace(filePath: string, find: string, replace: string) {
  let data = await readFile(filePath, 'utf8');

  data = data.replace(find, replace);

  await writeFile(filePath, data);
}

export default readAndReplace;
