/**
 * Generate VDL Tag Reference HTML document.
 */
const path = require('path');
const fs = require('fs');
const handlebars = require('handlebars');

const MODULES = [
    '../../src/js/vdlx-datagrid/metadata.js',
    '../../src/js/vdlx-datagrid-column/metadata.js',
    '../../src/js/vdlx-datagrid-index-filter/metadata.js',
    '../../src/js/vdlx-datagrid-validate/metadata.js'
];
const TARGET_DIR = path.join(__dirname, '../../target');

let extensions = MODULES
    .map(modFile => {
        let modPath = path.join(__dirname, modFile);
        return require(modPath).default;
    })
    .filter(function (extension) {
        // Filter out documentation ignored extensions
        return !extension.doc || !extension.doc.ignore;
    });

extensions.forEach(function (extension) {
    extension.attributes = extension.attributes
        // Remove attributes that have been marked as doc ignored
        .filter(function (attribute) {
            return !attribute.docIgnore;
        })
        .map(function (attribute) {
            attribute.name = attribute.name.replace(/-/g, '&#8209;');
            if (attribute.expressionVars) {
                attribute.expressionVars.forEach(function (expressionVar) {
                    expressionVar.type = expressionVar.type.replace(/\|/g, '\\|');
                    return expressionVar;
                });
            }
            return attribute;
        })
        // Required attributes come first
        // Naturally sort attribute names
        .sort(function (a, b) {
            if (a.required && !b.required) {
                return -1;
            } else if (!a.required && b.required) {
                return 1;
            } else {
                var aName = a.name ? a.name.toLowerCase() : a.toLowerCase();
                var bName = b.name ? b.name.toLowerCase() : b.toLowerCase();
                if (aName < bName) {
                    return -1;
                } else if (aName > bName) {
                    return 1;
                }
                return 0;
            }
        });
});

let tags = {extensions: extensions, attributeExtensions: []};

module.exports.vdltagsGenerate = function (extensionLoader, targetPath, jsApiScripts) {
    var outputFilename = path.join(targetPath, 'vdlx-datagrid-tags.json');

    return getVdlTags(extensionLoader, jsApiScripts)
        .then(function (tags) {
            var mapFn = function (extension) {
                return {
                    tag: extension.tag,
                    isContainer: extension.isContainer,
                    attributes: extension.attributes,
                    doc: extension.doc,
                    name: extension.name,
                    requiredParent: extension.requiredParent,
                    modifiesDescendants: extension.modifiesDescendants || false,
                    requiredAncestor: extension.requiredAncestor,
                    allowedChildren: extension.allowedChildren
                };
            };
            tags.extensions = tags.extensions.map(mapFn);
            tags.attributeExtensions = tags.attributeExtensions.map(mapFn);

            try {
                fs.writeFileSync(outputFilename, JSON.stringify(tags, null, 4));
            } catch (e) {
                console.error('Failed to write out generated JSON file. ' + e);
            }

        });
};

var outputFilename = path.join(TARGET_DIR, 'vdlx-datagrid-reference.md');
let templateFile = path.join(__dirname, 'templates/vdlx-datagrid-reference.tmpl.md');

var template = handlebars.compile(fs.readFileSync(templateFile, 'utf-8'));

function mapAttributeExpressionProperties(tag) {
    tag.attributes = tag.attributes.map(function (attribute) {
        if (attribute.expression === 'all') {
            attribute.acceptsExpression = true;
        } else if (attribute.expression === 'dynamic') {
            attribute.requiresExpression = true;
        }
        return attribute;
    });
    return tag;
}

tags.extensions = tags.extensions.map(mapAttributeExpressionProperties);
tags.attributeExtensions = tags.attributeExtensions.map(mapAttributeExpressionProperties);

try {
    fs.writeFileSync(outputFilename, template(tags));
} catch (e) {
    console.error('Failed to write out generated MD file. ' + e);
}
