// CSS de base injecté dans tout template (polices de la marque + reset léger).
// Source canonique : base.css (même dossier). Inliné ici en constante TS car le
// bundler Next (sortie standalone) ne trace pas les readFileSync relatifs au
// module compilé : le .css ne serait pas copié à côté du bundle au runtime.
// Garder les deux synchronisés.
export const BASE_CSS = `@font-face {
  font-family: "General Sans";
  src: url("https://cdn.avqn.ch/fonts/GeneralSans-Regular.woff2") format("woff2");
  font-weight: 400;
  font-display: block;
  font-style: normal;
}
@font-face {
  font-family: "General Sans";
  src: url("https://cdn.avqn.ch/fonts/GeneralSans-Medium.woff2") format("woff2");
  font-weight: 500;
  font-display: block;
  font-style: normal;
}
@font-face {
  font-family: "General Sans";
  src: url("https://cdn.avqn.ch/fonts/GeneralSans-Semibold.woff2") format("woff2");
  font-weight: 600;
  font-display: block;
  font-style: normal;
}
@font-face {
  font-family: "General Sans";
  src: url("https://cdn.avqn.ch/fonts/GeneralSans-Bold.woff2") format("woff2");
  font-weight: 700;
  font-display: block;
  font-style: normal;
}
@font-face {
  font-family: "Clash Display";
  src: url("https://cdn.avqn.ch/fonts/ClashDisplay-Semibold.woff2") format("woff2");
  font-weight: 600;
  font-display: block;
  font-style: normal;
}
@font-face {
  font-family: "Clash Display";
  src: url("https://cdn.avqn.ch/fonts/ClashDisplay-Bold.woff2") format("woff2");
  font-weight: 700;
  font-display: block;
  font-style: normal;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
html,
body {
  background: #fff;
  color: #000;
  font-family:
    "General Sans", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
}
`;
