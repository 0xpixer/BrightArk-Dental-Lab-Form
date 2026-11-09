const ISO_COUNTRY_CODES = `
AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR
GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO
JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR
MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO
RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV
TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW
`.trim().split(/\s+/)

export const PRIORITY_COUNTRIES = ['Indonesia', 'Singapore', 'Vietnam', 'Thailand', 'Australia'] as const

const displayNames = new Intl.DisplayNames(['en'], { type: 'region' })
const prioritySet = new Set<string>(PRIORITY_COUNTRIES)

export const OTHER_COUNTRIES = ISO_COUNTRY_CODES
  .map((code) => displayNames.of(code))
  .filter((name): name is string => typeof name === 'string')
  .filter((name) => !prioritySet.has(name))
  .sort((a, b) => a.localeCompare(b, 'en'))

export const COUNTRY_OPTIONS = [...PRIORITY_COUNTRIES, ...OTHER_COUNTRIES]

export const MAJOR_CITIES_BY_COUNTRY: Record<string, string[]> = {
  Indonesia: ['Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Semarang', 'Makassar', 'Denpasar', 'Palembang', 'Yogyakarta', 'Balikpapan'],
  Singapore: ['Singapore'],
  Vietnam: ['Ho Chi Minh City', 'Hanoi', 'Da Nang', 'Hai Phong', 'Can Tho'],
  Thailand: ['Bangkok', 'Chiang Mai', 'Phuket', 'Pattaya', 'Khon Kaen', 'Hat Yai'],
  Australia: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Canberra', 'Gold Coast', 'Newcastle', 'Hobart', 'Darwin'],
  Malaysia: ['Kuala Lumpur', 'George Town', 'Johor Bahru', 'Kota Kinabalu', 'Kuching'],
  Philippines: ['Metro Manila', 'Cebu City', 'Davao City', 'Quezon City', 'Iloilo City'],
  'New Zealand': ['Auckland', 'Wellington', 'Christchurch', 'Hamilton', 'Dunedin'],
  China: ['Beijing', 'Shanghai', 'Guangzhou', 'Shenzhen', 'Chengdu', 'Hangzhou'],
  Japan: ['Tokyo', 'Osaka', 'Yokohama', 'Nagoya', 'Fukuoka', 'Sapporo'],
  'South Korea': ['Seoul', 'Busan', 'Incheon', 'Daegu', 'Daejeon'],
  India: ['Mumbai', 'Delhi', 'Bengaluru', 'Hyderabad', 'Chennai', 'Kolkata'],
  'United Arab Emirates': ['Dubai', 'Abu Dhabi', 'Sharjah'],
  'United Kingdom': ['London', 'Manchester', 'Birmingham', 'Edinburgh', 'Glasgow'],
  'United States': ['New York', 'Los Angeles', 'Chicago', 'Houston', 'San Francisco', 'Miami'],
  Canada: ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa'],
}

export function majorCitiesForCountry(country: string | null | undefined) {
  return country ? MAJOR_CITIES_BY_COUNTRY[country] ?? [] : []
}
