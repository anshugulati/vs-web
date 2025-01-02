const gulp = require('gulp');
const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const postcssImport = require('postcss-import');

// Function to replace @import statements with the content of the imported files
function replaceImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  // use post css to process the content and replace the imports
  postcss([postcssImport()]).process(content, { from: filePath }).then((result) => {
    content = result.css;
    const newFilePath = path.join(path.dirname(filePath), path.basename(filePath).replace(/^_/, ''));
    fs.writeFileSync(newFilePath, content, 'utf-8');
    console.log(`File ${newFilePath} has been updated`);
  }).catch((error) => {
    console.error(`Error processing file ${filePath}:`, error);
  });
}

// Gulp task to process CSS files
function processCSS(filePath) {
  return (done) => {
    replaceImports(filePath);
    if (typeof done === 'function') {
      done();
    }
  };
}

/**
 * Watch for changes in CSS files and process them
 * - If the file is a partial (starts with an underscore), process it
 * - If the file is not a partial it is a main file, look for the partial file in the same directory
 *  and process them
 */
function watchFiles() {
  console.log('Starting to watch CSS files in blocks directory...');
  const watchPatterns = [
    'blocks/**/_*.css',
    'templates/**/_*.css',
    'styles/**/_*.css',
    'blocks/*/*.css',
    'templates/*/*.css',
    'styles/*/*.css',
    'react-app/**/_*.css',
  ];

  gulp.watch(watchPatterns)
    .on('change', (filePath) => {
      console.log('File changed', filePath);
      const fileName = path.basename(filePath);
      if (fileName.startsWith('_')) {
        processCSS(filePath)();
      } else {
        const dir = path.dirname(filePath);
        const directories = fs.readdirSync(dir).filter((file) => fs.statSync(path.join(dir, file)).isDirectory());

        directories.forEach((directory) => {
          const newFilePath = path.join(dir, directory, `_${fileName}`);
          if (fs.existsSync(newFilePath)) {
            processCSS(newFilePath)();
          } else {
            console.log('File does not exist:', newFilePath);
          }
        });
      }
    });
}

function createBrandCSS() {
  console.log('Creating brand CSS...');
  // loop through the files in the path `blocks/**/_*.css` and call processCSS for each file
  return gulp.src(['blocks/**/_*.css', 'templates/**/_*.css', 'styles/**/_*.css', 'react-app/**/_*.css'])
    .pipe(gulp.dest((file) => {
      processCSS(file.path)();
      return file.base;
    }));
}

// Gulp task
gulp.task('default', watchFiles);
gulp.task('createBrandCSS', createBrandCSS);
