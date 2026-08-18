import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import ts from 'typescript';

const projectRoot = process.cwd();
const sourceRoots = ['src', 'context', 'lib', 'supabase/functions'];
const writeNotes = process.argv.includes('--write');

// Purpose: Recursively lists application-owned TypeScript source files.
function listSourceFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(absolutePath);
    if (!/\.tsx?$/.test(entry.name)) return [];
    if (/\.(test|backup)\.tsx?$/.test(entry.name) || entry.name.endsWith('.d.ts')) return [];
    return [absolutePath];
  });
}

// Purpose: Converts a code identifier into readable words for a purpose note.
function humanizeName(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Purpose: Builds a concise explanation from a function's conventional name.
function describeFunction(name) {
  const descriptions = [
    ['use', 'Provides the %s React hook behavior.'],
    ['handle', 'Handles %s.'],
    ['render', 'Renders %s.'],
    ['get', 'Returns %s.'],
    ['load', 'Loads %s.'],
    ['fetch', 'Fetches %s.'],
    ['create', 'Creates %s.'],
    ['build', 'Builds %s.'],
    ['make', 'Creates %s.'],
    ['generate', 'Generates %s.'],
    ['calculate', 'Calculates %s.'],
    ['compute', 'Calculates %s.'],
    ['estimate', 'Estimates %s.'],
    ['format', 'Formats %s.'],
    ['parse', 'Parses %s.'],
    ['normalize', 'Normalizes %s.'],
    ['validate', 'Validates %s.'],
    ['verify', 'Verifies %s.'],
    ['select', 'Selects %s.'],
    ['filter', 'Filters %s.'],
    ['find', 'Finds %s.'],
    ['sort', 'Sorts %s.'],
    ['map', 'Maps %s.'],
    ['save', 'Saves %s.'],
    ['persist', 'Persists %s.'],
    ['restore', 'Restores %s.'],
    ['update', 'Updates %s.'],
    ['set', 'Sets %s.'],
    ['clear', 'Clears %s.'],
    ['remove', 'Removes %s.'],
    ['open', 'Opens %s.'],
    ['close', 'Closes %s.'],
    ['start', 'Starts %s.'],
    ['stop', 'Stops %s.'],
    ['subscribe', 'Subscribes to %s.'],
    ['sync', 'Synchronizes %s.'],
    ['queue', 'Queues %s.'],
    ['record', 'Records %s.'],
    ['apply', 'Applies %s.'],
    ['resolve', 'Resolves %s.'],
    ['convert', 'Converts %s.'],
    ['clamp', 'Clamps %s to its supported range.'],
  ];

  if (/^(is|has|can|should)[A-Z_]/.test(name)) {
    return `Determines whether ${humanizeName(name)}.`;
  }
  if (/^[A-Z]/.test(name)) {
    return `Renders the ${humanizeName(name)} interface.`;
  }
  for (const [prefix, template] of descriptions) {
    if (name === prefix || name.startsWith(`${prefix}_`) || new RegExp(`^${prefix}[A-Z]`).test(name)) {
      const subject = humanizeName(name.slice(prefix.length)) || 'the requested operation';
      return template.replace('%s', subject);
    }
  }
  if (name === 'handler' || name === 'main') return "Handles this module's primary operation.";
  return `Implements the ${humanizeName(name)} operation.`;
}

// Purpose: Identifies named function-like TypeScript syntax and its comment anchor.
function getNamedFunction(node) {
  if (ts.isFunctionDeclaration(node) && node.name) {
    return { name: node.name.text, anchor: node };
  }
  if (ts.isMethodDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
    return { name: node.name.text, anchor: node };
  }
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.initializer &&
    (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
  ) {
    const statement = node.parent.parent;
    return {
      name: node.name.text,
      anchor: ts.isVariableStatement(statement) ? statement : node,
    };
  }
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.initializer &&
    ts.isCallExpression(node.initializer) &&
    node.initializer.arguments[0] &&
    (ts.isArrowFunction(node.initializer.arguments[0]) ||
      ts.isFunctionExpression(node.initializer.arguments[0]))
  ) {
    const callee = node.initializer.expression.getText();
    if (['useCallback', 'memo', 'React.memo', 'forwardRef', 'React.forwardRef'].includes(callee)) {
      const statement = node.parent.parent;
      return {
        name: node.name.text,
        anchor: ts.isVariableStatement(statement) ? statement : node,
      };
    }
  }
  if (
    ts.isPropertyAssignment(node) &&
    ts.isIdentifier(node.name) &&
    (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
  ) {
    return { name: node.name.text, anchor: node };
  }
  return null;
}

// Purpose: Collects every named function, component, hook, method, and handler.
function collectFunctions(sourceFile) {
  const functions = [];
  const seen = new Set();
  // Purpose: Visits each syntax node while collecting function declarations.
  function visit(node) {
    const match = getNamedFunction(node);
    if (match) {
      const lineStart = sourceFile.getLineStarts()[sourceFile.getLineAndCharacterOfPosition(match.anchor.getStart(sourceFile)).line];
      const key = `${lineStart}:${match.name}`;
      if (!seen.has(key)) {
        seen.add(key);
        functions.push({ ...match, lineStart });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return functions;
}

// Purpose: Checks whether a function already has an immediately preceding purpose note.
function hasPurposeNote(sourceText, lineStart) {
  const before = sourceText.slice(0, lineStart);
  const previousLine = before.split(/\r?\n/).at(-2) ?? '';
  return previousLine.trimStart().startsWith('// Purpose:');
}

const missing = [];
for (const filename of sourceRoots.flatMap((root) => listSourceFiles(path.join(projectRoot, root)))) {
  const sourceText = fs.readFileSync(filename, 'utf8');
  const sourceFile = ts.createSourceFile(
    filename,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filename.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const additions = collectFunctions(sourceFile)
    .filter(({ lineStart }) => !hasPurposeNote(sourceText, lineStart))
    .map(({ name, lineStart }) => {
      const line = sourceText.slice(lineStart, sourceText.indexOf('\n', lineStart));
      const indentation = line.match(/^\s*/)?.[0] ?? '';
      return {
        lineStart,
        note: `${indentation}// Purpose: ${describeFunction(name)}\n`,
        name,
      };
    });

  if (additions.length === 0) continue;
  if (!writeNotes) {
    missing.push(...additions.map(({ name }) => `${path.relative(projectRoot, filename)}: ${name}`));
    continue;
  }

  let updated = sourceText;
  for (const addition of additions.sort((left, right) => right.lineStart - left.lineStart)) {
    updated = updated.slice(0, addition.lineStart) + addition.note + updated.slice(addition.lineStart);
  }
  fs.writeFileSync(filename, updated);
}

if (!writeNotes && missing.length > 0) {
  console.error(`Missing purpose notes for ${missing.length} named functions:\n${missing.join('\n')}`);
  process.exitCode = 1;
} else if (writeNotes) {
  console.log('Added missing purpose notes to application-owned named functions.');
} else {
  console.log('Every application-owned named function has a purpose note.');
}
