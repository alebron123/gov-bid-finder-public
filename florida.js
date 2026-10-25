// Florida geography for the county heatmap: a tile grid of all 67 counties and a
// lookup from the city names that appear in contract notices to their county.

// [label, col, row] on a 14 x 13 grid: the panhandle across the top, the peninsula
// down the right, Miami-Dade and Monroe at the bottom. Positions are approximate
// neighbours, not a projection; the point is that every county gets an equal,
// clickable tile.
export const FL_COUNTIES = {
  "Escambia": ["ESC", 0, 0], "Santa Rosa": ["SRO", 1, 0], "Okaloosa": ["OKA", 2, 0], "Walton": ["WAL", 3, 0], "Holmes": ["HOL", 4, 0],
  "Jackson": ["JAC", 5, 0], "Gadsden": ["GAD", 6, 0], "Leon": ["LEO", 7, 0], "Jefferson": ["JEF", 8, 0], "Madison": ["MAD", 9, 0],
  "Hamilton": ["HAM", 10, 0], "Columbia": ["CLM", 11, 0], "Baker": ["BAK", 12, 0], "Nassau": ["NAS", 13, 0],
  "Bay": ["BAY", 3, 1], "Washington": ["WAS", 4, 1], "Calhoun": ["CAL", 5, 1], "Liberty": ["LIB", 6, 1], "Wakulla": ["WAK", 7, 1],
  "Taylor": ["TAY", 8, 1], "Lafayette": ["LAF", 9, 1], "Suwannee": ["SUW", 10, 1], "Union": ["UNI", 11, 1], "Bradford": ["BRA", 12, 1], "Duval": ["DUV", 13, 1],
  "Gulf": ["GUL", 4, 2], "Franklin": ["FRA", 6, 2], "Dixie": ["DIX", 9, 2], "Gilchrist": ["GIL", 10, 2], "Alachua": ["ALA", 11, 2], "Clay": ["CLA", 12, 2], "St. Johns": ["STJ", 13, 2],
  "Levy": ["LEV", 10, 3], "Marion": ["MRN", 11, 3], "Putnam": ["PUT", 12, 3], "Flagler": ["FLA", 13, 3],
  "Citrus": ["CIT", 10, 4], "Sumter": ["SUM", 11, 4], "Lake": ["LAK", 12, 4], "Volusia": ["VOL", 13, 4],
  "Hernando": ["HER", 9, 5], "Pasco": ["PAS", 10, 5], "Orange": ["ORA", 11, 5], "Seminole": ["SEM", 12, 5], "Brevard": ["BRE", 13, 5],
  "Pinellas": ["PIN", 9, 6], "Hillsborough": ["HIL", 10, 6], "Polk": ["POL", 11, 6], "Osceola": ["OSC", 12, 6], "Indian River": ["IND", 13, 6],
  "Manatee": ["MAN", 9, 7], "Hardee": ["HAR", 10, 7], "Highlands": ["HIG", 11, 7], "Okeechobee": ["OKE", 12, 7], "St. Lucie": ["STL", 13, 7],
  "Sarasota": ["SAR", 9, 8], "DeSoto": ["DES", 10, 8], "Glades": ["GLA", 11, 8], "Martin": ["MTN", 13, 8],
  "Charlotte": ["CHA", 10, 9], "Hendry": ["HEN", 11, 9], "Palm Beach": ["PBC", 13, 9],
  "Lee": ["LEE", 10, 10], "Collier": ["CLR", 11, 10], "Broward": ["BRO", 13, 10],
  "Miami-Dade": ["MIA", 13, 11],
  "Monroe": ["MON", 12, 12],
};

// City (as SAM.gov and the county feeds spell it, lowercased) -> county. Covers the
// larger cities and every military installation that shows up in Florida notices.
const CITY = {
  // South Florida
  "miami": "Miami-Dade", "miami beach": "Miami-Dade", "hialeah": "Miami-Dade", "homestead": "Miami-Dade", "doral": "Miami-Dade",
  "coral gables": "Miami-Dade", "miami gardens": "Miami-Dade", "north miami": "Miami-Dade", "north miami beach": "Miami-Dade",
  "kendall": "Miami-Dade", "miami lakes": "Miami-Dade", "opa-locka": "Miami-Dade", "opa locka": "Miami-Dade", "cutler bay": "Miami-Dade",
  "key biscayne": "Miami-Dade", "medley": "Miami-Dade", "sweetwater": "Miami-Dade", "aventura": "Miami-Dade", "palmetto bay": "Miami-Dade",
  "florida city": "Miami-Dade", "homestead arb": "Miami-Dade", "homestead air reserve base": "Miami-Dade", "miami springs": "Miami-Dade",
  "fort lauderdale": "Broward", "ft lauderdale": "Broward", "ft. lauderdale": "Broward", "hollywood": "Broward", "pembroke pines": "Broward",
  "miramar": "Broward", "coral springs": "Broward", "pompano beach": "Broward", "davie": "Broward", "plantation": "Broward",
  "sunrise": "Broward", "dania beach": "Broward", "weston": "Broward", "deerfield beach": "Broward", "lauderdale lakes": "Broward",
  "west palm beach": "Palm Beach", "palm beach": "Palm Beach", "boca raton": "Palm Beach", "delray beach": "Palm Beach", "boynton beach": "Palm Beach",
  "jupiter": "Palm Beach", "riviera beach": "Palm Beach", "palm beach gardens": "Palm Beach", "belle glade": "Palm Beach", "lake worth": "Palm Beach",
  "key west": "Monroe", "marathon": "Monroe", "key largo": "Monroe", "boca chica": "Monroe", "islamorada": "Monroe",
  // Treasure and Space coasts
  "stuart": "Martin", "indiantown": "Martin", "port st. lucie": "St. Lucie", "port st lucie": "St. Lucie", "port saint lucie": "St. Lucie", "fort pierce": "St. Lucie",
  "vero beach": "Indian River", "sebastian": "Indian River",
  "melbourne": "Brevard", "palm bay": "Brevard", "titusville": "Brevard", "cocoa": "Brevard", "cocoa beach": "Brevard", "merritt island": "Brevard",
  "cape canaveral": "Brevard", "patrick afb": "Brevard", "patrick air force base": "Brevard", "patrick sfb": "Brevard", "patrick space force base": "Brevard",
  "kennedy space center": "Brevard", "rockledge": "Brevard", "satellite beach": "Brevard",
  // Central Florida
  "orlando": "Orange", "winter park": "Orange", "apopka": "Orange", "ocoee": "Orange", "winter garden": "Orange",
  "sanford": "Seminole", "altamonte springs": "Seminole", "oviedo": "Seminole", "lake mary": "Seminole",
  "kissimmee": "Osceola", "st. cloud": "Osceola", "saint cloud": "Osceola", "st cloud": "Osceola",
  "lakeland": "Polk", "winter haven": "Polk", "bartow": "Polk", "haines city": "Polk",
  "leesburg": "Lake", "clermont": "Lake", "tavares": "Lake", "eustis": "Lake", "the villages": "Sumter", "bushnell": "Sumter",
  "ocala": "Marion", "silver springs": "Marion", "daytona beach": "Volusia", "deland": "Volusia", "deltona": "Volusia", "new smyrna beach": "Volusia",
  "palm coast": "Flagler", "bunnell": "Flagler", "sebring": "Highlands", "avon park": "Highlands", "okeechobee": "Okeechobee",
  // Tampa Bay and Southwest
  "tampa": "Hillsborough", "macdill afb": "Hillsborough", "macdill air force base": "Hillsborough", "brandon": "Hillsborough", "plant city": "Hillsborough", "riverview": "Hillsborough",
  "st. petersburg": "Pinellas", "st petersburg": "Pinellas", "saint petersburg": "Pinellas", "clearwater": "Pinellas", "largo": "Pinellas", "bay pines": "Pinellas",
  "pinellas park": "Pinellas", "dunedin": "Pinellas", "new port richey": "Pasco", "dade city": "Pasco", "wesley chapel": "Pasco",
  "brooksville": "Hernando", "spring hill": "Hernando", "inverness": "Citrus", "crystal river": "Citrus",
  "bradenton": "Manatee", "palmetto": "Manatee", "sarasota": "Sarasota", "venice": "Sarasota", "north port": "Sarasota",
  "punta gorda": "Charlotte", "port charlotte": "Charlotte", "arcadia": "DeSoto", "wauchula": "Hardee",
  "fort myers": "Lee", "ft myers": "Lee", "cape coral": "Lee", "lehigh acres": "Lee", "naples": "Collier", "immokalee": "Collier", "everglades city": "Collier",
  "clewiston": "Hendry", "labelle": "Hendry", "moore haven": "Glades",
  // North Florida
  "jacksonville": "Duval", "atlantic beach": "Duval", "jacksonville beach": "Duval", "neptune beach": "Duval", "mayport": "Duval", "nas jacksonville": "Duval",
  "fernandina beach": "Nassau", "yulee": "Nassau", "st. augustine": "St. Johns", "st augustine": "St. Johns", "saint augustine": "St. Johns", "ponte vedra beach": "St. Johns",
  "orange park": "Clay", "green cove springs": "Clay", "camp blanding": "Clay", "starke": "Bradford", "palatka": "Putnam", "macclenny": "Baker",
  "gainesville": "Alachua", "alachua": "Alachua", "lake city": "Columbia", "live oak": "Suwannee", "jasper": "Hamilton", "lake butler": "Union",
  "chiefland": "Levy", "cedar key": "Levy", "trenton": "Gilchrist", "cross city": "Dixie", "perry": "Taylor", "mayo": "Lafayette",
  "madison": "Madison", "monticello": "Jefferson",
  // Panhandle
  "tallahassee": "Leon", "quincy": "Gadsden", "crawfordville": "Wakulla", "apalachicola": "Franklin", "port st. joe": "Gulf", "port st joe": "Gulf",
  "blountstown": "Calhoun", "bristol": "Liberty", "marianna": "Jackson", "chipley": "Washington", "bonifay": "Holmes",
  "panama city": "Bay", "panama city beach": "Bay", "lynn haven": "Bay", "tyndall afb": "Bay", "tyndall air force base": "Bay",
  "defuniak springs": "Walton", "santa rosa beach": "Walton", "miramar beach": "Walton",
  "fort walton beach": "Okaloosa", "eglin afb": "Okaloosa", "eglin air force base": "Okaloosa", "hurlburt field": "Okaloosa", "niceville": "Okaloosa",
  "crestview": "Okaloosa", "destin": "Okaloosa", "valparaiso": "Okaloosa", "duke field": "Okaloosa",
  "milton": "Santa Rosa", "navarre": "Santa Rosa", "whiting field": "Santa Rosa", "nas whiting field": "Santa Rosa", "gulf breeze": "Santa Rosa",
  "pensacola": "Escambia", "nas pensacola": "Escambia", "pensacola beach": "Escambia", "cantonment": "Escambia", "corry station": "Escambia",
};

// The county for a Florida city name, or "" when unknown. Rows from the Miami-Dade
// county feed always belong to Miami-Dade, whatever city they name.
export function countyOf(city, source = "") {
  if (source === "miami-dade") return "Miami-Dade";
  const k = String(city || "").toLowerCase().replace(/\s+/g, " ").trim();
  return CITY[k] || "";
}

// South Florida, for "near Miami" matching.
export const SOUTH_FLORIDA = ["Miami-Dade", "Broward", "Palm Beach", "Monroe"];
