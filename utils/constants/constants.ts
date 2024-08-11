export enum AnimalTypes {
  DOG = "dog",
  CAT = "cat",
  BIRD = "bird",
  FISH = "fish",
  REPTIL = "reptil",
  MAMMAL = "mammal",
}

export const animal_type_options = [
  { label: "Perro", value: AnimalTypes.DOG },
  { label: "Gato", value: AnimalTypes.CAT },
  { label: "Ave", value: AnimalTypes.BIRD },
  { label: "Pez", value: AnimalTypes.FISH },
  { label: "Reptil", value: AnimalTypes.REPTIL },
  { label: "Mamífero", value: AnimalTypes.MAMMAL },
];

export const dogBreeds = [
  "Mestizo",
  "Affenpinscher",
  "Afgano",
  "Airdale Terrier",
  "Akita",
  "Alaska Malamute",
  "American Eskimo",
  "American Foxhound",
  "American Hairless Terrier",
  "American Staffordshire Terrier",
  "American Water Spaniel",
  "Anatolian Shepherd",
  "Antiguo Pastor Ingles",
  "Australian Cattle",
  "Basenjin",
  "Basset Hound",
];

export const animal_history_options = [
  {
    label: "Registrado",
    value: "register",
  },
  {
    label: "Adoptado",
    value: "adopted",
  },
  {
    label: "Abandonado",
    value: "abandoned",
  },
  {
    label: "Rescatado",
    value: "rescued",
  },
  {
    label: "En familia",
    value: "in_family",
  },
];
