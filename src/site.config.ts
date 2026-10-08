// Site-wide text and settings. Edit values here; every page reads from this file.
// The lab has chosen not to list a public email or street address.

export const site = {
  name: 'Szalat Lab',
  // TODO: mission sentence is a draft for the PI to edit.
  mission:
    'We study the biology of plasma cell disorders, from AL amyloidosis to multiple myeloma, to improve how patients are diagnosed, monitored, and treated.',
  // TODO: overview paragraph is a draft for the PI to edit.
  overview:
    'The Szalat Lab combines single-cell and multiomic profiling of patient bone marrow with clinical research in multiple myeloma and related plasma cell disorders. Our work connects the features of malignant and non-malignant plasma cells and their microenvironment to treatment response and clinical outcomes.',
  description:
    'The Szalat Lab at Boston Medical Center and Boston University studies plasma cell disorders, including AL amyloidosis and multiple myeloma.',
  affiliations: [
    'Boston Medical Center',
    'Boston University Chobanian & Avedisian School of Medicine',
  ],
};

export const nav = [
  { label: 'Research', href: 'research/' },
  { label: 'Publications', href: 'publications/' },
  { label: 'Concepts', href: 'concepts/' },
  { label: 'People', href: 'people/' },
  { label: 'Contact', href: 'contact/' },
];
