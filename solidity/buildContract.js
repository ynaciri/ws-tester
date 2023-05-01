const fs = require("fs");
const path = require("path");
const solc = require("solc");

// BUILD CONFIGURATION

const SOURCES_LIST = ["SampleContract.sol"];

const OUTPUTS = ["SampleContract.sol"];

const BUILD_DIR = "src/contracts";

const callbacks = {
  import: (filename) => {
    let realFileName;

    if (fs.existsSync(realFileName)) {
      return {
        contents: fs.readFileSync(realFileName).toString(),
      };
    }

    return {
      error: `File not found : ${realFileName} (import ${filename})`,
    };
  },
  read: (filename) => {
    const realFileName = `solidity/${filename}`;
    if (fs.existsSync(realFileName)) {
      return {
        content: fs.readFileSync(realFileName).toString(),
      };
    }
    return {
      error: `File not found : ${realFileName} (import ${filename})`,
    };
  },
};

// READING MAKEFILE

const input = JSON.parse(fs.readFileSync("solidity/solc.json"));

// READING SOURCES

SOURCES_LIST.forEach((filename) => {
  input.sources[filename] = callbacks.read(filename);
});

// WRITING REAL INPUT
if (fs.existsSync(BUILD_DIR)) {
  fs.rmSync(BUILD_DIR, { recursive: true, force: true });
}

fs.mkdirSync(BUILD_DIR);
fs.writeFileSync(
  path.join(BUILD_DIR, "realInput.json"),
  JSON.stringify(input, null, 2)
);

// COMPILATION

console.info("Compiling with solcjs version", solc.version());

const output = JSON.parse(solc.compile(JSON.stringify(input), callbacks));

// ERROR LOGGING
try {
  if (output.errors && output.errors.length > 0) {
    output.errors.forEach((error) => {
      console.error(
        "Compilation error : [",
        `${error.sourceLocation.file}:L${error.sourceLocation.start}-${error.sourceLocation.end}`,
        "] :",
        error.message,
        "\n",
        error.formattedMessage
      );
    });
  } else {
    OUTPUTS.forEach((outputContract) => {
      const contract = output.contracts[outputContract];
      const contractName = Object.keys(contract)[0];
      fs.writeFileSync(
        path.join(BUILD_DIR, `${contractName}.json`),
        JSON.stringify(contract[contractName], null, 2)
      );
    });
  }
} catch (err) {
  console.log("Couldn't log error messages, see output file :", err);
}

// OUTPUT RESULT

fs.writeFileSync(
  path.join(BUILD_DIR, "contracts.json"),
  JSON.stringify(output, null, 2)
);
