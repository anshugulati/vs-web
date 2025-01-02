const readline = require('node:readline');
const fs = require('node:fs');
const path = require('path');
const glob = require('glob');

// function removeBrandCSSForFolder(brandCode, directory) {
//   const blocksDir = path.join(directory, `${brandCode}`);
//   console.log(`Deleting folder: ${blocksDir}`);
//   fs.rmdirSync(blocksDir, { recursive: true });
// }

function removeBrandCSSForFolder(brandCode, directory, subtree = false) {
  // const blocksDir = path.join(directory, `**/${brandCode}`);
  const filePath = subtree ? `**/${brandCode}` : `${brandCode}`;
  const pattern = path.join(directory, filePath);

  glob(pattern, { onlyDirectories: true }, (err, matches) => {
    if (err) {
      console.error(`Error finding directories: ${err}`);
      return;
    }
    matches.forEach((dir) => {
      console.log(`Deleting folder: ${dir}`);
      fs.rmdirSync(dir, { recursive: true });
    });
  });
}

function removeBrandCSS(brandCode) {
  console.log(`Removing Brand CSS for ${brandCode}...`);

  const currentDir = process.cwd();

  console.log(`Code directory: ${currentDir}`);

  // generate for blocks
  const blocksDir = path.join(currentDir, 'blocks');

  removeBrandCSSForFolder(brandCode, blocksDir, true);

  // generate for templates
  const templatesDir = path.join(currentDir, 'templates');

  removeBrandCSSForFolder(brandCode, templatesDir, true);

  // generate for styles
  const stylesDir = path.join(currentDir, 'styles');

  removeBrandCSSForFolder(brandCode, stylesDir);

  // remove for react-app
  const reactDir = path.join(currentDir, 'react-app');

  removeBrandCSSForFolder(brandCode, reactDir, true);

  let brands = [];
  let brandConfig = {};
  if (fs.existsSync('brand-config.json')) {
    const strData = fs.readFileSync('brand-config.json', { encoding: 'utf8', flag: 'r' });
    if (strData) {
      brandConfig = JSON.parse(strData);
      brands = brandConfig.brands;
    }
  }
  if (brands.includes(brandCode)) {
    brands = brands.filter((b) => b !== brandCode);
  }
  fs.writeFileSync('brand-config.json', JSON.stringify({ ...brandConfig, brands }));
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Enter Brand code:', (brandCode) => {
  console.log(`Brand code entered: ${brandCode}`);

  rl.question('Remove Brand CSS (y/n):', async (agree) => {
    if (agree === 'y' || agree === 'Y') {
      console.log('Removing Brand CSS...');

      await removeBrandCSS(brandCode);
    } else {
      console.log('Brand CSS not removed.');
    }
    rl.close();
  });
});
