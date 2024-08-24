import chalk from "chalk";
import fs from "fs";
import * as yaml from "js-yaml";
import path from "path";

interface MigrationFile {
	config: string;
	version: number;
	add?: Record<string, any>;
	remove?: Record<string, null>;
	modify?: Record<string, any>;
}

export interface Config {
	[key: string]: any;
}

export class Migration {
	private readonly configPath: string;
	private readonly migrationsDir: string;

	private config: Config;
	private currentVersion: number;

	constructor(configPath: string, migrationsDir: string) {
		this.configPath = configPath;
		this.migrationsDir = migrationsDir;
		this.config = {};
		this.currentVersion = 0;
	}

	public apply(): void {
		console.log(chalk.blue("\n=== Starting Migration Process ===\n"));

		this.loadConfig();
		const migrationFiles = this.getMigrationFiles();
		this.processMigrationFiles(migrationFiles);
		this.writeConfig();

		console.log(chalk.blue("\n=== Migration Process Completed ===\n"));
	}

	private loadConfig(): void {
		if (fs.existsSync(this.configPath)) {
			const configContent = fs.readFileSync(this.configPath, "utf8");
			this.config = yaml.load(configContent) as Config;
			console.log(chalk.cyan(`Loaded existing config from ${this.configPath}`));

			if ("version" in this.config) {
				this.currentVersion = this.config.version;
			} else {
				console.log(chalk.yellow.bold("WARNING: No version field found in config. Assuming version 0."));
			}
		} else {
			console.log(chalk.yellow(`No existing config found at ${this.configPath}. Starting with an empty config.`));
		}
	}

	private getMigrationFiles(): string[] {
		const files = fs
			.readdirSync(this.migrationsDir)
			.filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"))
			.sort();
		console.log(chalk.magenta(`Found ${files.length} migration files to process.\n`));
		return files;
	}

	private processMigrationFiles(files: string[]): void {
		for (const file of files) {
			const filePath = path.join(this.migrationsDir, file);
			const migrationContent = fs.readFileSync(filePath, "utf8");
			const migration = yaml.load(migrationContent) as MigrationFile;

			if (migration.version > this.currentVersion) {
				console.log(chalk.green(`Applying migration file: ${file} (version ${migration.version})`));

				this.processAddOperations(migration.add);
				this.processRemoveOperations(migration.remove);
				this.processModifyOperations(migration.modify);

				this.currentVersion = migration.version;
				this.config.version = this.currentVersion;

				console.log(chalk.green(`\tCompleted processing ${file}\n`));
			} else {
				console.log(chalk.gray(`Skipping migration file: ${file} (version ${migration.version})`));
			}
		}
	}

	private processAddOperations(addOps?: Record<string, any>): void {
		if (addOps) {
			console.log(chalk.yellow("\tAdd operations:"));
			for (const [key, value] of Object.entries(addOps)) {
				this.setNestedProperty(this.config, key, value);
				console.log(chalk.yellow(`\t\t+ ${key}: ${JSON.stringify(value)}`));
			}
		}
	}

	private processRemoveOperations(removeOps?: Record<string, null>): void {
		if (removeOps) {
			console.log(chalk.red("\tRemove operations:"));
			for (const key of Object.keys(removeOps)) {
				this.deleteNestedProperty(this.config, key);
				console.log(chalk.red(`\t\t- ${key}`));
			}
		}
	}

	private processModifyOperations(modifyOps?: Record<string, any>): void {
		if (modifyOps) {
			console.log(chalk.blue("\tModify operations:"));
			for (const [key, value] of Object.entries(modifyOps)) {
				this.setNestedProperty(this.config, key, value);
				console.log(chalk.blue(`\t\t* ${key}: ${JSON.stringify(value)}`));
			}
		}
	}

	private writeConfig(): void {
		const { version, ...configWithoutVersion } = this.config;
		let updatedConfigYaml = yaml.dump(configWithoutVersion, { lineWidth: -1 });

		updatedConfigYaml += "\n# DO NOT CHANGE. This value is used for migrations. If you change this, you risk losing data.\n";
		updatedConfigYaml += `version: ${this.currentVersion}\n`;

		fs.writeFileSync(this.configPath, updatedConfigYaml, "utf8");
		console.log(chalk.cyan(`Updated config written to ${this.configPath} (version ${this.currentVersion})`));
	}

	private setNestedProperty(obj: any, path: string, value: any): void {
		const keys = path.split(".");
		let current = obj;

		for (let i = 0; i < keys.length - 1; i++) {
			if (!(keys[i] in current)) {
				current[keys[i]] = {};
			}
			current = current[keys[i]];
		}

		current[keys[keys.length - 1]] = value;
	}

	private deleteNestedProperty(obj: any, path: string): void {
		const keys = path.split(".");
		let current = obj;

		for (let i = 0; i < keys.length - 1; i++) {
			if (!(keys[i] in current)) {
				return;
			}
			current = current[keys[i]];
		}

		delete current[keys[keys.length - 1]];
	}
}
