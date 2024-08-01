import { Migration } from "./index";

const args = process.argv.slice(2);

if (args.length === 0) {
	console.error("Error: Please provide the config file path.");
	process.exit(1);
}

const configPath = args[0];
let migrationsDir = "./migrations"; // default value

// Check for --directory option
const dirIndex = args.findIndex((arg) => arg.startsWith("--directory="));
if (dirIndex !== -1) {
	migrationsDir = args[dirIndex].split("=")[1];
}

const migration = new Migration(configPath, migrationsDir);
migration.apply();
