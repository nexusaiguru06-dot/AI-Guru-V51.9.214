/**
 * V51.9.96: maps drawn in the browser with d3-geo from Natural Earth (public domain). The world map is Natural Earth's
 * India point-of-view edition, so India's boundary follows India's claim; the states layer is Natural Earth admin-1
 * (36 states and UTs incl. Ladakh and Telangana). Check against the Survey of India map before printing for exams.
 */
import type { Visual } from './types';

export const MAP_FILES = { world: '/ai-guru/visuals/maps/world-india-view.json', states: '/ai-guru/visuals/maps/india-states.json' };

/** Bright, friendly continent colours (colour-blind safe enough with the labels). */
export const CONTINENT_COLOURS: Record<string, string> = { Asia: '#f59e0b', Africa: '#ef4444', Europe: '#3b82f6', 'North America': '#22c55e', 'South America': '#a855f7', Oceania: '#14b8a6', Antarctica: '#e2e8f0', 'Seven seas (open ocean)': '#94a3b8' };
export const STATE_PALETTE = ['#f472b6', '#fb923c', '#facc15', '#4ade80', '#2dd4bf', '#38bdf8', '#818cf8', '#c084fc', '#f87171', '#a3e635'];

export const MAP_VISUALS: Visual[] = [
  { kind: 'map', id: 'map-continents', subject: 'geography', title: 'Continents of the world', ml: 'വൻകരകൾ', map: { view: 'continents' }, keywords: ['continent', 'continents', 'world map', 'asia', 'africa', 'europe', 'america', 'australia', 'antarctica', 'oceans', 'വൻകര', 'ഭൂഖണ്ഡം', 'ലോകം'] },
  { kind: 'map', id: 'map-zones', subject: 'geography', title: 'Heat zones of the Earth', ml: 'താപമേഖലകൾ', map: { view: 'zones' }, keywords: ['heat zones', 'torrid zone', 'temperate zone', 'frigid zone', 'tropic of cancer', 'tropic of capricorn', 'arctic circle', 'antarctic circle', 'climate zones', 'താപമേഖല', 'ഉഷ്ണമേഖല', 'ശീതമേഖല', 'കർക്കടകരേഖ', 'മകരരേഖ'] },
  { kind: 'map', id: 'map-latlong', subject: 'geography', title: 'Latitudes and longitudes', ml: 'അക്ഷാംശവും രേഖാംശവും', map: { view: 'latlong' }, keywords: ['latitude', 'longitude', 'equator', 'prime meridian', 'meridian', 'parallels', 'grid', 'greenwich', 'time zone', 'അക്ഷാംശം', 'രേഖാംശം', 'ഭൂമധ്യരേഖ', 'ഗ്രീനിച്ച്'] },
  { kind: 'map', id: 'map-india', subject: 'geography', title: 'India: states and union territories', ml: 'ഇന്ത്യ: സംസ്ഥാനങ്ങൾ', map: { view: 'india' }, keywords: ['india', 'states of india', 'union territory', 'indian states', 'ഇന്ത്യ', 'സംസ്ഥാനങ്ങൾ'] },
  { kind: 'map', id: 'map-kerala', subject: 'geography', title: 'Kerala on the map of India', ml: 'കേരളം', map: { view: 'state', name: 'Kerala' }, keywords: ['kerala', 'കേരളം', 'western ghats', 'പശ്ചിമഘട്ടം'] },
];

/** Country and state names that, when a paragraph mentions them, get their own highlighted map. */
export const MAP_PLACES = {
  countries: ['China', 'Nepal', 'Bhutan', 'Bangladesh', 'Pakistan', 'Sri Lanka', 'Myanmar', 'Afghanistan', 'Japan', 'Indonesia', 'Russia', 'Australia', 'Brazil', 'Egypt', 'United States of America', 'United Kingdom', 'France', 'Germany', 'Canada', 'South Africa', 'Saudi Arabia', 'Iran', 'Iraq', 'Kenya', 'Nigeria', 'Argentina', 'Mexico', 'Italy', 'Spain', 'Maldives', 'Thailand', 'Malaysia', 'Singapore', 'New Zealand'],
  states: ['Tamil Nadu', 'Karnataka', 'Andhra Pradesh', 'Telangana', 'Maharashtra', 'Goa', 'Gujarat', 'Rajasthan', 'Punjab', 'Haryana', 'Uttar Pradesh', 'Bihar', 'West Bengal', 'Odisha', 'Assam', 'Madhya Pradesh', 'Chhattisgarh', 'Jharkhand', 'Uttarakhand', 'Himachal Pradesh', 'Jammu and Kashmir', 'Ladakh', 'Sikkim', 'Meghalaya', 'Manipur', 'Mizoram', 'Nagaland', 'Tripura', 'Arunachal Pradesh', 'Delhi', 'Lakshadweep', 'Puducherry', 'Andaman and Nicobar'],
};
