import fs from "node:fs";
import * as simpleIcons from "simple-icons";

const wanted = [
  "Toyota", "Hyundai", "Kia", "Mazda", "Suzuki", "Mitsubishi", "Nissan", "Honda", "Ford", "Chevrolet",
  "Renault", "Peugeot", "Volkswagen", "SEAT", "Opel", "Fiat", "Volvo", "BMW", "Mini", "Smart", "Audi",
  "Subaru", "Dacia", "Jeep", "Chrysler", "Porsche", "Cadillac", "Tesla", "Polestar", "MG", "Citroën",
  "Yamaha Motor Corporation", "Scania", "IVECO",
];

const icons = Object.values(simpleIcons);
fs.mkdirSync("public/vehicle-logos", { recursive: true });

for (const name of wanted) {
  const icon = icons.find((candidate) => candidate?.title?.toLowerCase() === name.toLowerCase());
  if (!icon) continue;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" aria-label="${name}"><path fill="#${icon.hex}" d="${icon.path}"/></svg>`;
  fs.writeFileSync(`public/vehicle-logos/${icon.slug}.svg`, svg);
}
