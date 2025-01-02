const readline = require('node:readline');
const fs = require('node:fs');
const path = require('path');

let brands = [];
async function generateBrandCSSForFolder(
  brandCode,
  codeDir,
  fileName,
  isStyleFolder = false,
) {
  const brandDir = fileName
    ? path.join(codeDir, fileName, brandCode)
    : path.join(codeDir, brandCode);
  if (!fs.existsSync(brandDir)) {
    fs.mkdirSync(brandDir);
  }

  const files = await fs.readdirSync(
    fileName ? path.join(codeDir, fileName) : codeDir,
  );

  files
    .filter((file) => file.endsWith('.css'))
    .forEach(async (file) => {
      const relativePath = fileName
        ? path.relative(codeDir, path.join(codeDir, fileName, file))
        : path.relative(codeDir, file);
      const dest = path.join(brandDir, `_${file}`);
      let content = `@import '../${file}';

/* ${brandCode} specific code goes here */

/* Always keep .${brandCode} scope for brand specific override 
Example:
.${brandCode} h2 {
  color: var(--color-token);
}
*/
`;

      if (isStyleFolder) {
        if (file === 'styles.css') {
          content = `@import url('../tokens.css');
@import url('./tokens.css');
@import '../styles.css';

/* ${brandCode} specific style goes here */`;
        } else if (file === 'fonts.css') {
          content = `/* ${brandCode} specific fonts go here */`;
        } else if (file === 'tokens.css') {
          content = await fs.readFileSync(path.join(codeDir, file), 'utf8');
        }
      }

      let fileExists = false;

      try {
        const stats = await fs.statSync(dest);
        if (stats?.isFile()) {
          fileExists = true;
        }
      } catch (err) {
        fileExists = false;
      }

      if (fileExists) {
        console.log(`File ${relativePath} exists  ....\t\t\t[SKIPPED]`);
      } else {
        fs.writeFile(dest, content, (err) => {
          if (err) {
            console.log(`File ${relativePath} created  ....\t\t\t[ERROR]`);
          } else {
            console.log(`File ${relativePath} created  ....\t\t\t[OK]`);
          }
        });
      }
    });
}

async function generateBrandCSSForFolderWithSubFolders(
  brandCode,
  codeDir,
  isStyleFolder = false,
) {
  const files = await fs.readdirSync(codeDir);
  files
    .filter(
      (file) => fs.statSync(path.join(codeDir, file)).isDirectory()
        && !file.startsWith('.'),
    )
    .forEach(async (fileName) => {
      await generateBrandCSSForFolder(
        brandCode,
        codeDir,
        fileName,
        isStyleFolder,
      );
    });
}
async function generateBrandCSSForReact(
  brandCode,
  codeDir,
) {
  const files = await fs.readdirSync(codeDir);
  files.forEach(async (file) => {
    if (file.endsWith('css')) {
      const brandDir = path.join(codeDir, brandCode);

      if (!fs.existsSync(brandDir)) {
        fs.mkdirSync(brandDir);
      }

      const dest = path.join(brandDir, `_${file}`);
      const content = `@import '../${file}';

/* ${brandCode} specific code goes here */

/* Always keep .${brandCode} scope for brand specific override 
Example:
.${brandCode} h2 {
  color: var(--color-token);
}
*/
`;

      let fileExists = false;
      const relativePath = dest;

      try {
        const stats = await fs.statSync(dest);
        if (stats?.isFile()) {
          fileExists = true;
        }
      } catch (err) {
        fileExists = false;
      }

      if (fileExists) {
        console.log(`File ${relativePath} exists  ....\t\t\t[SKIPPED]`);
      } else {
        fs.writeFile(dest, content, (err) => {
          if (err) {
            console.log(`File ${relativePath} created  ....\t\t\t[ERROR]`);
          } else {
            console.log(`File ${relativePath} created  ....\t\t\t[OK]`);
          }
        });
      }
    } else if (fs.statSync(path.join(codeDir, file)).isDirectory() && !brands.includes(file)) {
      generateBrandCSSForReact(brandCode, path.join(codeDir, file));
    }
  });
}

async function generateBrandCSS(brandCode) {
  console.log(`Generating Brand CSS for ${brandCode}...`);

  const currentDir = process.cwd();

  console.log(`Code directory: ${currentDir}`);

  brands = [];
  let brandConfig = {};
  if (fs.existsSync('brand-config.json')) {
    const strData = fs.readFileSync('brand-config.json', { encoding: 'utf8', flag: 'r' });
    console.log('Brand config', strData);
    if (strData) {
      brandConfig = JSON.parse(strData);
      brands = brandConfig.brands;
    }
  }
  if (!brands.includes(brandCode)) {
    brands.push(brandCode);
  }
  fs.writeFileSync('brand-config.json', JSON.stringify({ ...brandConfig, brands }));

  // generate for blocks
  const blocksDir = path.join(currentDir, 'blocks');

  await generateBrandCSSForFolderWithSubFolders(brandCode, blocksDir);

  // generate for templates
  const templatesDir = path.join(currentDir, 'templates');

  await generateBrandCSSForFolderWithSubFolders(brandCode, templatesDir);

  // generate for styles
  const stylesDir = path.join(currentDir, 'styles');

  await generateBrandCSSForFolder(brandCode, stylesDir, null, true);

  // generate for react components
  const reactDir = path.join(currentDir, 'react-app');
  // find all folder where css files are present and generate brand css
  const reactFolders = await fs.readdirSync(reactDir);
  reactFolders
    .filter(
      (file) => fs.statSync(path.join(reactDir, file)).isDirectory()
        && !file.startsWith('.'),
    )
    .forEach(async (folder) => {
      const folderDir = path.join(reactDir, folder);
      // const cssFiles = await fs.readdirSync(folderDir).filter((file) => file.endsWith('.css'));
      // console.log(`CSS Files: ${cssFiles}`);
      // if (cssFiles.length > 0) {
      console.log(`Generating Brand CSS for ${folder}...`);
      await generateBrandCSSForReact(brandCode, folderDir);
      // }
    });
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
rl.question('Enter Brand code:', (brandCode) => {
  console.log(`Brand code entered: ${brandCode}`);

  rl.question('Generate Brand CSS (y/n):', async (agree) => {
    if (agree === 'y' || agree === 'Y') {
      console.log('Generating Brand CSS...');

      await generateBrandCSS(brandCode);
    } else {
      console.log('Brand CSS not generated.');
    }
    rl.close();
  });
});
