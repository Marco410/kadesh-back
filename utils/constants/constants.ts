export enum dayOfWeek {
  DOM = "Domingo",
  LUN = "Lunes",
  MAR = "Martes",
  MIER = "Miércoles",
  JUEV = "Jueves",
  VIE = "Viernes",
  SAB = "Sábado",
}

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

export const dogBreeds: string[] = [
  "Mestizo",
  "Sin Asignar",
  "Affenpinscher",
  "Afgano",
  "Airedale Terrier",
  "Akita",
  "Alaska Malamute",
  "American Bully",
  "American Eskimo",
  "American Foxhound",
  "American Hairless Terrier",
  "American Staffordshire Terrier",
  "American Water Spaniel",
  "Anatolian Shepherd",
  "Antiguo Pastor Inglés",
  "Australian Cattle",
  "Basenji",
  "Basset Hound",
  "Beagle",
  "Bedlington Terrier",
  "Bernes de la Montaña",
  "Bichón Frisé",
  "Bichón Habanero",
  "Bichón Maltés",
  "Bichón Malinois",
  "Bichón Scotch",
  "Black and Tan Hound",
  "Black Russian Terrier",
  "Bloodhound",
  "Border Collie",
  "Border Terrier",
  "Borzoi",
  "Boston Terrier",
  "Bouvier",
  "Bouvier Des Flandres",
  "Boxer",
  "Brittany",
  "Brittany Spaniel",
  "Bull Terrier",
  "Bull Terrier Miniatura",
  "Bulldog",
  "Bulldog Americano",
  "Bulldog Francés",
  "Bulldog Frisian",
  "Bullmastiff",
  "Cairn Terrier",
  "Canaan Dog",
  "Cane Corso",
  "Cardigan Welsh Corgi",
  "Cavalier King Charles Spaniel",
  "Chesapeake Bay Retriever",
  "Chihuahua",
  "Chin Japonés",
  "Chow Chow",
  "Clumber Spaniel",
  "Cockapoo",
  "Cocker Spaniel (Americano)",
  "Cocker Spaniel (Inglés)",
  "Collie (Pelo Duro)",
  "Collie (Pelo Suave)",
  "Collie Barbudo",
  "Coonhound (Black and Tan)",
  "Corgi Cardigan",
  "Corgi Pembroke",
  "Coton de Tulear",
  "Crestado Chino Con Pelo",
  "Crestado Chino Sin Pelo",
  "Dachshund (Pelo Corto)",
  "Dachshund (Pelo De Alambre)",
  "Dachshund (Pelo Largo)",
  "Dálmata",
  "Dandie Dinmont Terrier",
  "Dogo Argentino",
  "Dogo de Burdeos",
  "Doberman",
  "Doberman Pinscher",
  "Esquimal",
  "Field Spaniel",
  "Fila Brasileño",
  "Flat Coat Retriever",
  "Fox Terrier (Pelo Corto)",
  "Fox Terrier (Pelo De Alambre)",
  "Fox Terrier Toy",
  "Foxhound (Americano)",
  "Foxhound (Inglés)",
  "Galgo Español",
  "Galgo Italiano",
  "Gigante de los Pirineos",
  "Gigante Suizo de las Montañas",
  "Glen Of Imaal Terrier",
  "Goldendoodle",
  "Golden Retriever",
  "Gordon Setter",
  "Gran Danés",
  "Griffon De Bruselas",
  "Griffon Pointing Alambrado",
  "Harrier",
  "Havanés",
  "Ibiza Hound",
  "Jack Russell Terrier",
  "Jack Russell Terrier Pelo De Alambre",
  "Keeshound",
  "Kerry Blue Terrier",
  "Komondor",
  "Kuvasz",
  "Labradoodle Estandar",
  "Labradoodle Miniatura",
  "Labrador De Pelo Rizado",
  "Labrador Retriever",
  "Lakeland Terrier",
  "Lhasa Apso",
  "Lobero Escocés",
  "Lobero Irlandés",
  "Lowchen",
  "Maltipoo",
  "Maltés",
  "Manchester Terrier (Standard)",
  "Manchester Toy Terrier",
  "Mastín",
  "Mastín Italiano",
  "Mastín Napolitano",
  "Mastín Tibetano",
  "Min Pin",
  "Norfolk Terrier",
  "Norwegian Elkhound",
  "Norwich Terrier",
  "Nova Scotia Duck T",
  "Otterhound",
  "Papillon",
  "Pastor Alemán",
  "Pastor Australiano",
  "Pastor Belga",
  "Pastor Belga Groenendael",
  "Pastor Belga Malinois",
  "Pastor Belga Tervuren",
  "Pastor Caucaso",
  "Pastor De Anatolia",
  "Pastor De Briard",
  "Pastor De Catahoula",
  "Pastor De Shetland",
  "Pastor Ganadero",
  "Pastor Holandés",
  "Pastor Polaco",
  "Pastor Suizo",
  "Pequinés",
  "Perro De Aguas Españolas",
  "Pharaoh Hound",
  "Pinscher Alemán",
  "Pinscher Miniatura",
  "Pitbull",
  "Plott Hound",
  "Pointer",
  "Pointer Alemán Pelo Corto",
  "Pomeranian",
  "Pomsky",
  "Poodle Chico",
  "Poodle Standard",
  "Poodle Toy",
  "Portugés De Aguas",
  "Presa Canario",
  "Pug",
  "Puli",
  "Puggle",
  "Pyrenees",
  "Redbone Hound",
  "Rhodesian Ridgeback",
  "Rottweiler",
  "Saluki",
  "Samoyedo",
  "San Bernardo",
  "San Bernardo Pelo Corto",
  "San Bernardo Pelo Largo",
  "Schipperke",
  "Schnoodle",
  "Schnauzer (Gigante)",
  "Schnauzer (Miniatura)",
  "Schnauzer (Standard)",
  "Scottie",
  "Scottish Deerhound",
  "Scottish Terrier",
  "Sealyham Terrier",
  "Setter Inglés",
  "Setter Irlandés",
  "Shar-Pei",
  "Shiba Inu",
  "Shih Tzu",
  "Siberian Husky",
  "Silky Terrier",
  "Skye Terrier",
  "Soft Coated Wheaten Terrier",
  "Spaniel De Aguas Irlandés",
  "Spaniel De Campo",
  "Spaniel Tibetano",
  "Spaniel Toy Japonés",
  "Spinone Italiano",
  "Springer Spaniel Americano",
  "Springer Spaniel Inglés",
  "Springer Spaniel Welsh",
  "Staffordshire Terrier",
  "Sussex Spaniel",
  "Terranova",
  "Terrier Australiano",
  "Terrier Irlandés",
  "Terrier Tibetano",
  "Toy Spaniel Inglés",
  "Vizsla",
  "Weimaraner",
  "Welsh Corgi Pembroke",
  "Welsh Terrier",
  "West Highland White Terrier",
  "Westie",
  "Whippet",
  "Xoloitzcuintle (Estandar)",
  "Xoloitzcuintle Intermedio",
  "Yorkshire Biewer",
  "Yorkshire Terrier",
];

export const catBreeds: string[] = [
  "Mestizo",
  "Sin Asignar",
  "Doméstico",
  "Angora Turco",
  "Azul Ruso",
  "Bengalí",
  "Chico Europeo",
  "Exótico Persa Pelo Corto",
  "Grande Europeo",
  "Maine Coon",
  "Mediano Europeo",
  "Persa Pelo Largo",
  "Siamés",
];

export const fishBreeds: string[] = [
  "Sin Asignar",
  "Albonube",
  "Anémona",
  "Ángel",
  "Anguila",
  "Arcoíris",
  "Babosa",
  "Barbo",
  "Betta",
  "Bichir",
  "Botia",
  "Cardenal",
  "Cebra",
  "Chromis",
  "Cíclido",
  "Cola de Espada",
  "Colisa",
  "Come Algas",
  "Corydora",
  "Ctenopoma Leopardo",
  "Cucha Real de Punto",
  "Damisela",
  "Danio",
  "Disco",
  "Dojo",
  "Espada",
  "Estrella",
  "Glowlight",
  "Gobio",
  "Goby",
  "Goldfish",
  "Gourami",
  "Guppy",
  "Gusano",
  "Hacha Plata",
  "Heniochus",
  "Japan Blue",
  "Koi",
  "Kulli",
  "Lápiz Punteado",
  "León Enano",
  "Leoporino",
  "Mandarín",
  "Mariposa",
  "Medio Pico",
  "Molly",
  "Monakusia Balón",
  "Monja",
  "Murciélago Pinnatus",
  "Navaja",
  "Neón",
  "Nudibranquio Berghia",
  "Oranda",
  "Oscar",
  "Otocinclos",
  "Pacu Rojo",
  "Pangasio",
  "Payaso",
  "Perico",
  "Pez Ballenita",
  "Pez Caja Amarillo",
  "Pez Caja Común",
  "Pez Cara de Zorro",
  "Pez Conejo",
  "Pez Dragón",
  "Pez Elefante",
  "Pez Gato",
  "Pez Globo Verde Punteado",
  "Pez Lápiz",
  "Pez Pipa Bandeado",
  "Pez Soga",
  "Pez Tropical",
  "Platy",
  "Plecostomus",
  "Ramirezzi",
  "Rasbora",
  "Scatofago",
  "Severum Dorado",
  "Shubunkin",
  "Silver",
  "Sumatrano",
  "Synodontis Eupterus",
  "Tang",
  "Tetra",
  "Tiburón",
  "Trigger",
  "Trofeus Dubois",
  "Vieja Melanurus",
  "Viuda Negra",
  "Wrasse",
];

export const birdBreeds: string[] = [
  "Sin Asignar",
  "Agapornis",
  "Agapornis Fisheri",
  "Agapornis Lutino",
  "Agapornis Personata",
  "Agapornis Roseicollis",
  "Ave Tropical",
  "Búho",
  "Cacatúa",
  "Canario Cubano",
  "Canario Nacional",
  "Cardenal",
  "Carpintero",
  "Cenzontle",
  "Cigüeña",
  "Codorniz",
  "Colibrí",
  "Conuro Solar",
  "Cotorra",
  "Cotorrita Quaker",
  "Cuervo",
  "Faisán",
  "Fínche",
  "Garza",
  "Golondrina",
  "Gorrión",
  "Guacamaya",
  "Lady Gould",
  "Lechuza",
  "Loro",
  "Ninfa",
  "Paloma",
  "Paloma de Java",
  "Palomino",
  "Perdiz",
  "Perico",
  "Periquito Australiano",
  "Periquito Australiano Arlequín",
  "Periquito Australiano Bourke",
  "Periquito Pseudoinglés",
  "Petirrojo",
  "Pyrrhura Molinae",
  "Rosella Eximius Ancestral",
  "Rosella Eximius Mutación",
  "Ruiseñor",
  "Tecolote",
  "Tórtola",
  "Tucán",
];

export const reptilBreeds: string[] = [
  "Sin Asignar",
  "Ameiva Verde",
  "Anolis",
  "Basilisco Verde",
  "Boa",
  "Camaleón",
  "Clamidosaurio",
  "Dragón Barbudo",
  "Dragón de Agua",
  "Epicureanum",
  "Escorpión",
  "Falsa Coral",
  "Gecko",
  "Iguana Verde",
  "Lagarto Espinoso",
  "Monitor de la Sabana",
  "Monitor del Nilo",
  "Pitón Bola",
  "Pitón Sangre",
  "Rana",
  "Rey de California Aberrante",
  "Salamandra",
  "Serpiente",
  "Skink",
  "Tarántula",
  "Tegu",
  "Tortuga",
];

export const mammalBreeds: string[] = [
  "Ardilla",
  "Cerdo Vietnamita",
  "Chinchilla",
  "Conejillo de Indias",
  "Conejo",
  "Cuyo",
  "Erizo",
  "Gerbo",
  "Hámster",
  "Hurón",
  "Jerbo",
  "Merion",
  "Rata",
  "Ratón",
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
