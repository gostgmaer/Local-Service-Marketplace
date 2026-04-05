const fs = require("fs");

function usage() {
	console.error("Usage: node scripts/prepare-newman-collection.js <input> <output>");
	process.exit(1);
}

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
	usage();
}

function ensureDVariable(events) {
	for (const event of events || []) {
		const script = event && event.script;
		if (!script || !Array.isArray(script.exec)) {
			continue;
		}

		const lines = script.exec;
		const usesD = lines.some((line) => /\bd\./.test(line));
		const hasDDeclaration = lines.some((line) => /\b(const|let|var)\s+d\s*=/.test(line));

		if (usesD && !hasDDeclaration) {
			script.exec = ["const d = pm.response.json();", ...lines];
		}
	}
}

function normalizeRequestUrl(request) {
	if (!request || !request.url || typeof request.url !== "object") {
		return;
	}

	if (typeof request.url.raw === "string" && request.url.raw.length > 0) {
		// Prefer Postman's raw URL form for Newman to avoid malformed host/path object mismatches.
		request.url = request.url.raw;
	}
}

function walkItems(items) {
	for (const item of items || []) {
		normalizeRequestUrl(item.request);
		ensureDVariable(item.event);

		if (Array.isArray(item.item)) {
			walkItems(item.item);
		}
	}
}

const rawCollection = fs.readFileSync(inputPath, "utf8").replace(/^\uFEFF/, "");
const collection = JSON.parse(rawCollection);

ensureDVariable(collection.event);
walkItems(collection.item);

fs.writeFileSync(outputPath, JSON.stringify(collection, null, 2));
console.log(`Prepared Newman collection: ${outputPath}`);
