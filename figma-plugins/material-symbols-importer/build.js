// Inlines icon-names.json into ui.src.html to produce the single-file ui.html
// that Figma's plugin manifest points to. Run: node build.js
var fs = require('fs');
var path = require('path');

var dir = __dirname;
var names = JSON.parse(fs.readFileSync(path.join(dir, 'icon-names.json'), 'utf8'));
var template = fs.readFileSync(path.join(dir, 'ui.src.html'), 'utf8');

var output = template.replace(
  /\/\*__ICON_NAMES__\*\/\[\]\/\*__ICON_NAMES_END__\*\//,
  JSON.stringify(names)
);

if (output === template) {
  throw new Error('Placeholder not found in ui.src.html — build did not inline the icon list.');
}

fs.writeFileSync(path.join(dir, 'ui.html'), output);
console.log('Wrote ui.html with ' + names.length + ' icon names.');
