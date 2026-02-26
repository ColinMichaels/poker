import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const legacyGamesDir = path.resolve(repoRoot, 'legacy/resources/js/Pages/HowTo/games');
const outputPath = path.resolve(repoRoot, 'modern/apps/client/src/content/howto-content.ts');

const order = [
  { id: 'texas-holdem', name: 'Texas Holdem', file: 'TexasHoldem.vue' },
  { id: 'seven-card-stud-high-low', name: 'Seven Card Stud High Low', file: 'SevenCardStudHighLow.vue' },
  { id: 'seven-card-stud', name: 'Seven Card Stud', file: 'SevenCardStud.vue' },
  { id: 'omaha', name: 'Omaha', file: 'Omaha.vue' },
  { id: 'lowball', name: 'Lowball', file: 'Lowball.vue' },
  { id: 'mississippi-stud', name: 'Mississippi Stud', file: 'MississippiStud.vue' },
  { id: 'razz', name: 'Razz', file: 'Razz.vue' },
  { id: 'jacks-or-better', name: 'Jacks or Better', file: 'JacksOrBetter.vue' },
  { id: 'draw-high', name: 'Draw High', file: 'DrawHigh.vue' },
];

const decorativeListLabels = new Set([
  'Pocket Cards',
  'The Turn The River',
  'Flop',
  'Flop The Turn',
  'Flop + Turn',
  'Flop + + River',
]);

const supplementalCardExamplesByGuideId = {
  lowball: [
    {
      label: 'Ace-to-Five Wheel (Best Low)',
      cards: ['5C', '4D', '3H', '2S', 'AC'],
    },
    {
      label: 'Deuce-to-Seven 7-5 Low',
      cards: ['7C', '5D', '4S', '3H', '2D'],
    },
  ],
  'mississippi-stud': [
    {
      label: 'Seven-Card Sample (Best Five: Broadway Straight)',
      cards: ['AS', 'KD', 'QH', 'JC', '10S', '4D', '2C'],
    },
  ],
  razz: [
    {
      label: 'Wheel Low from Seven Cards',
      cards: ['AC', '2D', '3S', '4H', '5C', 'KD', 'QS'],
    },
  ],
  'jacks-or-better': [
    {
      label: 'Openers: Pair of Jacks',
      cards: ['JH', 'JD', '9C', '4S', '2D'],
    },
    {
      label: 'Draw to Royal Flush',
      cards: ['AS', 'KS', 'QS', 'JS', '2C'],
    },
  ],
  'draw-high': [
    {
      label: 'Pat Straight',
      cards: ['9C', '8D', '7H', '6S', '5C'],
    },
    {
      label: 'Made Full House',
      cards: ['KH', 'KD', 'KC', '4S', '4D'],
    },
  ],
};

const cardCodePattern = /^(?:[2-9]|10|[JQKA])[CDHS]$/;

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function cleanText(value) {
  return decodeEntities(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/<\/[a-zA-Z][a-zA-Z0-9-]*/g, ' ')
    .replace(/[<>]/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeListItem(item) {
  return item
    .replace(/\s+Flop(?: \+ Turn| \+ \+ River)?$/g, '')
    .replace(/\s+The Turn The River$/g, '')
    .trim();
}

function extractSlot(source, name) {
  const match = source.match(new RegExp(`<template v-slot:${name}>([\\s\\S]*?)<\\/template>`));
  return match ? match[1] : '';
}

function extractHeadingTitle(headingSlot, fallback) {
  const match = headingSlot.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  return cleanText(match ? match[1] : fallback);
}

function extractHeadingDescription(headingSlot) {
  const match = headingSlot.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  return cleanText(match ? match[1] : '');
}

function extractListItems(slot) {
  const items = [...slot.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((match) =>
    normalizeListItem(cleanText(match[1])),
  );
  const unique = Array.from(new Set(items.filter(Boolean)));

  return unique.filter((item) => {
    if (item.length < 4) {
      return false;
    }
    if (!/[A-Za-z]/.test(item)) {
      return false;
    }
    if (item.includes('</')) {
      return false;
    }
    if (decorativeListLabels.has(item)) {
      return false;
    }
    if (/\b(Hole\s*Cards?|HoleCards|Door Card)\b/.test(item) && !/[.!?]/.test(item)) {
      return false;
    }
    return true;
  });
}

function findNearestDeckOpen(source, fromIndex) {
  let cursor = fromIndex;
  while (cursor >= 0) {
    const openIndex = source.lastIndexOf('<div', cursor);
    if (openIndex < 0) {
      return -1;
    }

    const closeTagIndex = source.indexOf('>', openIndex);
    if (closeTagIndex < 0 || closeTagIndex > fromIndex) {
      cursor = openIndex - 1;
      continue;
    }

    const tagText = source.slice(openIndex, closeTagIndex + 1);
    if (/\bclass\s*=\s*["'][^"']*\bdeck\b[^"']*["']/i.test(tagText)) {
      return openIndex;
    }

    cursor = openIndex - 1;
  }

  return -1;
}

function extractClassAttribute(tagText) {
  const classMatch = tagText.match(/\bclass\s*=\s*["']([^"']+)["']/i);
  return classMatch ? classMatch[1].trim().replace(/\s+/g, ' ') : '';
}

function extractTagAt(source, openIndex) {
  if (openIndex < 0) {
    return '';
  }
  const closeTagIndex = source.indexOf('>', openIndex);
  if (closeTagIndex < 0) {
    return '';
  }
  return source.slice(openIndex, closeTagIndex + 1);
}

function extractH6Labels(segment) {
  return [...segment.matchAll(/<h6[^>]*>([\s\S]*?)<\/h6>/gi)]
    .map((match) => cleanText(match[1]))
    .filter(Boolean);
}

function normalizeCardLabel(label) {
  return label
    .replace(/\bHoleCards\b/gi, 'Hole Cards')
    .replace(/\bHole\s*Cards?\b/gi, 'Hole Cards')
    .replace(/\bDoor\s*Card\b/gi, 'Door Card')
    .replace(/\bThe\s+Flop\b/gi, 'Flop')
    .replace(/\bThe\s+Turn\b/gi, 'Turn')
    .replace(/\bThe\s+River\b/gi, 'River')
    .replace(/\bHole Cards Door Card\b/gi, 'Hole Cards + Door Card')
    .replace(/\s*\+\s*\+/g, ' + ')
    .replace(/\s*\+\s*/g, ' + ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCardLabelKey(label) {
  return normalizeCardLabel(label).toLowerCase().replace(/^the\s+/, '');
}

function extractStrongLabelFromListItem(roundsSlot, cardsBlockStart) {
  const liStart = roundsSlot.lastIndexOf('<li', cardsBlockStart);
  if (liStart < 0) {
    return '';
  }

  const liEnd = roundsSlot.indexOf('</li>', cardsBlockStart);
  if (liEnd < 0) {
    return '';
  }

  const liInnerStart = roundsSlot.indexOf('>', liStart);
  if (liInnerStart < 0 || liInnerStart >= liEnd) {
    return '';
  }

  const beforeCards = roundsSlot.slice(liInnerStart + 1, cardsBlockStart);
  const strongLabels = [...beforeCards.matchAll(/<strong[^>]*>([\s\S]*?)<\/strong>/gi)]
    .map((match) => normalizeCardLabel(cleanText(match[1])))
    .filter(Boolean);
  return strongLabels.at(-1) ?? '';
}

function findNearestListItemOpen(source, fromIndex) {
  return source.lastIndexOf('<li', fromIndex);
}

function parseCardToken(attributesText) {
  const codeMatch = attributesText.match(/\bname\s*=\s*"([^"]+)"/i);
  if (!codeMatch) {
    return null;
  }

  const code = codeMatch[1].trim().toUpperCase();
  if (!cardCodePattern.test(code)) {
    return null;
  }

  const faceUp = /[:@]?is_flipped\s*=\s*"true"/i.test(attributesText);
  return {
    code,
    hidden: !faceUp,
  };
}

function parseCardExampleItems(cardsMarkup) {
  const items = [];
  const tokenPattern = /<card\b([^>]*)>|<span[^>]*>([\s\S]*?)<\/span>/gi;

  for (const match of cardsMarkup.matchAll(tokenPattern)) {
    const cardAttributes = match[1];
    if (typeof cardAttributes === 'string') {
      const token = parseCardToken(cardAttributes);
      if (!token) {
        continue;
      }
      items.push({
        kind: 'card',
        code: token.code,
        hidden: token.hidden,
      });
      continue;
    }

    const spanContent = match[2];
    if (typeof spanContent !== 'string') {
      continue;
    }

    const text = cleanText(spanContent);
    if (text.includes('+')) {
      items.push({
        kind: 'separator',
        text: '+',
      });
    }
  }

  return items;
}

function extractCardExamples(roundsSlot) {
  const examples = [];
  const cardsBlockPattern = /<div[^>]*class\s*=\s*["'][^"']*\bcards\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;

  for (const match of roundsSlot.matchAll(cardsBlockPattern)) {
    const cardsMarkup = match[1] ?? '';
    const items = parseCardExampleItems(cardsMarkup);
    const cards = items
      .filter((item) => item.kind === 'card')
      .map((item) => ({
        code: item.code,
        hidden: item.hidden,
      }));

    if (cards.length === 0) {
      continue;
    }

    const cardsBlockStart = match.index ?? 0;
    const listItemStart = findNearestListItemOpen(roundsSlot, cardsBlockStart);
    const deckStart = findNearestDeckOpen(roundsSlot, cardsBlockStart);
    const deckTag = extractTagAt(roundsSlot, deckStart);
    const deckClass = extractClassAttribute(deckTag);
    const leadSegment =
      deckStart >= 0 ? roundsSlot.slice(deckStart, cardsBlockStart) : roundsSlot.slice(Math.max(0, cardsBlockStart - 220), cardsBlockStart);
    const labels = [
      ...extractH6Labels(leadSegment).slice(-1),
      ...extractH6Labels(cardsMarkup),
      extractStrongLabelFromListItem(roundsSlot, cardsBlockStart),
    ];
    const uniqueLabels = [];
    const seenLabelKeys = new Set();
    for (const rawLabel of labels) {
      const normalizedLabel = normalizeCardLabel(rawLabel);
      if (!normalizedLabel) {
        continue;
      }
      const labelKey = normalizeCardLabelKey(normalizedLabel);
      if (seenLabelKeys.has(labelKey)) {
        continue;
      }
      seenLabelKeys.add(labelKey);
      uniqueLabels.push(normalizedLabel);
    }

    const label = uniqueLabels.join(' + ').trim();

    examples.push({
      label,
      cards,
      items,
      groupId: listItemStart >= 0 ? `li-${listItemStart}` : `block-${cardsBlockStart}`,
      deckClass,
    });
  }

  return examples;
}

function toSupplementalCardToken(code) {
  const normalizedCode = String(code).trim().toUpperCase();
  if (!cardCodePattern.test(normalizedCode)) {
    throw new Error(`Invalid supplemental card code: ${code}`);
  }

  return {
    code: normalizedCode,
    hidden: false,
  };
}

function buildSupplementalCardExamples(guideId) {
  const definitions = supplementalCardExamplesByGuideId[guideId];
  if (!Array.isArray(definitions) || definitions.length === 0) {
    return [];
  }

  return definitions.map((definition, index) => {
    const cards = definition.cards.map(toSupplementalCardToken);
    return {
      label: cleanText(definition.label),
      cards,
      items: cards.map((card) => ({
        kind: 'card',
        code: card.code,
        hidden: card.hidden,
      })),
      groupId: `supplemental-${guideId}-${index}`,
      deckClass: 'deck supplemental',
    };
  });
}

function buildRecord(entry) {
  const source = fs.readFileSync(path.resolve(legacyGamesDir, entry.file), 'utf8');
  const heading = extractSlot(source, 'heading');
  const rounds = extractSlot(source, 'rounds');
  const rules = extractSlot(source, 'rules');
  const extractedCardExamples = extractCardExamples(rounds);

  return {
    id: entry.id,
    name: entry.name,
    title: extractHeadingTitle(heading, entry.name),
    description: extractHeadingDescription(heading),
    cardExamples: extractedCardExamples.length > 0 ? extractedCardExamples : buildSupplementalCardExamples(entry.id),
    rounds: extractListItems(rounds),
    rules: extractListItems(rules),
  };
}

const records = order.map(buildRecord);

const header = `/* eslint-disable max-lines */\n` +
  `/*\n` +
  ` * Generated by modern/scripts/generate-howto-content.mjs\n` +
  ` * Source files: archived HowTo game templates\n` +
  ` */\n\n`;

const typeBlock = `export interface HowToGuide {\n` +
  `  cardExamples: HowToCardExample[];\n` +
  `  id: string;\n` +
  `  name: string;\n` +
  `  title: string;\n` +
  `  description: string;\n` +
  `  rounds: string[];\n` +
  `  rules: string[];\n` +
  `}\n\n` +
  `export interface HowToCardExample {\n` +
  `  groupId: string;\n` +
  `  deckClass: string;\n` +
  `  label: string;\n` +
  `  items: HowToCardExampleItem[];\n` +
  `  cards: HowToCardToken[];\n` +
  `}\n\n` +
  `export interface HowToCardExampleItem {\n` +
  `  kind: 'card' | 'separator';\n` +
  `  code?: string;\n` +
  `  hidden?: boolean;\n` +
  `  text?: string;\n` +
  `}\n\n` +
  `export interface HowToCardToken {\n` +
  `  code: string;\n` +
  `  hidden: boolean;\n` +
  `}\n\n`;

const dataBlock = `export const HOW_TO_GUIDES: HowToGuide[] = ${JSON.stringify(records, null, 2)};\n`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, header + typeBlock + dataBlock);
console.info(`Generated ${outputPath}`);
