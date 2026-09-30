/** `/legal`: notices and attributions the product owes (K-003). */
export const LEGAL = {
  title: "Legal and attributions",
  heading: "Legal",
  headingAccent: "and attributions",
  intro:
    "Demo credits on a Canton test network: they have no cash value and cannot be withdrawn as money. The notices below credit the data this site uses.",
  sections: [
    {
      id: "region",
      heading: "Where you are browsing from",
      body: "Placing a call is held in some regions. To tell which, the site looks up your connection's address in a local IP-to-country table on this server. Nothing about the lookup is stored or sent anywhere.",
      credit: { text: "IP Geolocation by DB-IP", href: "https://db-ip.com" },
      license: { text: "Licensed under CC BY 4.0", href: "https://creativecommons.org/licenses/by/4.0/" },
    },
  ],
  notices: "Open-source notices for the code this product builds on are in THIRD_PARTY_NOTICES.md in the repository.",
} as const;
