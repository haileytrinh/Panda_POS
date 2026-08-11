const gulp = require('gulp');
const jsdoc = require('gulp-jsdoc3');
const fs = require('fs');
const path = require('path');

// Paths
const viewsDir = './views'; // Only target files in the views folder
const tempDir = './temp_js'; // Temporary folder for .js files extracted from .ejs
const docsDir = './docs'; // Output docs

// Extract JavaScript and JSDoc comments from EJS files in the views folder
gulp.task('extract-js', () => {
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  // Process both .ejs and .js files in the views folder
  return gulp.src([`${viewsDir}/**/*.ejs`, `${viewsDir}/**/*.js`])
    .on('data', (file) => {
      const filePath = file.path;

      // Ensure the file has contents and is a text file
      if (file.contents && file.isBuffer()) {
        const content = file.contents.toString('utf8');

        // Extract JavaScript code from <%%> tags in .ejs files
        if (filePath.endsWith('.ejs')) {
          // Match JavaScript code inside <% %> (EJS embedded JS)
          const ejsMatches = content.match(/<%[\s\S]*?%>/g);
          if (ejsMatches) {
            const jsContent = ejsMatches
              .map((match) => match.replace(/<%=?|%>/g, '').trim())
              .join('\n');
            // Write extracted JavaScript to temp .js files
            const tempFilePath = path.join(tempDir, `${path.basename(filePath, '.ejs')}.js`);
            fs.writeFileSync(tempFilePath, jsContent);
          }

          // Match JSDoc comments in the .ejs file (capturing all instances)
          const jsdocMatches = content.match(/\/\*\*[\s\S]*?\*\//g);  // Capture all JSDoc comments
          if (jsdocMatches) {
            const jsdocContent = jsdocMatches.join('\n');  // Join multiple comments
            // Write extracted JSDoc comments to a new file
            const tempFilePathJsdoc = path.join(tempDir, `${path.basename(filePath, '.ejs')}_jsdoc.js`);
            fs.writeFileSync(tempFilePathJsdoc, jsdocContent);
          }
        } else {
          // If it's a .js file, just copy it to the temp folder
          const tempFilePath = path.join(tempDir, path.basename(filePath));
          fs.writeFileSync(tempFilePath, content);
        }
      }
    });
});

// Generate JSDoc for both JS and extracted JS from EJS files in the views folder
gulp.task('jsdoc', (cb) => {
  gulp.src([`${tempDir}/**/*.js`], { read: false }) // Make sure all .js files in the tempDir are processed
    .pipe(jsdoc({
      opts: {
        destination: docsDir,
      },
      templates: {
        default: {
          outputSourceFiles: true,
        },
      },
    }, cb));
});

// Clean up temp files
gulp.task('clean', (done) => {
  fs.rmSync(tempDir, { recursive: true, force: true });
  done();
});

// Combine tasks
gulp.task('generate-docs', gulp.series('extract-js', 'jsdoc', 'clean'));
