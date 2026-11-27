const fs = require("node:fs/promises");
const path = require("node:path");

async function build(destination, appDirectory) {
  const read = name => fs.readFile(path.join(appDirectory, name), "utf8");
  const [document, css, pdfLicense, zipLicense] = await Promise.all([
    read("index.html"), read("styles.css"), read("vendor/PDFJS-LICENSE.txt"), read("vendor/JSZIP-LICENSE.md")
  ]);
  const scriptTag = /[ \t]*<script defer src="([^"]+)"><\/script>\r?\n/g;
  const names = [...document.matchAll(scriptTag)].map(match => match[1]);
  if (!names.includes("app.js")) throw new Error("No se encontró el punto de entrada de Repaso.");
  const scripts = await Promise.all(["vendor/pdf.bundle.js", ...names].map(async name => {
    const source = (await read(name)).replace(/<\/script/gi, match => "<\\/" + match.slice(2));
    return "<script>\n" + source + "\n</script>";
  }));
  const licenses = (pdfLicense + "\n\n" + zipLicense).replace(/<\/script/gi, "&lt;/script");
  const portable = document
    .replace('<link rel="stylesheet" href="styles.css">', () => "<style>\n" + css + "\n</style>")
    .replace(scriptTag, "")
    .replace("</body>", () => scripts.join("\n") +
      '\n<script type="text/plain" id="third-party-licenses">\n' + licenses + "\n</script>\n</body>");
  await fs.writeFile(destination, portable, "utf8");
}

const destination = path.resolve(process.argv[2] || "Repaso.html");
const appDirectory = path.resolve(process.argv[3] || path.join(__dirname, ".."));
build(destination, appDirectory).catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
