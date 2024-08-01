import { expect, test, beforeEach, afterEach } from "bun:test";
import { readFileSync, writeFileSync, unlinkSync, copyFileSync } from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { type Config, Migration } from "./index.ts";

// Test suite
const testConfigPath = "./test-config.yml";
const testMigrationsDir = "./test-migrations";

beforeEach(() => {
	// Create initial config file with version
	writeFileSync(
		"./config-init.yml",
		yaml.dump({
			version: 1,
			database: {
				host: "localhost",
				port: 5432,
				name: "myapp",
			},
			logging: {
				level: "info",
				file: "app.log",
			},
			features: {
				user_registration: true,
			},
		}),
	);

	// Copy the initial config file
	copyFileSync("./config-init.yml", testConfigPath);

	// Create test migration files
	writeFileSync(
		path.join(testMigrationsDir, "001_add_cache.yml"),
		`
config: config.yml
version: 2
add:
  cache:
    enabled: true
    type: redis
    ttl: 3600
`,
	);

	writeFileSync(
		path.join(testMigrationsDir, "002_modify_logging.yml"),
		`
config: config.yml
version: 3
modify:
  logging.level: debug
  logging.file: /var/log/myapp.log
`,
	);

	writeFileSync(
		path.join(testMigrationsDir, "003_remove_and_add_features.yml"),
		`
config: config.yml
version: 4
remove:
  features.user_registration:
add:
  features:
    dark_mode: false
    notifications: true
`,
	);
});

afterEach(() => {
	// Clean up test files
	unlinkSync(testConfigPath);
	unlinkSync("./config-init.yml");
	unlinkSync(path.join(testMigrationsDir, "001_add_cache.yml"));
	unlinkSync(path.join(testMigrationsDir, "002_modify_logging.yml"));
	unlinkSync(path.join(testMigrationsDir, "003_remove_and_add_features.yml"));
});

test("Migration process with versioning", () => {
	const migration = new Migration(testConfigPath, testMigrationsDir);
	migration.apply();

	const finalConfig = yaml.load(readFileSync(testConfigPath, "utf8")) as Config;

	expect(finalConfig).toEqual({
		version: 4,
		database: {
			host: "localhost",
			port: 5432,
			name: "myapp",
		},
		logging: {
			level: "debug",
			file: "/var/log/myapp.log",
		},
		features: {
			dark_mode: false,
			notifications: true,
		},
		cache: {
			enabled: true,
			type: "redis",
			ttl: 3600,
		},
	});
});

test("Migration process with no initial version", () => {
	writeFileSync(
		testConfigPath,
		yaml.dump({
			database: {
				host: "localhost",
				port: 5432,
				name: "myapp",
			},
		}),
	);

	const migration = new Migration(testConfigPath, testMigrationsDir);
	migration.apply();

	const finalConfig = yaml.load(readFileSync(testConfigPath, "utf8")) as Config;

	expect(finalConfig.version).toBe(4);
	expect(finalConfig.cache).toBeDefined();
	expect(finalConfig.logging.level).toBe("debug");
});
