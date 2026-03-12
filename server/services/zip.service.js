const archiver = require("archiver");
const fs = require("fs");
const path = require("path");

const sanitizeArchiveName = (value, fallback) => {
  const normalized = String(value || "")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || fallback;
};

const createZip = (files, outputPath) => {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    let fileIndex = 0;

    output.on("close", () => resolve(outputPath));
    archive.on("error", (err) => reject(err));

    archive.pipe(output);

    files.forEach((file) => {
      const filePath = typeof file === "string" ? file : file.filePath;
      if (!filePath || !fs.existsSync(filePath)) {
        return;
      }

      fileIndex += 1;
      const preferredName =
        typeof file === "object" && file.fileName
          ? sanitizeArchiveName(file.fileName, `${fileIndex}_${path.basename(filePath)}`)
          : `${fileIndex}_${path.basename(filePath)}`;

      archive.file(filePath, { name: preferredName });
    });

    archive.finalize();
  });
};

module.exports = { createZip };
