import chalk from "chalk";
import fs from "fs";
import yaml from "yaml";
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

	private configDoc: yaml.Document;
	private currentVersion: number;

	constructor(configPath: string, migrationsDir: string) {
		this.configPath = configPath;
		this.migrationsDir = migrationsDir;
		this.configDoc = new yaml.Document();
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
			this.configDoc = yaml.parseDocument(configContent);
			console.log(chalk.cyan(`Loaded existing config from ${this.configPath}`));

			const versionNode = this.configDoc.get("version");
			if (versionNode !== undefined) {
				this.currentVersion = versionNode as number;
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
			const migration = yaml.parse(migrationContent) as MigrationFile;

			if (migration.version > this.currentVersion) {
				console.log(chalk.green(`Applying migration file: ${file} (version ${migration.version})`));

				this.processAddOperations(migration.add);
				this.processRemoveOperations(migration.remove);
				this.processModifyOperations(migration.modify);

				this.currentVersion = migration.version;
				this.configDoc.set("version", this.currentVersion);

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
				this.setNestedProperty(key, value);
				console.log(chalk.yellow(`\t\t+ ${key}: ${JSON.stringify(value)}`));
			}
		}
	}

	private processRemoveOperations(removeOps?: Record<string, null>): void {
		if (removeOps) {
			console.log(chalk.red("\tRemove operations:"));
			for (const key of Object.keys(removeOps)) {
				const removed = this.deleteNestedProperty(key);
				if (removed) {
					console.log(chalk.red(`\t\t- ${key}`));
				} else {
					console.log(chalk.yellow(`\t\t! ${key} (not found)`));
				}
			}
		}
	}

	private processModifyOperations(modifyOps?: Record<string, any>): void {
		if (modifyOps) {
			console.log(chalk.blue("\tModify operations:"));
			for (const [key, value] of Object.entries(modifyOps)) {
				this.setNestedProperty(key, value);
				console.log(chalk.blue(`\t\t* ${key}: ${JSON.stringify(value)}`));
			}
		}
	}

	private writeConfig(): void {
		const versionNode = this.configDoc.get("version");
		if (versionNode) {
			this.configDoc.deleteIn(["version"]);
		}

		let updatedConfigYaml = this.configDoc.toString();

		updatedConfigYaml += "\n# DO NOT CHANGE. This value is used for migrations. If you change this, you risk losing data.\n";
		updatedConfigYaml += `version: ${this.currentVersion}\n`;

		fs.writeFileSync(this.configPath, updatedConfigYaml, "utf8");
		console.log(chalk.cyan(`Updated config written to ${this.configPath} (version ${this.currentVersion})`));
	}

	private setNestedProperty(path: string, value: any): void {
		const parts = path.split(".");
		let current: any = this.configDoc.contents;

		for (let i = 0; i < parts.length - 1; i++) {
			if (!(current instanceof yaml.YAMLMap)) {
				current = new yaml.YAMLMap();
				this.configDoc.setIn(parts.slice(0, i), current);
			}
			if (!current.has(parts[i])) {
				current.set(parts[i], new yaml.YAMLMap());
			}
			current = current.get(parts[i]);
		}

		const lastPart = parts[parts.length - 1];
		if (current instanceof yaml.YAMLMap) {
			current.set(lastPart, value);
		} else {
			this.configDoc.setIn(parts, value);
		}
	}

	private deleteNestedProperty(path: string): boolean {
		const parts = path.split(".");
		let current: any = this.configDoc.contents;

		for (let i = 0; i < parts.length - 1; i++) {
			if (current instanceof yaml.YAMLMap && current.has(parts[i])) {
				current = current.get(parts[i]);
			} else {
				// If any part of the path doesn't exist, we can't delete the property
				return false;
			}
		}

		const lastPart = parts[parts.length - 1];
		if (current instanceof yaml.YAMLMap && current.has(lastPart)) {
			current.delete(lastPart);
			return true;
		}

		return false;
	}
}
