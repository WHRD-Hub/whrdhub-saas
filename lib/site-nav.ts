/**
 * Site-wide links and the public navigation tree.
 * The nav mirrors whrdhub.org. Marketing pages that we host live here;
 * everything else deep-links back to whrdhub.org for now.
 */

/**
 * The reporting platform now lives inside this app, so these are internal
 * routes. NEXT_PUBLIC_REPORTING_URL is kept only so an old deployment can be
 * pointed at during a cut-over; it is not used for navigation any more.
 */
export const links = {
  /** Public, anonymous-friendly report form. */
  reportAbuse: "/report",
  /** A member's own reports. */
  reportingDashboard: "/dashboard/reports",
  /** The response team's reporting console. */
  reportingConsole: "/hub/reporting",
  donate: "https://whrdhub.org/donate-now/",
};

export interface NavChild {
  label: string;
  href: string;
  external?: boolean;
}
export interface NavItem {
  label: string;
  href?: string;
  children?: NavChild[];
}

const wh = (p: string) => `https://whrdhub.org${p}`;

export const NAV: NavItem[] = [
  { label: "Home", href: "/" },
  {
    label: "About Us",
    children: [
      { label: "About the Hub", href: "/about" },
      { label: "Our Impact", href: "/about#impact" },
      { label: "Board & Staff", href: "/about#board" },
      { label: "Our Partners", href: "/about#partners" },
    ],
  },
  {
    label: "Our Work",
    children: [
      { label: "Our Causes", href: "/our-work" },
      { label: "County Networks", href: "/counties" },
      { label: "Activity Images", href: "/activity-images" },
      { label: "Press Releases", href: "/press" },
      { label: "News & Events", href: wh("/gallery/"), external: true },
    ],
  },
  {
    label: "Voices",
    children: [
      { label: "Blog", href: "/blog" },
      { label: "Downloads & Reports", href: "/resources" },
      { label: "Newsletter", href: "/newsletter" },
    ],
  },
  {
    label: "Get Involved",
    children: [
      { label: "Networks", href: "/organizations" },
      { label: "Opportunities", href: "/opportunities" },
      { label: "Contact Us", href: "/contact" },
    ],
  },
];

export const COUNTY_BLURBS: Record<string, string> = {
  bomet: "In Bomet, defenders organise against gender-based violence and for the safety of women in their communities.",
  kisumu: "Kisumu's network brings together defenders across the lakeside region to protect and support one another.",
  kitui: "Kitui defenders document abuses, from sand harvesting disputes to gender-based violence, and stand with survivors.",
  marsabit: "In Marsabit, women defenders work across vast distances to reach and support one another.",
  meru: "Meru's network supports defenders advancing women's rights and land justice.",
  mombasa: "At the coast, Mombasa defenders build safety and solidarity for women human rights defenders.",
  nairobi: "Nairobi anchors the movement, connecting defenders across the city and the country.",
  nakuru: "Nakuru's network grows the next generation of women human rights defenders in the Rift Valley.",
};
