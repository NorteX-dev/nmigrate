#!/usr/bin/env node

/**
1. Generate an empty migration file:
bun run cli.ts generate [--directory=./custom-migrations-dir]
2. Add an "add" operation to the latest migration file:
bun run cli.ts add key.path value [--directory=./custom-migrations-dir]
3. Add a "remove" operation to the latest migration file:
bun run cli.ts remove key.path [--directory=./custom-migrations-dir]
4. Add a "modify" operation to the latest migration file:
bun run cli.ts modify key.path new_value [--directory=./custom-migrations-dir]
5. Run migrations:
bun run cli.ts migrate ./config.yml [--directory=./custom-migrations-dir]
*/

import { Migration } from "./index";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { parseArgs } from "util";
import slugify from "slugify";

const { values, positionals } = parseArgs({
	args: process.argv,
	options: {
		directory: {
			type: "string",
			default: "./migrations",
		},
		version: {
			type: "string",
		},
	},
	strict: false,
	allowPositionals: true,
});
const migrationsDir = values.directory as string;

function getLatestVersion(migrationsDir: string): number {
	const files = fs
		.readdirSync(migrationsDir)
		.filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"))
		.sort();
	if (files.length === 0) return 0;
	const latestFile = files[files.length - 1];
	const content = yaml.load(fs.readFileSync(path.join(migrationsDir, latestFile), "utf8")) as any;
	return content.version || 0;
}

function generateMigrationFile(migrationsDir: string, name: string, overrideVersion?: number) {
	if (!fs.existsSync(migrationsDir)) {
		fs.mkdirSync(migrationsDir, { recursive: true });
		console.log(`Created directory: ${migrationsDir}`);
	}

	const files = fs
		.readdirSync(migrationsDir)
		.filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"))
		.sort();

	const fileCount = files.length + 1;
	const latestVersion = getLatestVersion(migrationsDir);
	const newVersion = overrideVersion !== undefined ? overrideVersion : latestVersion + 1;

	const slugifiedName = slugify(name, { lower: true, replacement: "_" });
	const filename = `${String(fileCount).padStart(3, "0")}_${slugifiedName}.yml`;

	const content = {
		config: "config.yml",
		version: newVersion,
	};

	fs.writeFileSync(path.join(migrationsDir, filename), yaml.dump(content));
	console.log(`Generated migration file: ${filename} (version: ${newVersion})`);
}

function addOperation(migrationsDir: string, operation: string, key: string, value: string) {
	const files = fs
		.readdirSync(migrationsDir)
		.filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"))
		.sort();
	if (files.length === 0) {
		console.error("No migration files found.");
		return;
	}
	const latestFile = files[files.length - 1];
	const filePath = path.join(migrationsDir, latestFile);
	const content = yaml.load(fs.readFileSync(filePath, "utf8")) as any;

	if (!content[operation]) {
		content[operation] = {};
	}

	if (operation === "remove") {
		content[operation][key] = null;
	} else {
		try {
			content[operation][key] = JSON.parse(value);
		} catch {
			content[operation][key] = value;
		}
	}

	fs.writeFileSync(filePath, yaml.dump(content));
	console.log(`Added ${operation} operation to ${latestFile}`);
}

const command = positionals[2];

switch (command) {
	case "migrate":
		if (positionals.length < 4) {
			console.error("Error: Please provide the config file path.");
			process.exit(1);
		}
		const configPath = positionals[3];
		const migration = new Migration(configPath, migrationsDir);
		migration.apply();
		break;

	case "generate":
		if (positionals.length < 4) {
			console.error("Error: Please provide a name for the migration.");
			process.exit(1);
		}
		const migrationName = positionals.slice(3).join(" ");
		const overrideVersion = values.version ? parseInt(values.version as string, 10) : undefined;
		generateMigrationFile(migrationsDir, migrationName, overrideVersion);
		break;

	case "add":
	case "remove":
	case "modify":
		if (positionals.length < 5) {
			console.error(`Error: Please provide key ${command === "remove" ? "" : "and value "}for ${command} operation.`);
			process.exit(1);
		}
		const key = positionals[3];
		const value = command === "remove" ? "" : positionals[4];
		addOperation(migrationsDir, command, key, value);
		break;

	default:
		console.error("Unknown command. Available commands: migrate, generate, add, remove, modify");
		process.exit(1);
}
