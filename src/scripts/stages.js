/**
 * The line, stop by stop.
 *
 * Written to be read in the few seconds it takes him to arrive and settle:
 * plain words, short sentences, one idea per stop. The specifics carry the
 * weight — a place, a number of years, the actual tools — because that is what
 * a reader remembers and what a search engine has anything to index.
 */

export const STAGES = [
  {
    id: "origen",
    costume: "student",
    place: "Florida, Camagüey · Cuba",
    title: "It starts here",
    body: "A small town in the middle of Cuba. Heat, family, not much else. Everything after this, I walked to.",
  },
  {
    id: "escuela",
    costume: "student",
    place: "School years",
    title: "New school, again",
    body: "I lost count of how many times we moved. The classrooms kept changing. The studying stuck.",
  },
  {
    id: "universidad",
    costume: "uni",
    place: "University of Camagüey",
    title: "Five years of computer engineering",
    body: "Informatics and exact sciences. Where the trade started, and where I learned to sit with a problem until it moved.",
  },
  {
    id: "padre",
    costume: "dad",
    place: "Fourth year",
    title: "Then I became a father",
    body: "Exams and a newborn in the same week. Nothing since has felt busy.",
  },
  {
    id: "grado",
    costume: "grad",
    place: "Fifth year",
    title: "I graduated",
    body: "Computer engineer. The cap is a drawing. The degree is not.",
  },
  {
    id: "economia",
    costume: "badge",
    place: "University of Camagüey · Economics",
    title: "My first systems job",
    body: "SQL Server and the accounting systems for a whole university department. If a number moved on that campus, it went through me.",
    chips: ["SQL Server", "Databases", "Internal systems"],
  },
  {
    id: "radares",
    costume: "badge",
    place: "National Radar Center · Camagüey",
    title: "Six years running the network",
    body: "Systems and network administrator at Cuba's National Radar Center. Servers, links, and a weather service that depended on all of it staying up.",
    chips: ["Linux", "Networks", "Servers", "Radar"],
  },
  {
    id: "viaje",
    costume: "suitcase",
    place: "Cuba to the United States",
    title: "I packed one suitcase",
    body: "New country, no contacts, no shortcuts. The trade came with me.",
  },
  {
    id: "oficios",
    costume: "hardhat",
    place: "United States · trades",
    title: "I took the work there was",
    body: "Construction, remodeling, parking lots, delivery routes. You read a system differently once you have carried it.",
  },
  {
    id: "cocina",
    costume: "chef",
    place: "Wingstop · Cuban and Italian kitchens",
    title: "Then I cooked",
    body: "A kitchen on a Friday night teaches what an outage teaches: prioritize, do not freeze, get the plate out.",
  },
  {
    id: "solar",
    costume: "hardhat",
    place: "Solar farms · United States",
    title: "Now I keep panels on the sun",
    body: "Solar tracking systems across US solar farms — the mechanics and the logic that turn every row to follow the sun all day.",
    chips: ["Solar tracking", "Field service", "Troubleshooting"],
  },
  {
    id: "linux",
    costume: "linux",
    place: "Nights and weekends",
    title: "Linux never left",
    body: "Free software was the night workshop the whole time. Job site or kitchen line, I am still a sysadmin in my head.",
    chips: ["Linux", "Open source", "Bash", "Networking"],
  },
  {
    id: "cierre",
    costume: "linux",
    place: "Contact",
    title: "Let's talk",
    body: "I am looking for systems, network or Linux work — remote or in the field. One email is enough.",
    email: "terrerov@gmail.com",
  },
];
