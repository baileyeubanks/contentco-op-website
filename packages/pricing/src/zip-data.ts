export interface ZipEntry {
  mult: number;
  label: string;
  medianHome: number;
}

/** Houston area ZIP code multipliers — sourced from Zillow, Redfin, Census ACS 2023, HAR.com */
export const ZIP_DATA: Record<string, ZipEntry> = {
  // Katy
  "77449": { mult: 0.92, label: "Katy", medianHome: 262500 },
  "77450": { mult: 1.03, label: "Katy", medianHome: 362500 },
  "77494": { mult: 1.12, label: "Cinco Ranch", medianHome: 488000 },
  // Cypress
  "77429": { mult: 1.05, label: "Cypress", medianHome: 379500 },
  "77433": { mult: 1.08, label: "Cypress", medianHome: 432800 },
  // Sugar Land
  "77478": { mult: 1.08, label: "Sugar Land", medianHome: 420000 },
  "77479": { mult: 1.10, label: "Sugar Land", medianHome: 480000 },
  // The Woodlands
  "77380": { mult: 1.10, label: "The Woodlands", medianHome: 475000 },
  "77381": { mult: 1.12, label: "The Woodlands", medianHome: 520000 },
  "77382": { mult: 1.15, label: "The Woodlands", medianHome: 580000 },
  // Spring
  "77379": { mult: 1.04, label: "Spring", medianHome: 365600 },
  "77388": { mult: 0.97, label: "Spring", medianHome: 303800 },
  "77389": { mult: 1.10, label: "Spring", medianHome: 463200 },
  // Pearland
  "77581": { mult: 1.02, label: "Pearland", medianHome: 346800 },
  "77584": { mult: 1.08, label: "Pearland", medianHome: 420000 },
  // League City
  "77573": { mult: 1.05, label: "League City", medianHome: 380200 },
  // Missouri City
  "77459": { mult: 1.07, label: "Missouri City", medianHome: 403700 },
  // Richmond
  "77406": { mult: 1.00, label: "Richmond", medianHome: 340000 },
  "77407": { mult: 1.05, label: "Richmond", medianHome: 389800 },
  // Fulshear
  "77441": { mult: 1.15, label: "Fulshear", medianHome: 608300 },
  // Bellaire
  "77401": { mult: 1.18, label: "Bellaire", medianHome: 963000 },
  // West University Place
  "77005": { mult: 1.20, label: "West University", medianHome: 1418000 },
  // River Oaks / Memorial
  "77019": { mult: 1.20, label: "River Oaks", medianHome: 1200000 },
  "77024": { mult: 1.20, label: "Memorial", medianHome: 1104700 },
  "77056": { mult: 1.15, label: "Tanglewood", medianHome: 625600 },
  // Heights
  "77008": { mult: 1.12, label: "The Heights", medianHome: 635000 },
  "77009": { mult: 1.08, label: "Heights East", medianHome: 420000 },
  // Montrose
  "77006": { mult: 1.10, label: "Montrose", medianHome: 524800 },
  // Downtown / EaDo
  "77002": { mult: 0.97, label: "Downtown", medianHome: 308200 },
  "77003": { mult: 1.04, label: "EaDo", medianHome: 374100 },
  // Galleria
  "77057": { mult: 0.95, label: "Galleria", medianHome: 283500 },
  // Med Center / NRG
  "77030": { mult: 1.10, label: "Med Center", medianHome: 503000 },
  "77054": { mult: 0.90, label: "NRG / Astrodome", medianHome: 210000 },
  // Clear Lake / NASA
  "77058": { mult: 0.92, label: "Clear Lake", medianHome: 257300 },
  "77059": { mult: 1.08, label: "Clear Lake", medianHome: 453300 },
  // Friendswood
  "77546": { mult: 1.10, label: "Friendswood", medianHome: 450000 },
  // Humble
  "77338": { mult: 0.90, label: "Humble", medianHome: 241300 },
  "77346": { mult: 0.98, label: "Atascocita", medianHome: 316900 },
  // Kingwood
  "77339": { mult: 0.95, label: "Kingwood", medianHome: 296500 },
  "77345": { mult: 1.07, label: "Kingwood", medianHome: 403100 },
  // Tomball
  "77375": { mult: 1.03, label: "Tomball", medianHome: 346800 },
  "77377": { mult: 1.07, label: "Tomball", medianHome: 405800 },
  // Conroe
  "77301": { mult: 0.90, label: "Conroe", medianHome: 240000 },
  "77302": { mult: 0.93, label: "Conroe", medianHome: 280000 },
  "77304": { mult: 0.98, label: "Conroe", medianHome: 324800 },
  // Pasadena
  "77502": { mult: 0.85, label: "Pasadena", medianHome: 195000 },
  "77503": { mult: 0.87, label: "Pasadena", medianHome: 210000 },
  "77504": { mult: 0.90, label: "Pasadena", medianHome: 235000 },
  // Baytown
  "77520": { mult: 0.88, label: "Baytown", medianHome: 220000 },
  "77521": { mult: 0.87, label: "Baytown", medianHome: 220100 },
  // Other premium areas
  "77027": { mult: 1.15, label: "Galleria / River Oaks", medianHome: 750000 },
  "77004": { mult: 1.04, label: "Midtown", medianHome: 370000 },
  "77007": { mult: 1.10, label: "Washington Ave", medianHome: 480000 },
  "77025": { mult: 1.06, label: "Braeswood", medianHome: 400000 },
  "77079": { mult: 1.08, label: "Memorial West", medianHome: 430000 },
  "77493": { mult: 1.00, label: "Katy West", medianHome: 330000 },
};

/** Look up ZIP multiplier, default 1.0 for unknown */
export function getZipMultiplier(zipCode: string): number {
  return ZIP_DATA[zipCode]?.mult ?? 1.0;
}

/** Look up ZIP label */
export function getZipLabel(zipCode: string): string {
  return ZIP_DATA[zipCode]?.label ?? "";
}
