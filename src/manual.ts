import { Migration } from "./migrate.ts";

const configPath = "./config.yml";
const migrationsDir = "./migrations";
const migration = new Migration(configPath, migrationsDir);
migration.apply();
