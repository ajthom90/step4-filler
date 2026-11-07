/** Handout p. 1. The list headings and the pledge sentence come from the preset (see presets.ts). */
export const pledgeCopy = {
  title: 'Abstinence pledge',
  optionalNote: 'The pledge is optional. Skip it if it is not part of your program.',
  signatureLabel: 'Signature',
  addButton: (heading: string) => `Add to list: ${heading}`,
  addTo: (heading: string) => `Add to ${heading}`,
  removeWarning: 'This removes it from the list.',
  listLabel: (heading: string) => `${heading}, your list`,
  dateLabel: 'Date',
};
