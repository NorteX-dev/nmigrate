import { Migration } from "./migrate";

const configPath = "./config.yml";
const migrationsDir = "./migrations";
const migration = new Migration(configPath, migrationsDir);
migration.apply();
